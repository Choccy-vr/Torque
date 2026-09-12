using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Torque.Extensions;
// A controller for connecting a user's Hackatime account and reading their tracked time
// endpoint: /api/hackatime/<command>

namespace Torque.Hackatime;

[ApiController]
[Route("api/hackatime")]
public class HackatimeController : ControllerBase
{
    private readonly HackatimeService _hackatime;
    public HackatimeController(HackatimeService hackatime) => _hackatime = hackatime;

    // Generates the Hackatime OAuth authorize URL + a state value for the frontend to hold onto.
    [Authorize]
    [EnableRateLimiting("hackatime-auth")]
    [HttpPost("start")]
    public IActionResult Start()
    {
        if (!_hackatime.Configured) return StatusCode(503, "Hackatime OAuth is not configured.");

        var (url, state) = _hackatime.StartAuth();
        return Ok(new { url, state });
    }

    // Handles the Hackatime OAuth callback: state verification, code exchange, and
    // storing the connection (token + Hackatime user id) on the authenticated user.
    [Authorize]
    [EnableRateLimiting("hackatime-auth")]
    [HttpPost("callback")]
    public async Task<IActionResult> Callback([FromBody] HackatimeCallbackDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Code)) return BadRequest("Code is required.");
        if (string.IsNullOrWhiteSpace(dto.State) || string.IsNullOrWhiteSpace(dto.StoredState))
        {
            return BadRequest("State and StoredState are required.");
        }

        try
        {
            await _hackatime.HandleCallbackAsync(userId.Value, dto.Code, dto.State, dto.StoredState);
        }
        catch (HackatimeBannedException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
        catch (Exception)
        {
            return Unauthorized("Hackatime authentication failed.");
        }

        return Ok(new { success = true });
    }

    // Whether the authenticated user currently has a Hackatime account connected.
    [Authorize]
    [EnableRateLimiting("hackatime-read")]
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var connected = await _hackatime.IsConnectedAsync(userId.Value);
        return Ok(new { connected });
    }

    // The authenticated user's Hackatime project names, for picking which ones to link to a project.
    [Authorize]
    [EnableRateLimiting("hackatime-read")]
    [HttpGet("projects")]
    public async Task<IActionResult> GetProjects()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var names = await _hackatime.GetProjectNamesAsync(userId.Value);
        return Ok(new { projects = names });
    }

    // All-time hours (+ per-project breakdown) for a set of the authenticated user's linked Hackatime project names.
    [Authorize]
    [EnableRateLimiting("hackatime-read")]
    [HttpPost("hours")]
    public async Task<IActionResult> GetHours([FromBody] HackatimeHoursDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (dto.ProjectNames is not { Length: > 0 }) return BadRequest("ProjectNames are required.");

        var (hours, perProject) = await _hackatime.GetHoursForProjectsAsync(userId.Value, dto.ProjectNames);
        return Ok(new { hours, perProject });
    }
}
