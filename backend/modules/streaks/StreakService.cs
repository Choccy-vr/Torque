using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Devlogs;
using Torque.Projects;
using Torque.Settings;
using Torque.Users;

namespace Torque.Streaks;

// Per-project daily streaks. A day is 12 AM–12 AM in the owner's timezone; it counts
// once that project's journals created that day cover 1+ hour of Hackatime time. A
// missed day resets the streak unless the owner spends a streak freeze on it. While a
// ship is in review the streak is paused: missed days aren't settled until the review
// ends (approved, changes needed or rejected), and the paused days are forgiven. The
// same goes for everyone while an admin has streaks or journaling paused globally
// (SettingKeys.StreakPausing).
public class StreakService
{
    public const double SecondsPerDay = 3600; // journaled seconds needed for a day to count
    public const decimal MultiplierPerDay = 0.01m;

    // Volts/hr (base, max with a full streak) per level — mirrors the docs' rewards table.
    private static readonly Dictionary<int, (decimal Base, decimal Max)> Rates = new()
    {
        [1] = (35, 40),
        [2] = (40, 50),
        [3] = (45, 55),
        [4] = (55, 65),
    };

    private readonly AppDbContext _db;
    private readonly SettingsService _settings;

    public StreakService(AppDbContext db, SettingsService settings)
    {
        _db = db;
        _settings = settings;
    }

    // Days of streak it takes to reach the level's max rate, rounded up (e.g. level 1:
    // 14 days = 39.9/hr, so 15). Levels outside 1–4 are clamped.
    public static int MaxStreakForLevel(int tier)
    {
        var (baseRate, maxRate) = Rates[Math.Clamp(tier, 1, 4)];
        return (int)Math.Ceiling((maxRate / baseRate - 1) / MultiplierPerDay);
    }

    // Takes columns rather than a Project so EF projections can call it.
    public static int EffectiveStreak(int streakCount, int tier) =>
        Math.Min(streakCount, MaxStreakForLevel(tier));

    public static decimal Multiplier(int effectiveStreak) => 1 + effectiveStreak * MultiplierPerDay;

    // Volts/hr a project earns right now: the level's base rate times the streak
    // multiplier, never above the level's max. Levels outside 1–4 are clamped.
    public static decimal VoltsPerHour(int tier, int streakCount)
    {
        var (baseRate, maxRate) = Rates[Math.Clamp(tier, 1, 4)];
        return Math.Min(baseRate * Multiplier(EffectiveStreak(streakCount, tier)), maxRate);
    }

    // A shipped project waiting on first-pass review or final approval.
    public static bool InReview(ProjectStatus status) =>
        status is ProjectStatus.Unreviewed or ProjectStatus.Claimed or ProjectStatus.Fraud_Pending;

    // Call when a project leaves review (or a global streak pause ends): moves the last
    // counted day up to yesterday so the paused days aren't settled as missed. Today is
    // still theirs to journal.
    public static void ResumeAfterReview(Project project, User owner)
    {
        if (project.StreakCount == 0 || project.LastStreakDate is null) return;

        var yesterday = LocalDate(owner, DateTime.UtcNow).AddDays(-1);
        if (project.LastStreakDate < yesterday) project.LastStreakDate = yesterday;
    }

    // Call when a global streak pause ends: forgives the paused days on every active
    // streak, like ResumeAfterReview. Caller saves.
    public async Task ResumeAllAfterPauseAsync(CancellationToken ct = default)
    {
        var active = await _db.Projects
            .Where(p => p.StreakCount > 0 && p.LastStreakDate != null)
            .ToListAsync(ct);
        if (active.Count == 0) return;

        var ownerIds = active.Select(p => p.OwnerUserId).Distinct().ToList();
        var owners = await _db.Users
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        foreach (var project in active)
        {
            if (owners.TryGetValue(project.OwnerUserId, out var owner)) ResumeAfterReview(project, owner);
        }
    }

    public static TimeZoneInfo TimeZoneFor(User user) =>
        user.TimeZone is not null && TimeZoneInfo.TryFindSystemTimeZoneById(user.TimeZone, out var tz)
            ? tz
            : TimeZoneInfo.Utc;

