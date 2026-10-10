namespace Torque.Announcements;
// Entity model for Announcements (news posted by admins on the dashboard)
// db table: announcements
public class Announcement
{
    public Guid Id { get; set; }
    public Guid AuthorUserId { get; set; }

    public string Title { get; set; } = null!;
    // Markdown, rendered by the frontend
    public string Body { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    // Set whenever an admin edits it; null if never edited
    public DateTime? UpdatedAt { get; set; }
}
