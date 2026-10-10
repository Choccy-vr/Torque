namespace Torque.Users;
// Entity model for Users
// db table: Users
public class User
{
    public Guid Id { get; set; }

    public string Username { get; set; } = null!;
    public string Bio { get; set; } = null!;
    public string? ProfilePictureUrl { get; set; }

    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;

    public int Volts { get; set; }

    public string? InternalNote { get; set; }
    public bool Watchlisted { get; set; } = false;

    public string? Country { get; set; }

    // IANA timezone id (e.g. "America/New_York") that defines the user's streak day
    // (12 AM–12 AM local). Null = not set yet, treated as UTC. The user can set it once;
    // after that only an admin can change it.
    public string? TimeZone { get; set; }

    // Each one excuses one missed streak day on one project. Readable by the user, never
    // writable through the API.
    public int StreakFreezes { get; set; } = 3;


    // Encrypted at rest (see Torque.Crypto.TokenEncryptor via AppDbContext) — never
    // expose this on a DTO.
    public string? HackatimeToken { get; set; }


    public Guid[]? Projects { get; set; }


    public string[]? Role { get; set; }

    public string SlackUserID { get; set; } = null!;
    public string HcUserID { get; set; } = null!;
    public string HackatimeID { get; set; } = null!;

    public bool YswsEligible { get; set; } = false;
    public bool VerificationStatus { get; set; } = false;

    public bool CompletedFirstTimeSetup { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}