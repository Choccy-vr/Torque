using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Streaks;
// Admin-only project moderation actions
// endpoint: /api/admin/project/<command>

namespace Torque.Projects;

[ApiController]
[Route("api/admin/project")]
public class AdminProjectController : ControllerBase
{
    private const int MaxResults = 50;

    private readonly AppDbContext _db;
    public AdminProjectController(AppDbContext db) => _db = db;

    // Search every project (any status, archived too) by title, id or owner username,
    // newest first. Filters: status, ownerId, archived. No query lists the newest.
    [Authorize]
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] ProjectStatus? status, [FromQuery] Guid? ownerId, [FromQuery] bool? archived)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var projects = _db.Projects.AsQueryable();
        if (status is not null) projects = projects.Where(p => p.Status == status);
        if (ownerId is not null) projects = projects.Where(p => p.OwnerUserId == ownerId);
        if (archived is not null) projects = projects.Where(p => p.IsArchived == archived);

        var query = q?.Trim();
        if (!string.IsNullOrEmpty(query))
        {
            if (Guid.TryParse(query, out var id))
            {
                projects = projects.Where(p => p.Id == id || p.OwnerUserId == id);
            }
            else
            {
                var pattern = $"%{query}%";
                projects = projects.Where(p =>
                    EF.Functions.ILike(p.Title, pattern) ||
                    _db.Users.Any(u => u.Id == p.OwnerUserId && EF.Functions.ILike(u.Username, pattern)));
            }
        }

        var results = await projects
            .OrderByDescending(p => p.CreatedAt)
            .Take(MaxResults)
            .Select(p => new AdminProjectSummaryDto
            {
                Id = p.Id,
                Title = p.Title,
                OwnerUserId = p.OwnerUserId,
                OwnerUsername = _db.Users.Where(u => u.Id == p.OwnerUserId).Select(u => u.Username).FirstOrDefault() ?? "",
                Status = p.Status,
                Tier = p.Tier,
                TotalHours = p.TotalHoursRaw,
                TotalHoursApproved = p.TotalHoursApproved,
                VoltsGranted = p.VoltsGranted,
                GrantStatus = p.GrantStatus,
                IsArchived = p.IsArchived,
                IsStaffPick = p.IsStaffPick,
                CoverImageUrl = p.CoverImageUrl,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }

    // Everything about one project, including the private fields
    [Authorize]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        return Ok(AdminProjectDto.From(project, await UsernameAsync(project.OwnerUserId) ?? "", await UsernameAsync(project.ClaimedByReviewer)));
    }

    // Override a project's level, archive state or exceptional flag
    [Authorize]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAdminProjectDto dto)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        if (dto.Tier is null && dto.IsArchived is null && dto.Exceptional is null)
        {
            return BadRequest("Nothing to update. Send tier, isArchived and/or exceptional.");
        }
        if (dto.Tier is not null and not (>= 1 and <= 4)) return BadRequest("Tier must be 1–4.");

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        if (dto.IsArchived == true && !project.IsArchived)
        {
            if (StreakService.InReview(project.Status)) return Conflict("This project can't be archived while it's in review.");

            project.IsArchived = true;
            project.ArchivedAt = DateTime.UtcNow;
            // Same as the owner archiving it: drop the streak so no freezes are spent on it
            project.StreakCount = 0;
            project.LastStreakDate = null;
        }
        else if (dto.IsArchived == false && project.IsArchived)
        {
            project.IsArchived = false;
            project.ArchivedAt = null;
        }
        if (dto.Tier is not null)
        {
            project.Tier = dto.Tier.Value;
            // A lower level can have a lower max streak
            project.StreakCount = Math.Min(project.StreakCount, StreakService.MaxStreakForLevel(project.Tier));
        }
        if (dto.Exceptional is not null) project.Exceptional = dto.Exceptional.Value;
        await _db.SaveChangesAsync();

        return Ok(AdminProjectDto.From(project, await UsernameAsync(project.OwnerUserId) ?? "", await UsernameAsync(project.ClaimedByReviewer)));
    }

    private Task<string?> UsernameAsync(Guid userId) =>
        _db.Users.Where(u => u.Id == userId).Select(u => (string?)u.Username).FirstOrDefaultAsync();

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
            CoverImageUrl = project.CoverImageUrl,
            Status = project.Status,
            GrantStatus = project.GrantStatus,
            TotalHours = project.TotalHoursRaw,
            VoltsGranted = project.VoltsGranted,
            AiUse = project.AiUse,
            DevlogIds = project.DevlogIds,
            Exceptional = project.Exceptional,
            IsStaffPick = project.IsStaffPick,
            IsArchived = project.IsArchived,
            ArchivedAt = project.ArchivedAt,
            Streak = StreakService.EffectiveStreak(project.StreakCount, project.Tier),
            MaxStreak = StreakService.MaxStreakForLevel(project.Tier),
            CreatedAt = project.CreatedAt
        });
    }
}
