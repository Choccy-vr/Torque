namespace Torque.Projects;
// This is the data the client sends in to create a project
// Derived from Project.cs
public record CreateProjectDto
{
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int? Tier { get; init; } // level 1–4, required

    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }
    public string? CoverImageUrl { get; init; } // http(s) image URL shown at the top of the project page

    public string[]? HackatimeProjectNames { get; init; }

    public string? AiUse { get; init; }
}
