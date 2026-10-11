namespace Torque.Projects;
// This is exposed publicly (NO PII)
// endpoint: /project/{id}
// Derived from Project.cs
public record PublicProjectDto
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = null!;

    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int Tier { get; init; }

    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }

    public ProjectStatus Status { get; init; } = ProjectStatus.Unshipped;
    public ProjectGrantStatus GrantStatus { get; init; } = ProjectGrantStatus.None;

    public float TotalHours { get; init; } = 0;// raw total hours tracked

    public string? AiUse { get; init; }

    public string[]? DevlogIds { get; init; }

    public bool Exceptional { get; init; } = false; // Black Market

    public bool IsStaffPick { get; init; } = false;

    // Daily streak (capped at the level's max) and that max — see Torque.Streaks
    public int Streak { get; init; }
    public int MaxStreak { get; init; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

}