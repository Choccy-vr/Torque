namespace Torque.Users;
// This is exposed publicly (NO PII)
// endpoint: /users/{id}
// Derived from User.cs
public record PublicProfileDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string Bio { get; init; } = null!;
    public string? ProfilePictureUrl { get; init; }
    public int Volts { get; init; }
    public float TotalTimeShipped { get; init; }
    public int TotalProjects { get; init; }
    public int TotalDevlogs { get; init; }
    public Guid[]? Projects { get; init; }
    public Guid[]? Devlogs { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}