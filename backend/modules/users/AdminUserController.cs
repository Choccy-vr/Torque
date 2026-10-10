using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
// Admin-only user moderation actions
// endpoint: /api/admin/user/<command>

namespace Torque.Users;

[ApiController]
[Route("api/admin/user")]
public class AdminUserController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminUserController(AppDbContext db) => _db = db;

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
}
