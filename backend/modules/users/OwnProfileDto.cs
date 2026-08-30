namespace Torque.Users;
// This is exposed to only the owner of the account (Minimal PII)
// endpoint: /users/me
// Derived from User.cs
public record OwnProfileDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string Email { get; init; } = null!;
    public string Bio { get; init; } = null!;
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}