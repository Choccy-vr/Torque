namespace Torque.Users;
// Body for first-time setup (username, bio, profile picture)
public record OnboardingDto
{
    public string? Username { get; init; }
    public string? Bio { get; init; }
    public string? ProfilePictureUrl { get; init; } // http(s) image URL; null/"" clears it
}
