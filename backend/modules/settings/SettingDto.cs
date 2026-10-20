namespace Torque.Settings;
// Public view of one setting: whether it's on and what builders should be told
public record SettingDto
{
    public bool Paused { get; init; }
    // The admin's message if they wrote one, otherwise the default
    public string Message { get; init; } = null!;
}
