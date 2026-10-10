using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
using Torque.Payouts;
// A controller for user data
// endpoint: /api/user/<command>

namespace Torque.Users;

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;

    public UserController(AppDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

    // Public profile for any user, no PII
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        return Ok(new PublicProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Bio = user.Bio,
            ProfilePictureUrl = user.ProfilePictureUrl,
            Volts = user.Volts,
            Projects = user.Projects?.Select(p => p.ToString()).ToArray(),
            SlackUserID = user.SlackUserID,
            CreatedAt = user.CreatedAt
        });
    }

    // Own profile for the authenticated user
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new OwnProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Bio = user.Bio,
            Name = user.Name,
            ProfilePictureUrl = user.ProfilePictureUrl,
            Volts = user.Volts,
            Projects = user.Projects?.Select(p => p.ToString()).ToArray(),
            SlackUserID = user.SlackUserID,
            Role = user.Role,
            HcUserID = user.HcUserID,
            HackatimeID = user.HackatimeID,
            YswsEligible = user.YswsEligible,
            VerificationStatus = user.VerificationStatus,
            Country = user.Country,
            TimeZone = user.TimeZone,
            StreakFreezes = user.StreakFreezes,
            CreatedAt = user.CreatedAt
        });
    }

    // Own Volts balance and history (ship payouts, admin adjustments), newest first
    [Authorize]
    [HttpGet("volts/history")]
    public async Task<IActionResult> GetVoltsHistory()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { volts = user.Volts, entries = await _payouts.HistoryAsync(user.Id) });
    }

    // Set the timezone streak days are counted in. One-time only: changing it later could
    // gain or skip a day, so after the first set only an admin can change it.
    [Authorize]
    [HttpPut("me/timezone")]
    public async Task<IActionResult> SetTimeZone([FromBody] SetTimeZoneDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.TimeZone is not null)
        {
            return Conflict("Timezone is already set. Ask an admin to change it.");
        }
        if (string.IsNullOrWhiteSpace(dto.TimeZone) || !TimeZoneInfo.TryFindSystemTimeZoneById(dto.TimeZone, out _))
        {
            return BadRequest("TimeZone must be a valid IANA timezone id, e.g. \"America/New_York\".");
        }

        user.TimeZone = dto.TimeZone;
        await _db.SaveChangesAsync();

        return Ok(new { timeZone = user.TimeZone });
    }

    // Whether the authenticated user is currently banned. [AllowBanned] exempts this
    // one action from EnsureUserExistsFilter's blanket ban block, since its entire
    // purpose is to be reachable while banned — otherwise a banned user gets nothing
    // but an opaque 403 from every endpoint they try.
    [Authorize]
    [AllowBanned]
    [HttpGet("me/banned")]
    public async Task<IActionResult> GetBanStatus()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { banned = user.Role?.Contains("banned") == true });
    }
}
