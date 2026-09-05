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
    public string Name { get; init; } = null!;
    public string? ProfilePictureUrl { get; init; }
    public int Volts { get; init; }
    public string[]? Projects { get; init; }
    public string SlackUserID { get; init; } = null!;
    public string Role { get; init; } = null!;
    public string HcUserID { get; init; } = null!;
    public string HackatimeID { get; init; } = null!;
    public bool YswsEligible { get; init; } = false;
    public bool VerificationStatus { get; init; } = false;
    public string? Country { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}