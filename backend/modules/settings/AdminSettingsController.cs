using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
using Torque.Streaks;
// Admin-only global settings (pausing ships, journaling, ...)
// endpoint: /api/admin/settings

namespace Torque.Settings;

[ApiController]
[Route("api/admin/settings")]
public class AdminSettingsController : ControllerBase
{
    private const int MaxMessageLength = 500;

    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly StreakService _streaks;

    public AdminSettingsController(AppDbContext db, SettingsService settings, StreakService streaks)
    {
        _db = db;
        _settings = settings;
        _streaks = streaks;
    }

    // Every setting, with its label, messages and who last changed it
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        var all = await _settings.AllAsync();
        return Ok(all.Select(s => AdminSettingDto.From(s.Definition, s.Row)));
    }

    // Switch a setting on/off and/or set its message
    [Authorize]
    [HttpPatch("{key}")]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateSettingDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        var definition = SettingKeys.Find(key);
        if (definition is null) return NotFound($"No setting called {key}.");

        if (dto.Paused is null && dto.Message is null)
        {
            return BadRequest("Nothing to update. Send paused and/or message.");
        }
        var message = dto.Message?.Trim();
        if (message is not null && message.Length > MaxMessageLength)
        {
            return BadRequest($"Message must be {MaxMessageLength} characters or fewer.");
        }

        var streaksWerePaused = await _settings.StreaksPausedAsync();
        var row = await _settings.ApplyAsync(definition, dto.Paused, message, userId.Value);
        // Ending a streak pause forgives the paused days, in the same save as the switch,
        // so the streak worker never sees the pause off with the days still unforgiven.
        if (streaksWerePaused && !await _settings.StreaksPausedAsync())
        {
            await _streaks.ResumeAllAfterPauseAsync();
        }
        await _db.SaveChangesAsync();

        return Ok(AdminSettingDto.From(definition, row));
    }
}
