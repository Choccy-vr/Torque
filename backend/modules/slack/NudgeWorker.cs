using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Deadlines;
using Torque.Users;

namespace Torque.Slack;

// One-time encouragement DMs, each sent at most once per user:
//  - "start a project": NoProjectDelay after sign-up, to people who never created one.
//  - "log your first hours": NoJournalDelay after their first project, to people who
//    haven't journaled any time on any project.
// Only goes out during the user's daytime (SendFromHour–SendUntilHour local) so nobody
// gets pinged at 3 AM, and never to banned users or once the program is over. Sends are
// spaced out and capped per pass, so the backlog right after a deploy doesn't burst
// Slack's rate limits. Like the other DMs it's best effort: a user is marked as nudged
// before the send, so a failed send isn't retried.
public class NudgeWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan NoProjectDelay = TimeSpan.FromDays(4);
    public static readonly TimeSpan NoJournalDelay = TimeSpan.FromDays(3);
    public const int SendFromHour = 10;
    public const int SendUntilHour = 20;
    private const int MaxPerKindPerPass = 25;
    private static readonly TimeSpan SendSpacing = TimeSpan.FromSeconds(1.2);

    private readonly IServiceScopeFactory _scopes;
    private readonly SlackOptions _options;
    private readonly ILogger<NudgeWorker> _logger;

    public NudgeWorker(IServiceScopeFactory scopes, SlackOptions options, ILogger<NudgeWorker> logger)
    {
        _scopes = scopes;
        _options = options;
        _logger = logger;
    }

    // Only one pass at a time, whether from the timer or RunOnceAsync.
    private readonly SemaphoreSlim _gate = new(1, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(PollInterval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Nudge tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // Runs one pass immediately. Used by the Development-only test harness. Returns how
    // many DMs of each kind were queued.
    public async Task<(int NoProject, int NoJournal)> RunOnceAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            return await NudgeAsync(ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<(int, int)> NudgeAsync(CancellationToken ct)
    {
        // Don't mark anyone as nudged while there's no way to actually send.
        if (!_options.Configured || ProgramDates.ProgramOver()) return (0, 0);

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var slack = scope.ServiceProvider.GetRequiredService<SlackClient>();
        var now = DateTime.UtcNow;

        var noProject = DaytimeOnly(await NoProjectCandidates(db, now).OrderBy(u => u.CreatedAt).ToListAsync(ct), now);
        var noJournal = DaytimeOnly(await NoJournalCandidates(db, now).OrderBy(u => u.CreatedAt).ToListAsync(ct), now);
        if (noProject.Count == 0 && noJournal.Count == 0) return (0, 0);

        var messages = new List<(string SlackId, SlackMessage Message)>();
        foreach (var user in noProject)
        {
            user.NoProjectNudgeSentAt = now;
            messages.Add((user.SlackUserID, NoProjectMessage(_options, user)));
        }
        var projects = await OpenProjectsAsync(db, noJournal.Select(u => u.Id).ToList(), ct);
        foreach (var user in noJournal)
        {
            user.NoJournalNudgeSentAt = now;
            messages.Add((user.SlackUserID, NoJournalMessage(_options, projects.Where(p => p.OwnerUserId == user.Id).ToList())));
        }

        await db.SaveChangesAsync(ct);

        // Sent one at a time, after the save, so a crash mid-batch can't double-send.
        foreach (var (slackId, message) in messages)
        {
            try
            {
                if (!await slack.SendDmAsync(slackId, message))
                {
                    _logger.LogWarning("Nudge DM to {SlackId} failed", slackId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nudge DM to {SlackId} failed", slackId);
            }
            await Task.Delay(SendSpacing, ct);
        }

        return (noProject.Count, noJournal.Count);
    }

    private static List<User> DaytimeOnly(List<User> users, DateTime now) => users
        .Where(u => IsDaytime(u, now))
        .Take(MaxPerKindPerPass)
        .ToList();

    // The eligibility rules, shared with the dev-only test harness (modules/testing) so it
    // checks exactly what the worker does. Neither looks at the daytime window or sends.

    private static IQueryable<User> Reachable(AppDbContext db) => db.Users.Where(u => u.SlackUserID != ""
        && u.CompletedFirstTimeSetup
        && (u.Role == null || !u.Role.Contains("banned")));

    public static IQueryable<User> NoProjectCandidates(AppDbContext db, DateTime now)
    {
        var signedUpBefore = now - NoProjectDelay;
        return Reachable(db).Where(u => u.NoProjectNudgeSentAt == null
            && u.CreatedAt <= signedUpBefore
            && !db.Projects.Any(p => p.OwnerUserId == u.Id));
    }

    public static IQueryable<User> NoJournalCandidates(AppDbContext db, DateTime now)
    {
        var startedBefore = now - NoJournalDelay;
        return Reachable(db).Where(u => u.NoJournalNudgeSentAt == null
            && db.Projects.Any(p => p.OwnerUserId == u.Id && !p.IsArchived && p.CreatedAt <= startedBefore)
            && !db.Devlogs.Any(d => d.OwnerUserId == u.Id && d.TrackedSeconds > 0));
    }

    public static int LocalHour(User user, DateTime now) =>
        TimeZoneInfo.ConvertTimeFromUtc(now, Streaks.StreakService.TimeZoneFor(user)).Hour;

    public static bool IsDaytime(User user, DateTime now)
    {
        var hour = LocalHour(user, now);
        return hour >= SendFromHour && hour < SendUntilHour;
    }

    public record OpenProject(Guid Id, Guid OwnerUserId, string Title);

    public static Task<List<OpenProject>> OpenProjectsAsync(AppDbContext db, List<Guid> ownerIds, CancellationToken ct) => db.Projects
        .Where(p => ownerIds.Contains(p.OwnerUserId) && !p.IsArchived)
        .Select(p => new OpenProject(p.Id, p.OwnerUserId, p.Title))
        .ToListAsync(ct);

    public static SlackMessage NoProjectMessage(SlackOptions options, User user) => SlackMessages.NoProjectNudge(
        user.Username, options.NewProjectUrl,
        options.DocsUrl("project-guides"), options.DocsUrl("projects/what-is-a-good-project"));

    // ownProjects = the user's open (non-archived) projects
    public static SlackMessage NoJournalMessage(SlackOptions options, List<OpenProject> ownProjects)
    {
        var single = ownProjects.Count == 1 ? ownProjects[0] : null;
        return SlackMessages.NoJournalNudge(
            single?.Title, ownProjects.Count,
            single is null ? options.ProjectsUrl : options.ProjectUrl(single.Id),
            options.DocsUrl("journaling/how-to-journal"), options.DocsUrl("getting-started"));
    }
}
