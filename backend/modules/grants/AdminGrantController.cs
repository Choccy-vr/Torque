using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Projects;
// Admin-only build grant tracking. Grants are created when a design ship that requested
// funding is approved (see ReviewController.Create); sending the money is manual.
// endpoint: /api/admin/grants/<command>

namespace Torque.Grants;

[ApiController]
[Route("api/admin/grants")]
public class AdminGrantController : ControllerBase
{
    private const int MaxNoteLength = 2000;

    private readonly AppDbContext _db;
    public AdminGrantController(AppDbContext db) => _db = db;

    // List grants oldest first, optionally only fulfilled / unfulfilled ones
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool? fulfilled)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var admin = await _db.Users.FindAsync(userId);
        if (admin is null) return NotFound();

        if (admin.Role is null || !admin.Role.Contains("admin")) return Forbid();

        var grants = await _db.Grants
            .Where(g => fulfilled == null || g.Fulfilled == fulfilled)
            .OrderBy(g => g.CreatedAt)
            .Select(g => new AdminGrantDto
            {
                Id = g.Id,
                ShipmentId = g.ShipmentId,
                ProjectId = g.ProjectId,
                ProjectTitle = _db.Projects.Where(p => p.Id == g.ProjectId).Select(p => p.Title).FirstOrDefault() ?? "",
                UserId = g.UserId,
                Username = _db.Users.Where(u => u.Id == g.UserId).Select(u => u.Username).FirstOrDefault() ?? "",
                Amount = g.Amount,
                Fulfilled = g.Fulfilled,
                FulfilledByUserId = g.FulfilledByUserId,
                FulfilledAt = g.FulfilledAt,
                Note = g.Note,
                CreatedAt = g.CreatedAt
            })
            .ToListAsync();

        return Ok(grants);
    }

    // Tick/untick a grant as fulfilled. Ticking unlocks the project's build ship.
    [Authorize]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateGrantDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var admin = await _db.Users.FindAsync(userId);
        if (admin is null) return NotFound();

        if (admin.Role is null || !admin.Role.Contains("admin")) return Forbid();

        if (dto.Fulfilled is null) return BadRequest("Fulfilled is required!");
        if (dto.Note?.Length > MaxNoteLength) return BadRequest($"Note can be at most {MaxNoteLength} characters.");

        var grant = await _db.Grants.FindAsync(id);
        if (grant is null) return NotFound();

        var project = await _db.Projects.FindAsync(grant.ProjectId);
        if (project is null) return NotFound();

        if (dto.Fulfilled.Value && !grant.Fulfilled)
        {
            grant.Fulfilled = true;
            grant.FulfilledByUserId = userId.Value;
            grant.FulfilledAt = DateTime.UtcNow;
            if (project.Status == ProjectStatus.Build_Grant_Pending) project.Status = ProjectStatus.Build_Grant_Fulfilled;
        }
        else if (!dto.Fulfilled.Value && grant.Fulfilled)
        {
            grant.Fulfilled = false;
            grant.FulfilledByUserId = null;
            grant.FulfilledAt = null;
            // Only while the build hasn't been shipped yet.
            if (project.Status == ProjectStatus.Build_Grant_Fulfilled) project.Status = ProjectStatus.Build_Grant_Pending;
        }
        if (dto.Note is not null) grant.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();

        await _db.SaveChangesAsync();

        return Ok(new AdminGrantDto
        {
            Id = grant.Id,
            ShipmentId = grant.ShipmentId,
            ProjectId = grant.ProjectId,
            ProjectTitle = project.Title,
            UserId = grant.UserId,
            Username = (await _db.Users.FindAsync(grant.UserId))?.Username ?? "",
            Amount = grant.Amount,
            Fulfilled = grant.Fulfilled,
            FulfilledByUserId = grant.FulfilledByUserId,
            FulfilledAt = grant.FulfilledAt,
            Note = grant.Note,
            CreatedAt = grant.CreatedAt
        });
    }
}
