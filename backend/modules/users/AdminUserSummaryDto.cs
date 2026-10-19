namespace Torque.Users;
// One row of the admin user search
public record AdminUserSummaryDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string Email { get; init; } = null!;
    public string? ProfilePictureUrl { get; init; }
    public string SlackUserID { get; init; } = null!;
    public string[]? Role { get; init; }
    public int Volts { get; init; }
    public bool Watchlisted { get; init; }
    public DateTime CreatedAt { get; init; }
}
