namespace Torque.Devlogs;

public class Devlog
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public Guid ProjectId { get; set; }

    public string Title { get; set; } = null!;
    public string Text { get; set; } = null!;

    public string[] ImageUrls { get; set; } = null!;

    public bool Approved { get; set; } = false;
    public float? ApprovedHours { get; set; }
    public Guid ApprovedByReviewerId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}