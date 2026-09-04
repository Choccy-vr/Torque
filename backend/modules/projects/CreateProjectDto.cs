namespace Torque.Projects;
// This is the data the client sends in to create a project
// Derived from Project.cs
public record CreateProjectDto
{
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int Tier { get; init; }

    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }

    public string[]? HackatimeProjectNames { get; init; }
}