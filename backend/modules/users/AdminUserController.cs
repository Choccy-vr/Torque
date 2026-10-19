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
    private const int MaxNoteLength = 5000;
    private const int MaxResults = 50;
    private const int MaxStreakFreezes = 100;
    // Staff roles an admin can hand out. "banned" also lives in Role but has its own endpoint.
    public static readonly string[] AssignableRoles = ["admin", "reviewer"];

    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;

    public AdminUserController(AppDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

    // Search users by username, name, email, Slack ID or Hackatime/HC id (or an exact user
    // id), newest first. No query lists the newest users.
    [Authorize]
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var users = _db.Users.AsQueryable();
        var query = q?.Trim();
        if (!string.IsNullOrEmpty(query))
        {
            if (Guid.TryParse(query, out var id))
            {
                users = users.Where(u => u.Id == id);
            }
            else
            {
                var pattern = $"%{query}%";
                users = users.Where(u =>
                    EF.Functions.ILike(u.Username, pattern) ||
                    EF.Functions.ILike(u.Name, pattern) ||
                    EF.Functions.ILike(u.Email, pattern) ||
                    EF.Functions.ILike(u.SlackUserID, pattern) ||
                    EF.Functions.ILike(u.HcUserID, pattern) ||
                    EF.Functions.ILike(u.HackatimeID, pattern));
            }
        }

        var results = await users
            .OrderByDescending(u => u.CreatedAt)
            .Take(MaxResults)
            .Select(u => new AdminUserSummaryDto
            {
                Id = u.Id,
                Username = u.Username,
                Name = u.Name,
                Email = u.Email,
                ProfilePictureUrl = u.ProfilePictureUrl,
                SlackUserID = u.SlackUserID,
                Role = u.Role,
                Volts = u.Volts,
                Watchlisted = u.Watchlisted,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }

    // Everything about one user (never the Hackatime token)
    [Authorize]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        return Ok(AdminUserDto.From(user));
    }

    // Edit a user's internal note, watchlist flag and streak freezes
    [Authorize]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAdminUserDto dto)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.InternalNote is null && dto.Watchlisted is null && dto.StreakFreezes is null)
        {
            return BadRequest("Nothing to update. Send internalNote, watchlisted and/or streakFreezes.");
        }
        if (dto.InternalNote?.Length > MaxNoteLength) return BadRequest($"InternalNote can be at most {MaxNoteLength} characters.");
        if (dto.StreakFreezes is < 0 or > MaxStreakFreezes) return BadRequest($"StreakFreezes must be 0–{MaxStreakFreezes}.");

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (dto.InternalNote is not null) user.InternalNote = string.IsNullOrWhiteSpace(dto.InternalNote) ? null : dto.InternalNote.Trim();
        if (dto.Watchlisted is not null) user.Watchlisted = dto.Watchlisted.Value;
        if (dto.StreakFreezes is not null) user.StreakFreezes = dto.StreakFreezes.Value;
        await _db.SaveChangesAsync();

        return Ok(AdminUserDto.From(user));
    }

    // Ban/unban a user. A ban is a "banned" entry in Role, which EnsureUserExistsFilter
    // turns into a 403 on every endpoint except [AllowBanned] ones.
    [Authorize]
    [HttpPost("{id:guid}/ban")]
    public async Task<IActionResult> SetBanned(Guid id, [FromBody] SetBannedDto dto)
    {
        var (admin, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.Banned is null) return BadRequest("Banned is required!");
        if (id == admin!.Id) return BadRequest("You can't ban yourself.");

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        var roles = (user.Role ?? []).Where(r => r != "banned");
        user.Role = dto.Banned.Value ? [.. roles, "banned"] : [.. roles];
        await _db.SaveChangesAsync();

        return Ok(AdminUserDto.From(user));
    }

    // Replace a user's staff roles (admin, reviewer). A ban is kept as is.
    [Authorize]
    [HttpPut("{id:guid}/roles")]
    public async Task<IActionResult> SetRoles(Guid id, [FromBody] SetRolesDto dto)
    {
        var (admin, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.Roles is null) return BadRequest("Roles is required (send [] to remove every role).");
        var roles = dto.Roles.Select(r => r.Trim().ToLowerInvariant()).Distinct().ToArray();
        var unknown = roles.Where(r => !AssignableRoles.Contains(r)).ToArray();
        if (unknown.Length > 0) return BadRequest($"Unknown role(s): {string.Join(", ", unknown)}. Roles can be: {string.Join(", ", AssignableRoles)}.");
        if (id == admin!.Id && !roles.Contains("admin")) return BadRequest("You can't remove your own admin role.");

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        var banned = user.Role?.Contains("banned") == true;
        user.Role = banned ? [.. roles, "banned"] : roles;
        await _db.SaveChangesAsync();

        return Ok(AdminUserDto.From(user));
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
