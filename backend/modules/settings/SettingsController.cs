using Microsoft.AspNetCore.Mvc;
// Public read of the global settings, so the frontend can show what's paused
// endpoint: /api/settings

namespace Torque.Settings;

[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly SettingsService _settings;
    public SettingsController(SettingsService settings) => _settings = settings;

    // Every setting, keyed by its key: { "ships_paused": { paused, message }, ... }
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var all = await _settings.AllAsync();
        return Ok(all.ToDictionary(
            s => s.Definition.Key,
            s => new SettingDto
            {
                Paused = s.Row?.BoolValue ?? false,
                Message = s.Row?.Message ?? s.Definition.DefaultMessage
            }));
    }
}
