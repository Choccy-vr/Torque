namespace Torque.Users;
// Entity model for Users
// db table: Users
public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Bio { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}