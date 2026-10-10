using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Payouts;
// Admin-only user moderation actions
// endpoint: /api/admin/user/<command>

namespace Torque.Users;

[ApiController]
[Route("api/admin/user")]
public class AdminUserController : ControllerBase
{
    private const int MaxReasonLength = 500;

    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;

    public AdminUserController(AppDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

    // Change a user's streak timezone (users can only set it once themselves)
    [Authorize]
    [HttpPatch("{id:guid}/timezone")]
    public async Task<IActionResult> SetTimeZone(Guid id, [FromBody] SetTimeZoneDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var admin = await _db.Users.FindAsync(userId);
        if (admin is null) return NotFound();

        if (admin.Role is null || !admin.Role.Contains("admin")) return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.TimeZone) || !TimeZoneInfo.TryFindSystemTimeZoneById(dto.TimeZone, out _))
        {
            return BadRequest("TimeZone must be a valid IANA timezone id, e.g. \"America/New_York\".");
        }

        user.TimeZone = dto.TimeZone;
        await _db.SaveChangesAsync();

        return Ok(new { id = user.Id, timeZone = user.TimeZone });
    }

    // A user's Volts balance and history, newest first
    [Authorize]
    [HttpGet("{id:guid}/volts/history")]
    public async Task<IActionResult> GetVoltsHistory(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var admin = await _db.Users.FindAsync(userId);
        if (admin is null) return NotFound();

        if (admin.Role is null || !admin.Role.Contains("admin")) return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        return Ok(new { id = user.Id, volts = user.Volts, entries = await _payouts.HistoryAsync(user.Id) });
    }

    // Manually credit (positive) or debit (negative) a user's Volts, with a reason
    [Authorize]
    [HttpPost("{id:guid}/volts")]
    public async Task<IActionResult> AdjustVolts(Guid id, [FromBody] AdjustVoltsDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var admin = await _db.Users.FindAsync(userId);
        if (admin is null) return NotFound();

        if (admin.Role is null || !admin.Role.Contains("admin")) return Forbid();

        if (dto.Amount is null or 0) return BadRequest("Amount is required and can't be 0!");
        if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest("Reason is required!");
        if (dto.Reason.Length > MaxReasonLength) return BadRequest($"Reason can be at most {MaxReasonLength} characters.");

        if (!await _db.Users.AnyAsync(u => u.Id == id)) return NotFound();

        var volts = await _payouts.AdjustAsync(id, dto.Amount.Value, dto.Reason.Trim(), userId.Value);
        if (volts is null) return BadRequest("That would take the user's Volts below 0.");

        return Ok(new { id, volts });
    }
}
