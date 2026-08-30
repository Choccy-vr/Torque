namespace Torque.Projects;
// This is exposed publicly (NO PII)
// endpoint: /project/{id}
// Derived from Project.cs
public record PublicProjectDto
{
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

}