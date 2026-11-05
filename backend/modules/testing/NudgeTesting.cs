using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Slack;
using Torque.Users;
// Dev-only NudgeWorker tools for the test harness
// endpoints: /testing/slack/nudges, /testing/slack/nudges/preview, /testing/slack/nudges/me,
//            /testing/slack/nudges/me/reset

namespace Torque.Testing;

// kind: "no_project" | "no_journal". force skips the eligibility check.
public record NudgeSendRequest(string? Kind = null, bool Force = false);

// backdateDays moves your account's and your projects' created_at back that many days, so
// you clear the nudge delays without waiting. Null = only clear the sent-at markers.
public record NudgeResetRequest(int? BackdateDays = null);

// Everything except POST /testing/slack/nudges only reads or messages the signed-in user.
// Eligibility always comes from NudgeWorker's own queries, so these test the real rules.
public static class NudgeTesting
{
    public static void MapNudgeTesting(this WebApplication app)
    {
        // Runs the real pass now. DMs every qualifying user in the database.
        app.MapPost("/testing/slack/nudges", async (NudgeWorker worker, SlackOptions options, CancellationToken ct) =>
        {
            if (!options.Configured) return SlackDisabled();
            var (noProject, noJournal) = await worker.RunOnceAsync(ct);
            return Results.Ok(new { noProjectSent = noProject, noJournalSent = noJournal });
        }).RequireAuthorization();

        // Dry run of the pass: who qualifies for each nudge and whether it's daytime for
        // them (so this pass would send). Writes nothing, sends nothing.
        app.MapGet("/testing/slack/nudges/preview", async (AppDbContext db, CancellationToken ct) =>
        {
            var now = DateTime.UtcNow;
            var noProject = await NudgeWorker.NoProjectCandidates(db, now).AsNoTracking().OrderBy(u => u.CreatedAt).ToListAsync(ct);
            var noJournal = await NudgeWorker.NoJournalCandidates(db, now).AsNoTracking().OrderBy(u => u.CreatedAt).ToListAsync(ct);

            object Row(User u) => new
            {
                u.Id,
                u.Username,
                slackId = u.SlackUserID,
                signedUpAt = u.CreatedAt,
                localHour = NudgeWorker.LocalHour(u, now),
                daytime = NudgeWorker.IsDaytime(u, now)
            };
            return Results.Ok(new
            {
                now,
                sendWindow = $"{NudgeWorker.SendFromHour}:00–{NudgeWorker.SendUntilHour}:00 local",
                noProject = noProject.Select(Row),
                noJournal = noJournal.Select(Row)
            });
        }).RequireAuthorization();

        // Your own standing for both nudges, condition by condition.
        app.MapGet("/testing/slack/nudges/me", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var user = await CurrentUserAsync(principal, db, ct);
            if (user is null) return NoUser();
            return Results.Ok(await StandingAsync(db, user, DateTime.UtcNow, ct));
        }).RequireAuthorization();

        // Sends one nudge to your own Slack ID right now (ignoring the daytime window) and
        // marks it sent, the way the worker would. 409 if you don't qualify, unless force.
        app.MapPost("/testing/slack/nudges/me", async (
            NudgeSendRequest body, ClaimsPrincipal principal, AppDbContext db, SlackClient slack, SlackOptions options, CancellationToken ct) =>
        {
            if (!options.Configured) return SlackDisabled();
            var user = await CurrentUserAsync(principal, db, ct);
            if (user is null) return NoUser();
            if (string.IsNullOrWhiteSpace(user.SlackUserID)) return Results.BadRequest("Your account has no Slack ID linked.");

            var now = DateTime.UtcNow;
            var kind = body.Kind?.Trim().ToLowerInvariant();
            var candidates = kind switch
            {
                "no_project" => NudgeWorker.NoProjectCandidates(db, now),
                "no_journal" => NudgeWorker.NoJournalCandidates(db, now),
                _ => null
            };
            if (candidates is null) return Results.BadRequest("kind must be no_project or no_journal.");

            if (!body.Force && !await candidates.AnyAsync(u => u.Id == user.Id, ct))
            {
                return Results.Conflict(new
                {
                    error = $"You don't qualify for {kind} right now. Use POST /testing/slack/nudges/me/reset with backdateDays, or force: true.",
                    standing = await StandingAsync(db, user, now, ct)
                });
            }

            SlackMessage message;
            if (kind == "no_project")
            {
                message = NudgeWorker.NoProjectMessage(options, user);
                user.NoProjectNudgeSentAt = now;
            }
            else
            {
                var projects = await NudgeWorker.OpenProjectsAsync(db, [user.Id], ct);
                if (projects.Count == 0) return Results.BadRequest("no_journal needs at least one open (non-archived) project.");
                message = NudgeWorker.NoJournalMessage(options, projects);
                user.NoJournalNudgeSentAt = now;
            }
            await db.SaveChangesAsync(ct);

            var sent = await slack.SendDmAsync(user.SlackUserID, message);
            return Results.Ok(new
            {
                sent,
                kind,
                forced = body.Force,
                slackId = user.SlackUserID,
                hint = sent ? null : "Not sent — check the server log for Slack warnings (bad token, missing chat:write/im:write scope, or an unknown Slack ID)."
            });
        }).RequireAuthorization();

