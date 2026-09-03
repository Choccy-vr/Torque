namespace Torque.Users;
// Entity model for Users
// db table: Users
public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Bio { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? ProfilePictureUrl { get; set; }
    public int Volts { get; set; }
    public float TotalTimeShipped { get; set; }
    public int TotalProjects { get; set; }
    public int TotalDevlogs { get; set; }
    public Guid[]? Projects { get; set; }
    public Guid[]? Devlogs { get; set; }
    public string SlackUserID { get; set; } = null!;
    public string Role { get; set; } = null!;
    public string HcUserID { get; set; } = null!;
    public string HackatimeID { get; set; } = null!;
    public bool YswsEligible { get; set; } = false;
    public bool VerificationStatus { get; set; } = false;
    public bool CompletedFirstTimeSetup { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}