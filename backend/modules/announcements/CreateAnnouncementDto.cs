namespace Torque.Announcements;
// Inbound body for the admin create-announcement endpoint
public record CreateAnnouncementDto
{
    public string? Title { get; init; }
    // Markdown
    public string? Body { get; init; }
}
