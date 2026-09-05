namespace Torque.Projects;
// This is the data the client sends in to fetch devlogs in bulk
public record BatchDevlogDto
{
    public string[] Ids { get; init; } = null!;
}
