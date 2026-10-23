using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Payouts;
using Torque.Slack;
// A controller for user data
// endpoint: /api/user/<command>

namespace Torque.Users;

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;
    private readonly SlackNotifier _slack;

    public UserController(AppDbContext db, PayoutService payouts, SlackNotifier slack)
    {
        _db = db;
        _payouts = payouts;
        _slack = slack;
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
            CompletedFirstTimeSetup = user.CompletedFirstTimeSetup,
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

    // First-time setup: pick a username, bio and profile picture, and mark setup as done.
    // Can be called again to change them.
    [Authorize]
    [HttpPut("me/onboarding")]
    public async Task<IActionResult> Onboard([FromBody] OnboardingDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var username = dto.Username?.Trim() ?? "";
        var bio = dto.Bio?.Trim() ?? "";
        var profilePictureUrl = string.IsNullOrWhiteSpace(dto.ProfilePictureUrl) ? null : dto.ProfilePictureUrl.Trim();

        if (username.Length is < MinUsernameLength or > MaxUsernameLength || !username.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-'))
        {
            return BadRequest($"Username must be {MinUsernameLength}–{MaxUsernameLength} characters: letters, numbers, _ or -.");
        }
        if (bio.Length > MaxBioLength)
        {
            return BadRequest($"Bio must be {MaxBioLength} characters or fewer.");
        }
        if (profilePictureUrl is not null && !IsHttpUrl(profilePictureUrl))
        {
            return BadRequest("ProfilePictureUrl must be an http(s) URL.");
        }

        var lowered = username.ToLower();
        if (await _db.Users.AnyAsync(u => u.Id != user.Id && u.Username.ToLower() == lowered))
        {
            return Conflict("That username is taken.");
        }

        // Finishing setup for the first time is sign-up as far as the welcome DM goes.
        var firstTime = !user.CompletedFirstTimeSetup;

        user.Username = username;
        user.Bio = bio;
        user.ProfilePictureUrl = profilePictureUrl;
        user.CompletedFirstTimeSetup = true;
        await _db.SaveChangesAsync();

        if (firstTime) _slack.Send(user.SlackUserID, SlackMessages.Welcome(user.Username));

        return Ok(new
        {
            username = user.Username,
            bio = user.Bio,
            profilePictureUrl = user.ProfilePictureUrl,
            completedFirstTimeSetup = user.CompletedFirstTimeSetup
        });
    }

    private const int MinUsernameLength = 3;
    private const int MaxUsernameLength = 30;
    private const int MaxBioLength = 500;
    private const int MaxUrlLength = 2048;

    private static bool IsHttpUrl(string url) =>
        url.Length <= MaxUrlLength
        && Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

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

        // reason: "hackatime" (appeal to the Fraud Squad) or "other" (anything else).
        var banned = user.Role?.Contains("banned") == true;
        return Ok(new { banned, reason = banned ? (user.BanReason == "hackatime" ? "hackatime" : "other") : null });
    }
}
