using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Deadlines;
using Torque.Projects;
using Torque.Settings;
using Torque.Slack;
using Torque.Users;

namespace Torque.Streaks;

// Settles streaks after each owner's local midnight passes: a project whose last counted
// day is before yesterday missed a day, so it spends a freeze or resets. Journals settle
// their own project too (StreakService.RecordJournalAsync); this catches projects nobody
// journals on. Projects in review are skipped: their streak is paused (see
// StreakService.InReview). Nothing is settled while streaks are paused globally.
// Each pass also DMs owners whose streak still needs today's hour once it's past
// ReminderHour in their timezone (once per day), and DMs the freezes / resets it settles.
public class StreakWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(15);
    // Owner-local hour (24h) from which the "streak at risk" DM goes out
    private const int ReminderHour = 20;

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<StreakWorker> _logger;

    public StreakWorker(IServiceScopeFactory scopes, ILogger<StreakWorker> logger)
    {
        _scopes = scopes;
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
                _logger.LogError(ex, "Streak settle tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // Runs one pass immediately instead of waiting for the next tick. Used by the
    // Development-only test harness (modules/testing) — there's no public endpoint.
    public async Task RunOnceAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            await SettleAsync(ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task SettleAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var streaks = scope.ServiceProvider.GetRequiredService<StreakService>();
        var settings = scope.ServiceProvider.GetRequiredService<SettingsService>();
        var slack = scope.ServiceProvider.GetRequiredService<SlackNotifier>();
        var slackOptions = scope.ServiceProvider.GetRequiredService<SlackOptions>();
        if (await settings.StreaksPausedAsync(ct)) return;
        // No more settling or reminder DMs once the last builds are due.
        if (ProgramDates.ProgramOver()) return;

        var active = await db.Projects
            .Where(p => p.StreakCount > 0
                && p.Status != ProjectStatus.Unreviewed
                && p.Status != ProjectStatus.Claimed
                && p.Status != ProjectStatus.Fraud_Pending)
            .ToListAsync(ct);
        if (active.Count == 0) return;

        var ownerIds = active.Select(p => p.OwnerUserId).Distinct().ToList();
        var owners = await db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var now = DateTime.UtcNow;
        var settled = new List<(User Owner, Project Project, StreakChange Change)>();
        foreach (var group in active.GroupBy(p => p.OwnerUserId))
        {
            if (ct.IsCancellationRequested) return;
            if (!owners.TryGetValue(group.Key, out var owner)) continue;

            var today = StreakService.LocalDate(owner, now);
            // Longest streaks get first claim on the owner's freezes.
            foreach (var project in group.OrderByDescending(p => p.StreakCount))
            {
                if (project.LastStreakDate < today.AddDays(-1))
                {
                    var change = await streaks.ReconcileAsync(project, owner, today, ct);
                    if (change != StreakChange.None) settled.Add((owner, project, change));
                }
            }
        }

        var reminders = await QueueRemindersAsync(db, slackOptions, active, owners, now, ct);

        await db.SaveChangesAsync(ct);

        foreach (var (owner, project, change) in settled)
        {
            StreakNotifications.Send(slack, slackOptions, owner, project, change);
        }
        foreach (var (owner, items) in reminders)
        {
            slack.Send(owner.SlackUserID, SlackMessages.StreakAtRisk(items, owner.StreakFreezes));
        }
    }

    // Picks the projects whose streak still needs today's hour, for owners it's past
    // ReminderHour for, and marks them reminded. Run after settling, so every remaining
    // streak's last counted day is yesterday or today. Caller saves, then sends.
    private static async Task<List<(User Owner, List<StreakReminderItem> Items)>> QueueRemindersAsync(
        AppDbContext db, SlackOptions slackOptions, List<Project> active, Dictionary<Guid, User> owners, DateTime now, CancellationToken ct)
    {
        var due = new List<(User Owner, DateOnly Today, List<Project> Projects)>();
        foreach (var group in active.Where(p => p.StreakCount > 0).GroupBy(p => p.OwnerUserId))
        {
            if (!owners.TryGetValue(group.Key, out var owner)) continue;

            var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, StreakService.TimeZoneFor(owner));
            if (localNow.Hour < ReminderHour) continue;

            var today = DateOnly.FromDateTime(localNow);
            var projects = group
                .Where(p => p.LastStreakDate < today && p.StreakReminderSentFor != today)
                .OrderByDescending(p => p.StreakCount)
                .ToList();
            if (projects.Count > 0) due.Add((owner, today, projects));
        }
        if (due.Count == 0) return [];

        // Today's partial progress (a Pending day row) per project. Local "today" is within
        // a day of UTC's, so this window covers every owner's.
        var ids = due.SelectMany(d => d.Projects).Select(p => p.Id).ToList();
        var since = DateOnly.FromDateTime(now).AddDays(-1);
        var days = await db.ProjectStreakDays
            .Where(d => ids.Contains(d.ProjectId) && d.Date >= since)
            .Select(d => new { d.ProjectId, d.Date, d.TrackedSeconds })
            .ToListAsync(ct);

        var result = new List<(User, List<StreakReminderItem>)>();
        foreach (var (owner, today, projects) in due)
        {
            // Mirrors settling: longest streaks get the freezes first, and none go to a
            // project with freezes paused.
            var freezes = owner.StreakFreezes;
            var items = new List<StreakReminderItem>();
            foreach (var project in projects)
            {
                var covered = !project.StreakFreezesPaused && freezes > 0;
                if (covered) freezes--;

                var journaled = days.FirstOrDefault(d => d.ProjectId == project.Id && d.Date == today)?.TrackedSeconds ?? 0;
                items.Add(new StreakReminderItem(project.Title, slackOptions.ProjectUrl(project.Id), project.StreakCount, journaled, covered));
                project.StreakReminderSentFor = today;
            }
            result.Add((owner, items));
        }
        return result;
    }
}
