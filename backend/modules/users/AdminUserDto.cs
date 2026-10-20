namespace Torque.Users;
// Everything about a user an admin can see (never the Hackatime token itself)
// Derived from User.cs
public record AdminUserDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string Bio { get; init; } = null!;
    public string? ProfilePictureUrl { get; init; }
    public string Name { get; init; } = null!;
    public string Email { get; init; } = null!;
    public int Volts { get; init; }
    public string? InternalNote { get; init; }
    public bool Watchlisted { get; init; }
    public string? Country { get; init; }
    public string? TimeZone { get; init; }
    public int StreakFreezes { get; init; }
    public bool HackatimeLinked { get; init; }
    public string[]? Role { get; init; }
    public bool Banned { get; init; }
    public string SlackUserID { get; init; } = null!;
    public string HcUserID { get; init; } = null!;
    public string HackatimeID { get; init; } = null!;
    public bool YswsEligible { get; init; }
    public bool VerificationStatus { get; init; }
    public bool CompletedFirstTimeSetup { get; init; }
    public DateTime CreatedAt { get; init; }

    public static AdminUserDto From(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        Bio = user.Bio,
        ProfilePictureUrl = user.ProfilePictureUrl,
        Name = user.Name,
        Email = user.Email,
        Volts = user.Volts,
        InternalNote = user.InternalNote,
        Watchlisted = user.Watchlisted,
        Country = user.Country,
        TimeZone = user.TimeZone,
        StreakFreezes = user.StreakFreezes,
        HackatimeLinked = user.HackatimeToken is not null,
        Role = user.Role,
        Banned = user.Role?.Contains("banned") == true,
        SlackUserID = user.SlackUserID,
        HcUserID = user.HcUserID,
        HackatimeID = user.HackatimeID,
        YswsEligible = user.YswsEligible,
        VerificationStatus = user.VerificationStatus,
        CompletedFirstTimeSetup = user.CompletedFirstTimeSetup,
        CreatedAt = user.CreatedAt
    };
}
