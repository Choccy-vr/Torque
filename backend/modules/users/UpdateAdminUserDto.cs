namespace Torque.Users;
// Inbound body for the admin edit-user endpoint.
// Omitted (null) fields are left unchanged; InternalNote "" clears it.
public record UpdateAdminUserDto
{
    public string? InternalNote { get; init; }
    public bool? Watchlisted { get; init; }
    public int? StreakFreezes { get; init; }
}
