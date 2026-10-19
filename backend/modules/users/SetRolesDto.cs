namespace Torque.Users;
// Inbound body for setting a user's staff roles (AdminUserController.AssignableRoles).
// Replaces the whole set; a ban is kept as is (see the ban endpoint).
public record SetRolesDto
{
    public string[]? Roles { get; init; }
}
