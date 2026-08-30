namespace Torque.Entities;

public class User
{
    public Guid Id { get; set; }
    public string name { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}