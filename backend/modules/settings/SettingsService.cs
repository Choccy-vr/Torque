using Microsoft.AspNetCore.Mvc;
using Torque.Data;

namespace Torque.Settings;

// Reads and writes the global switches in app_settings. Lookups go through FindAsync,
// which checks the change tracker first, so a change applied but not yet saved in this
// request is already what the getters return.
public class SettingsService
{
    private readonly AppDbContext _db;
    public SettingsService(AppDbContext db) => _db = db;

    public async Task<bool> IsPausedAsync(string key, CancellationToken ct = default) =>
        (await _db.AppSettings.FindAsync([key], ct))?.BoolValue ?? false;

    // The message to show while the switch is on: the admin's, or the default.
    public async Task<string> MessageAsync(SettingDefinition definition, CancellationToken ct = default) =>
        (await _db.AppSettings.FindAsync([definition.Key], ct))?.Message ?? definition.DefaultMessage;

    // Whether missed streak days are being held off (streaks or journaling paused).
    public async Task<bool> StreaksPausedAsync(CancellationToken ct = default)
    {
        foreach (var key in SettingKeys.StreakPausing)
        {
            if (await IsPausedAsync(key, ct)) return true;
        }
        return false;
    }

    // Every known setting with its row (null = never set), in SettingKeys order.
    public async Task<List<(SettingDefinition Definition, AppSetting? Row)>> AllAsync(CancellationToken ct = default)
    {
        var rows = new List<(SettingDefinition, AppSetting?)>();
        foreach (var definition in SettingKeys.All)
        {
            rows.Add((definition, await _db.AppSettings.FindAsync([definition.Key], ct)));
        }
        return rows;
    }

    // Applies an admin's change. Null leaves that part as is; message "" goes back to
    // the default. Caller saves.
    public async Task<AppSetting> ApplyAsync(SettingDefinition definition, bool? paused, string? message, Guid adminId, CancellationToken ct = default)
    {
        var row = await _db.AppSettings.FindAsync([definition.Key], ct);
        if (row is null)
        {
            row = new AppSetting { Key = definition.Key };
            _db.AppSettings.Add(row);
        }

        if (paused is not null) row.BoolValue = paused.Value;
        if (message is not null) row.Message = message.Length == 0 ? null : message;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByUserId = adminId;
        return row;
    }

    // What a paused endpoint answers: 503 with the message to show and which switch
    // is on, so the frontend can tell a pause from any other failure.
    public static ObjectResult PausedResult(string key, string message) =>
        new(new { error = message, paused = key })
        {
            StatusCode = StatusCodes.Status503ServiceUnavailable
        };

    public async Task<ObjectResult?> PausedResultAsync(string key, CancellationToken ct = default)
    {
        if (!await IsPausedAsync(key, ct)) return null;
        var definition = SettingKeys.Find(key) ?? throw new ArgumentException($"Unknown setting {key}", nameof(key));
        return PausedResult(key, await MessageAsync(definition, ct));
    }
}
