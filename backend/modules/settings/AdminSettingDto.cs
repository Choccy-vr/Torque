namespace Torque.Settings;
// Admin view of one setting, for the toggle panel
public record AdminSettingDto
{
    public string Key { get; init; } = null!;
    public string Label { get; init; } = null!;
    public string Description { get; init; } = null!;
    public bool Paused { get; init; }
    public string Message { get; init; } = null!;
    // null = using DefaultMessage
    public string? CustomMessage { get; init; }
    public string DefaultMessage { get; init; } = null!;
    public DateTime? UpdatedAt { get; init; }
    public Guid? UpdatedByUserId { get; init; }

    public static AdminSettingDto From(SettingDefinition definition, AppSetting? row) => new()
    {
        Key = definition.Key,
        Label = definition.Label,
        Description = definition.Description,
        Paused = row?.BoolValue ?? false,
        Message = row?.Message ?? definition.DefaultMessage,
        CustomMessage = row?.Message,
        DefaultMessage = definition.DefaultMessage,
        UpdatedAt = row?.UpdatedAt,
        UpdatedByUserId = row?.UpdatedByUserId
    };
}
