namespace Torque.Projects;
// Inbound body for the owner's project edit. Every field is optional: null/omitted
// leaves it unchanged, and "" clears an optional text field.
public record UpdateProjectDto
{
    public string? Title { get; init; }
    public string? Description { get; init; }
    public int? Tier { get; init; }

    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }

    // Replaces the whole list; [] unlinks every Hackatime project
    public string[]? HackatimeProjectNames { get; init; }

    public string? AiUse { get; init; }
}