    public static DateOnly LocalDate(User user, DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneFor(user)));

    // [start, end) of a local day, in UTC
    public static (DateTime Start, DateTime End) LocalDayBoundsUtc(User user, DateOnly date)
    {
        var tz = TimeZoneFor(user);
        var start = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), tz);
        var end = TimeZoneInfo.ConvertTimeToUtc(date.AddDays(1).ToDateTime(TimeOnly.MinValue), tz);
        return (start, end);
    }

    // Settles every fully-past day since the streak was last extended: each missed day
    // spends a freeze (streak holds) or, with none left or freezes paused on the
    // project, resets the streak. Does nothing
    // without an active streak, so freezes are never spent protecting nothing, or while the
    // streak is paused (for review, or globally by an admin). Caller saves, then passes
    // the result to StreakNotifications.
    public async Task<StreakChange> ReconcileAsync(Project project, User user, DateOnly today, CancellationToken ct = default)
    {
        if (project.StreakCount == 0 || project.LastStreakDate is null) return StreakChange.None;
        if (InReview(project.Status)) return StreakChange.None;
        if (await _settings.StreaksPausedAsync(ct)) return StreakChange.None;

        var freezesUsed = 0;
        for (var day = project.LastStreakDate.Value.AddDays(1); day < today; day = day.AddDays(1))
        {
            if (user.StreakFreezes <= 0 || project.StreakFreezesPaused)
            {
                var lost = project.StreakCount;
                project.StreakCount = 0;
                project.LastStreakDate = null;
                return new StreakChange(freezesUsed, lost, project.StreakFreezesPaused, ReachedMax: false);
            }

            user.StreakFreezes--;
            freezesUsed++;
            await UpsertDayAsync(project.Id, day, StreakDayStatus.Frozen, trackedSeconds: null, ct);
            project.LastStreakDate = day;
        }
        return StreakChange.None with { FreezesUsed = freezesUsed };
    }

    // Called after a journal is saved: settles missed days, totals the journal's local day
    // and extends the streak the first time that day reaches 1h. Caller saves.
    public async Task<StreakChange> RecordJournalAsync(Devlog devlog, Project project, User user, CancellationToken ct = default)
    {
        var today = LocalDate(user, devlog.CreatedAt);
        var change = await ReconcileAsync(project, user, today, ct);

        var (start, end) = LocalDayBoundsUtc(user, today);
        // The new journal may not be saved yet, so add it on top of what's in the db.
        var trackedSeconds = devlog.TrackedSeconds + await _db.Devlogs
            .Where(d => d.ProjectId == project.Id && d.Id != devlog.Id && d.CreatedAt >= start && d.CreatedAt < end)
            .SumAsync(d => d.TrackedSeconds, ct);

        // >= rather than ==: an admin timezone change can put "today" behind the last
        // counted day, which mustn't count twice.
        var alreadyCounted = project.LastStreakDate >= today;
        var completed = alreadyCounted || trackedSeconds >= SecondsPerDay;

        await UpsertDayAsync(project.Id, today,
            completed ? StreakDayStatus.Completed : StreakDayStatus.Pending, trackedSeconds, ct);

        if (completed && !alreadyCounted)
        {
            var max = MaxStreakForLevel(project.Tier);
            var before = project.StreakCount;
            project.StreakCount = Math.Min(project.StreakCount + 1, max);
            project.LastStreakDate = today;
            if (before < max && project.StreakCount == max) change = change with { ReachedMax = true };
        }
        return change;
    }

    // trackedSeconds null = keep what the day already has (e.g. freezing a day that had
    // some, but under 1h, of journaled time).
    private async Task UpsertDayAsync(Guid projectId, DateOnly date, StreakDayStatus status, double? trackedSeconds, CancellationToken ct)
    {
        var day = _db.ProjectStreakDays.Local.FirstOrDefault(d => d.ProjectId == projectId && d.Date == date)
            ?? await _db.ProjectStreakDays.FirstOrDefaultAsync(d => d.ProjectId == projectId && d.Date == date, ct);

        if (day is null)
        {
            _db.ProjectStreakDays.Add(new ProjectStreakDay
            {
                ProjectId = projectId,
                Date = date,
                Status = status,
                TrackedSeconds = trackedSeconds ?? 0
            });
            return;
        }

        day.Status = status;
        if (trackedSeconds is not null) day.TrackedSeconds = trackedSeconds.Value;
    }
}

// What settling / journaling just did to a project's streak, for the Slack DMs.
// LostStreak is the streak's length before it reset (null = it didn't);
// LostWithFreezesPaused = it reset because freezes are paused on the project, not
// because the owner ran out.
public record StreakChange(int FreezesUsed, int? LostStreak, bool LostWithFreezesPaused, bool ReachedMax)
{
    public static readonly StreakChange None = new(0, null, false, false);
}
