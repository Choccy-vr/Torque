namespace Torque.Projects;
// Inbound body for the admin project overrides.
// Omitted (null) fields are left unchanged.
public record UpdateAdminProjectDto
{
    // Level 1–4. Unlike the owner, an admin can change it after a final-approved ship.
    public int? Tier { get; init; }
    public bool? IsArchived { get; init; }
    public bool? Exceptional { get; init; }
}
