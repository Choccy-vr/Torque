namespace Torque.Projects;
// This is exposed to owner and reviewers
// Derived from Project.cs
public record PrivateProjectDto
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = null!;

    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int Tier { get; init; }

    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }

    public string ClaimedByReviewer { get; init; } = null!;
    public DateTime ClaimedAt { get; init; }

    public string[]? HackatimeProjectNames { get; init; }

    public string[]? DevlogIds { get; init; }

    public ProjectStatus Status { get; init; } = ProjectStatus.Unshipped;

    public float TrackedDesignHours { get; init; } = 0;// hours spent on design stage
    public float TrackedBuildHours { get; init; } = 0;// hours spent on build stage
    public float TotalHoursRaw { get; init; } = 0;// raw total hours tracked
    public float TotalHoursApproved { get; init; } = 0;// total hours tracked approved

    public string? AiUse { get; init; }

    public int VoltsGranted { get; init; } = 0;



    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

}