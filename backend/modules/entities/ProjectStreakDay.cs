namespace Torque.Streaks;
// One owner-local day of a project's streak, either earned (1+ journaled hour) or
// covered by a streak freeze.
// db table: project_streak_days
public class ProjectStreakDay
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }

    // Calendar day in the owner's timezone
    public DateOnly Date { get; set; }
    public StreakDayStatus Status { get; set; }

    // Sum of the day's journals' TrackedSeconds (0 for frozen days)
    public double TrackedSeconds { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public enum StreakDayStatus
{
    Pending,
    Completed,
    Frozen
}
