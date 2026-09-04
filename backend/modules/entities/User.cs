namespace Torque.Projects;
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


    public string? HackatimeToken { get; set; } //encrypted


    public Guid[]? Projects { get; set; }


    public string Role { get; set; } = null!;

    public string SlackUserID { get; set; } = null!;
    public string HcUserID { get; set; } = null!;
    public string HackatimeID { get; set; } = null!;

    public bool YswsEligible { get; set; } = false;
    public bool VerificationStatus { get; set; } = false;

    public bool CompletedFirstTimeSetup { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}