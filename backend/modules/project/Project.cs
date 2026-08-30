namespace Torque.Entities;

public class Project
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}