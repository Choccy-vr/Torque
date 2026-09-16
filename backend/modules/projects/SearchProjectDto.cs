namespace Torque.Projects;
// Minimized shape for search results (NO PII)
// endpoint: /api/project/search
public record SearchProjectDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public string OwnerUserId { get; init; } = null!;
    public ProjectStatus Status { get; init; } = ProjectStatus.Unshipped;
    public DateTime CreatedAt { get; init; }
}
