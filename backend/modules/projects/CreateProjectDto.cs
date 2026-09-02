namespace Torque.Projects;
// This is the data the client sends in to create a project
// Derived from Project.cs
public record CreateProjectDto
{
    public string Title { get; init; } = null!;
    public string? Description { get; init; }

}