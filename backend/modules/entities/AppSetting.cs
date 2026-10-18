namespace Torque.Settings;
// Entity model for global settings: admin-flipped switches that aren't tied to any
// one record (e.g. pausing ships to clear the review queue). See SettingKeys.
// db table: app_settings — one row per key; a missing row means the switch is off
public class AppSetting
{
    public string Key { get; set; } = null!;
    public bool BoolValue { get; set; }
    // Admin-written text shown instead of the setting's default message; null = default
    public string? Message { get; set; }

    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}
