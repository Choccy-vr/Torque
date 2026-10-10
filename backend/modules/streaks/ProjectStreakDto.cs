namespace Torque.Streaks;
// A project's streak, exposed publicly
// endpoint: /project/{id}/streak
public record ProjectStreakDto
{
    public Guid ProjectId { get; init; }
    public int Streak { get; init; }
    public int MaxStreak { get; init; }
    public decimal Multiplier { get; init; }
    public DateOnly? LastStreakDate { get; init; }
    public ProjectStreakDayDto[] Days { get; init; } = [];
}

public record ProjectStreakDayDto
{
    public DateOnly Date { get; init; }
    public StreakDayStatus Status { get; init; }
    public double TrackedHours { get; init; }
}
