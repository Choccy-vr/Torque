using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Devlogs;
using Torque.Projects;
using Torque.Streaks;
// Dev-only streak playground for the test harness
// endpoint: /testing/streaks/simulate

namespace Torque.Testing;

// `hours` is one entry per day, oldest first, the last entry being today. Each day's hours
// become backdated journals (split into ≤10h chunks, Hackatime skipped), run through the
// real StreakService, and after every finished day the worker's settle step runs — so the
// timeline shows exactly what production would do over those days.
public record StreakSimRequest(int Tier = 1, int Freezes = 3, double[]? Hours = null, bool Keep = false);

public static class StreakSimulation
{
    public static void MapStreakSimulation(this WebApplication app)
    {
        app.MapPost("/testing/streaks/simulate", async (
            StreakSimRequest body, ClaimsPrincipal principal, AppDbContext db, StreakService streaks, CancellationToken ct) =>
        {
            if (!Guid.TryParse(principal.FindFirst("sub")?.Value, out var userId)) return Results.Unauthorized();

            var hours = body.Hours ?? [];
            if (hours.Length is 0 or > 60)
            {
                return Results.BadRequest("hours needs 1–60 entries: one per day, oldest first, last = today.");
            }
            if (hours.Any(h => h < 0 || !double.IsFinite(h))) return Results.BadRequest("hours can't be negative.");
            if (body.Freezes < 0) return Results.BadRequest("freezes can't be negative.");

            var user = await db.Users.FindAsync([userId], ct);
            if (user is null) return Results.NotFound("No user row yet — call GET /api/user/me once first.");

            // Without keep, everything (project, journals, days, freeze count) is rolled back.
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            user.StreakFreezes = body.Freezes;
            var project = new Project
            {
                Id = Guid.NewGuid(),
                OwnerUserId = userId,
                Title = $"Streak sim {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}",
                Tier = body.Tier
            };
            db.Projects.Add(project);
            await db.SaveChangesAsync(ct);

            var tz = StreakService.TimeZoneFor(user);
            var today = StreakService.LocalDate(user, DateTime.UtcNow);
            var timeline = new List<object>();

            for (var i = 0; i < hours.Length; i++)
            {
                var date = today.AddDays(i - (hours.Length - 1));
                var streakBefore = project.StreakCount;
                var freezesBefore = user.StreakFreezes;

                // Local noon, so the journals land inside the day regardless of DST shifts
                var at = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(new TimeOnly(12, 0)), tz);
                var remaining = hours[i];
                for (var n = 1; remaining > 1e-9; n++)
                {
                    var chunk = Math.Min(remaining, 10);
                    var devlog = new Devlog
                    {
                        Id = Guid.NewGuid(),
                        OwnerUserId = userId,
                        ProjectId = project.Id,
                        Title = $"Streak sim {date:yyyy-MM-dd} #{n}",
                        Text = "streak simulation",
                        ImageUrls = [],
                        TrackedSeconds = chunk * 3600,
                        CreatedAt = at.AddMinutes(n)
                    };
                    db.Devlogs.Add(devlog);
                    await streaks.RecordJournalAsync(devlog, project, user, ct);
                    await db.SaveChangesAsync(ct);
                    remaining -= chunk;
                }

                // The day is over: settle it like the worker would just after midnight.
                // Today isn't over yet, so it's left as-is.
                if (date < today)
                {
                    await streaks.ReconcileAsync(project, user, date.AddDays(1), ct);
                    await db.SaveChangesAsync(ct);
                }

                var status = await db.ProjectStreakDays
                    .Where(d => d.ProjectId == project.Id && d.Date == date)
                    .Select(d => (StreakDayStatus?)d.Status)
                    .FirstOrDefaultAsync(ct);

                var missed = hours[i] > 0 ? "Under 1h" : "Missed";
                var outcome = status switch
                {
                    StreakDayStatus.Completed when streakBefore == project.StreakCount && streakBefore > 0 => "Completed (at max streak)",
                    StreakDayStatus.Completed => "Completed",
                    StreakDayStatus.Frozen => "Frozen (freeze used)",
                    _ when date == today => "Today (not over yet)",
                    _ when streakBefore > 0 && project.StreakCount == 0 => $"{missed} (streak reset)",
                    _ => missed
                };

                timeline.Add(new
                {
                    date,
                    hoursLogged = hours[i],
                    outcome,
                    streak = StreakService.EffectiveStreak(project.StreakCount, project.Tier),
                    freezesLeft = user.StreakFreezes,
                    freezesUsed = freezesBefore - user.StreakFreezes
                });
            }

            if (body.Keep) await tx.CommitAsync(ct);

            var finalStreak = StreakService.EffectiveStreak(project.StreakCount, project.Tier);
            return Results.Ok(new
            {
                kept = body.Keep,
                projectId = body.Keep ? project.Id : (Guid?)null,
                timeZone = user.TimeZone ?? "UTC (not set)",
                tier = project.Tier,
                maxStreak = StreakService.MaxStreakForLevel(project.Tier),
                startFreezes = body.Freezes,
                finalStreak,
                multiplier = StreakService.Multiplier(finalStreak),
                timeline
            });
        }).RequireAuthorization();
    }
}
