namespace Torque.Announcements;
// Inbound body for the admin edit-announcement endpoint.
// Omitted (null) fields are left unchanged.
public record UpdateAnnouncementDto
{
    public string? Title { get; init; }
    // Markdown
    public string? Body { get; init; }
}
