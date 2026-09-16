namespace Torque.Projects;
// Minimized shape for leaderboard entries (NO PII)
// endpoints: /api/project/leaderboard/hours, /api/project/leaderboard/volts
public record LeaderboardProjectDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = null!;
    public string OwnerUserId { get; init; } = null!;
    public float TotalHoursRaw { get; init; }
    public int VoltsGranted { get; init; }
}
