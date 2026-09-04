namespace Torque.Projects;
// This is the data sent publicly
// Derived from Devlog.cs
public record PublicDevlogDto
{
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public Guid ProjectId { get; init; }

    public string Title { get; init; } = null!;
    public string Text { get; init; } = null!;

    public string[] ImageUrls { get; init; } = null!;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}