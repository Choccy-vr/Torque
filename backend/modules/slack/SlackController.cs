using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Torque.Data;
using Torque.Extensions;
// A controller for the Slack channels users can add themselves to
// endpoint: /api/slack/<command>

namespace Torque.Slack;

[ApiController]
[Route("api/slack")]
public class SlackController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SlackClient _slack;
    private readonly SlackOptions _options;

    public SlackController(AppDbContext db, SlackClient slack, SlackOptions options)
    {
        _db = db;
        _slack = slack;
        _options = options;
    }

    // The channels channels/join adds you to
    [Authorize]
    [HttpGet("channels")]
    public IActionResult GetChannels() => Ok(new { channelIds = _options.JoinChannelIds });

    // Invites the signed-in user to every channel in SLACK_JOIN_CHANNELS. Takes no body on
    // purpose: the Slack ID always comes from the caller's own account, so nobody can add
    // anyone else.
    [Authorize]
    [HttpPost("channels/join")]
    [EnableRateLimiting(SlackExtension.JoinRateLimit)]
    public async Task<IActionResult> JoinChannels()
    {
        if (!_options.Configured || _options.JoinChannelIds.Length == 0)
        {
            return StatusCode(503, "Slack channel join is not configured.");
        }

        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (string.IsNullOrWhiteSpace(user.SlackUserID))
        {
            return BadRequest("Your account has no Slack ID linked.");
        }

        var results = new List<object>();
        foreach (var channelId in _options.JoinChannelIds)
        {
            var status = await _slack.InviteAsync(channelId, user.SlackUserID);
            results.Add(new { channelId, status });
        }

        return Ok(new { results });
    }
}
