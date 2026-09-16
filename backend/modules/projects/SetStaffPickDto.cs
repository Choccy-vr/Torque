namespace Torque.Projects;
// Inbound body for the admin staff-pick toggle endpoint
public record SetStaffPickDto
{
    public bool IsStaffPick { get; init; }
}
