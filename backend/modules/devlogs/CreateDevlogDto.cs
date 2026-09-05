namespace Torque.Projects;
// This is the data the client sends in to create a devlog
// Derived from Devlog.cs
public record CreateDevlogDto
{
    public string? ProjectId { get; init; }

    public string Title { get; init; } = null!;
    public string Text { get; init; } = null!;

    public string[] ImageUrls { get; init; } = null!;
}