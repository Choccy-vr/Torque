using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
// Admin-only project moderation actions
// endpoint: /api/admin/project/<command>

namespace Torque.Projects;

[ApiController]
[Route("api/admin/project")]
public class AdminProjectController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminProjectController(AppDbContext db) => _db = db;

    // Mark/unmark a project as a staff pick
    [Authorize]
    [HttpPost("{id:guid}/staff-pick")]
    public async Task<IActionResult> SetStaffPick(Guid id, [FromBody] SetStaffPickDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        project.IsStaffPick = dto.IsStaffPick;
        await _db.SaveChangesAsync();

        return Ok(new PublicProjectDto
        {
            Id = project.Id,
            OwnerUserId = project.OwnerUserId.ToString(),
            Title = project.Title,
            Description = project.Description,
            Tier = project.Tier,
            RepoUrl = project.RepoUrl,
            DemoUrl = project.DemoUrl,
            ReadmeUrl = project.ReadmeUrl,
            Status = project.Status,
            TotalHours = project.TotalHoursRaw,
            AiUse = project.AiUse,
            DevlogIds = project.DevlogIds,
            Exceptional = project.Exceptional,
            IsStaffPick = project.IsStaffPick,
            CreatedAt = project.CreatedAt
        });
    }
}
