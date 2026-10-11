namespace Torque.Projects;
// Inbound body for the owner's archive/unarchive toggle
public record SetArchivedDto
{
    public bool IsArchived { get; init; }
}
