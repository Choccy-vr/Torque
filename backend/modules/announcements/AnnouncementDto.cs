namespace Torque.Announcements;
// This is the data sent publicly
// Derived from Announcement.cs
public record AnnouncementDto
{
    public Guid Id { get; init; }

    public string Title { get; init; } = null!;
    public string Body { get; init; } = null!;

    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}
