namespace Torque.Projects;
// Minimized shape for search results (NO PII)
// endpoint: /api/project/search
public record SearchProjectDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int Tier { get; init; }
    public string OwnerUserId { get; init; } = null!;
    public string? OwnerUsername { get; init; }
    public string? CoverImageUrl { get; init; }
    public float TotalHours { get; init; }
    public int VoltsGranted { get; init; }
    public ProjectStatus Status { get; init; } = ProjectStatus.Unshipped;
    public DateTime CreatedAt { get; init; }
}
