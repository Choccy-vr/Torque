namespace Torque.Settings;
// Inbound body for the admin edit-setting endpoint.
// Omitted (null) fields are left unchanged; Message "" goes back to the default.
public record UpdateSettingDto
{
    public bool? Paused { get; init; }
    public string? Message { get; init; }
}