        // Clears your sent-at markers so you can be nudged again, and optionally backdates
        // your account and projects so you clear the delays.
        app.MapPost("/testing/slack/nudges/me/reset", async (
            NudgeResetRequest body, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var user = await CurrentUserAsync(principal, db, ct);
            if (user is null) return NoUser();
            if (body.BackdateDays is < 0 or > 365) return Results.BadRequest("backdateDays must be between 0 and 365.");

            user.NoProjectNudgeSentAt = null;
            user.NoJournalNudgeSentAt = null;
            var backdatedProjects = 0;
            if (body.BackdateDays is { } days and > 0)
            {
                var shift = TimeSpan.FromDays(days);
                user.CreatedAt -= shift;
                var projects = await db.Projects.Where(p => p.OwnerUserId == user.Id).ToListAsync(ct);
                foreach (var project in projects) project.CreatedAt -= shift;
                backdatedProjects = projects.Count;
            }
            await db.SaveChangesAsync(ct);

            return Results.Ok(new
            {
                cleared = true,
                backdatedDays = body.BackdateDays ?? 0,
                backdatedProjects,
                standing = await StandingAsync(db, user, DateTime.UtcNow, ct)
            });
        }).RequireAuthorization();
    }

    private static async Task<object> StandingAsync(AppDbContext db, User user, DateTime now, CancellationToken ct)
    {
        var openProjects = await db.Projects
            .Where(p => p.OwnerUserId == user.Id && !p.IsArchived)
            .Select(p => p.CreatedAt)
            .ToListAsync(ct);
        var anyProjects = await db.Projects.AnyAsync(p => p.OwnerUserId == user.Id, ct);
        var hasJournaledTime = await db.Devlogs.AnyAsync(d => d.OwnerUserId == user.Id && d.TrackedSeconds > 0, ct);
        DateTime? firstOpenProjectAt = openProjects.Count == 0 ? null : openProjects.Min();

        return new
        {
            now,
            hasSlackId = !string.IsNullOrWhiteSpace(user.SlackUserID),
            completedFirstTimeSetup = user.CompletedFirstTimeSetup,
            banned = user.Role?.Contains("banned") == true,
            timeZone = user.TimeZone ?? "UTC (not set)",
            localHour = NudgeWorker.LocalHour(user, now),
            daytime = NudgeWorker.IsDaytime(user, now),
            noProject = new
            {
                eligible = await NudgeWorker.NoProjectCandidates(db, now).AnyAsync(u => u.Id == user.Id, ct),
                sentAt = user.NoProjectNudgeSentAt,
                signedUpAt = user.CreatedAt,
                qualifiesFrom = user.CreatedAt + NudgeWorker.NoProjectDelay,
                hasAnyProject = anyProjects
            },
            noJournal = new
            {
                eligible = await NudgeWorker.NoJournalCandidates(db, now).AnyAsync(u => u.Id == user.Id, ct),
                sentAt = user.NoJournalNudgeSentAt,
                openProjects = openProjects.Count,
                firstOpenProjectAt,
                qualifiesFrom = firstOpenProjectAt + NudgeWorker.NoJournalDelay,
                hasJournaledTime
            }
        };
    }

    private static async Task<User?> CurrentUserAsync(ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        Guid.TryParse(principal.FindFirst("sub")?.Value, out var userId) ? await db.Users.FindAsync([userId], ct) : null;

    private static IResult NoUser() => Results.NotFound("No user row yet — call GET /api/user/me once first.");

    private static IResult SlackDisabled() =>
        Results.Problem("Slack is disabled — set SLACK_BOT_TOKEN in backend/.env.", statusCode: 503);
}
