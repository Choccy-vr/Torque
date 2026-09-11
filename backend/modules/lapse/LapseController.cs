using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
// Reviewer-only lookup of a project owner's Lapse timelapses (lapse.hackclub.com)
// endpoint: /api/admin/project/{id}/lapse

namespace Torque.Lapse;

[ApiController]
[Route("api/admin/project")]
public class LapseController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LapseService _lapse;
    public LapseController(AppDbContext db, LapseService lapse)
    {
        _db = db;
        _lapse = lapse;
    }

    // Timelapses for a project's owner, filtered to the project's linked Hackatime
    // project names. Always returns { timelapses: [...] } — empty means "show nothing".
    [Authorize]
    [HttpGet("{id:guid}/lapse")]
    public async Task<IActionResult> GetTimelapses(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var reviewer = await _db.Users.FindAsync(userId);
        if (reviewer is null) return NotFound();
        if (reviewer.Role is null || !reviewer.Role.Contains("reviewer")) return Forbid();

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        var names = project.HackatimeProjectNames ?? [];
        var owner = await _db.Users.FindAsync(project.OwnerUserId);
        if (string.IsNullOrEmpty(owner?.Email) || names.Length == 0)
        {
            return Ok(new { timelapses = Array.Empty<TimelapseDto>() });
        }

        var timelapses = await _lapse.FindForProjectAsync(owner.Email, names);
        return Ok(new { timelapses });
    }
}
