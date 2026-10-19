namespace Torque.Users;
// Inbound body for the admin ban/unban toggle
public record SetBannedDto
{
    public bool? Banned { get; init; }
}
