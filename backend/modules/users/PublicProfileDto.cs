namespace Torque.Users;
// This is exposed publicly (NO PII)
// endpoint: /users/{id}
// Derived from User.cs
public record PublicProfileDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string Bio { get; init; } = null!;
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}