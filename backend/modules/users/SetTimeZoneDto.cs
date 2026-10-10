namespace Torque.Users;
// Body for setting a user's streak timezone
public record SetTimeZoneDto
{
    // IANA timezone id, e.g. "America/New_York"
    public string? TimeZone { get; init; }
}
