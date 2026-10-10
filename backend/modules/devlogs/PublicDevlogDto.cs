namespace Torque.Projects;
// This is the data sent publicly
// Derived from Devlog.cs
public record PublicDevlogDto
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = null!;
    public string ProjectId { get; init; } = null!;

    public string Title { get; init; } = null!;
    public string Text { get; init; } = null!;

    public string[] ImageUrls { get; init; } = null!;

    // Hackatime hours this journal covers (max 10)
    public double TrackedHours { get; init; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}