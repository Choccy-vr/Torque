namespace Torque.Users;
// This is exposed to only reviewers
// Derived from User.cs
public record ReviewerProfileDto
{
    public Guid Id { get; init; }

    public string Username { get; init; } = null!;
    public string Bio { get; init; } = null!;
    public string? ProfilePictureUrl { get; init; }

    public string Name { get; init; } = null!;
    public string Email { get; init; } = null!;

    public int Volts { get; init; }

    public string? InternalNote { get; init; }
    public bool Watchlisted { get; init; } = false;

    public string? Country { get; init; }


    public string[]? Projects { get; init; }


    public string Role { get; init; } = null!;

    public string SlackUserID { get; init; } = null!;
    public string HcUserID { get; init; } = null!;
    public string HackatimeID { get; init; } = null!;

    public bool YswsEligible { get; init; } = false;
    public bool VerificationStatus { get; init; } = false;

    public bool CompletedFirstTimeSetup { get; init; } = false;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}