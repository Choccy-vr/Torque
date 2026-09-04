using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
// A controller for project data
// endpoint: /api/project/<command>

namespace Torque.Projects;

[ApiController]
[Route("api/project")]
public class ProjectController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProjectController(AppDbContext db) => _db = db;

    // project by ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        return Ok(new PublicProjectDto
        {
            Id = project.Id,
            OwnerUserId = project.OwnerUserId,
            Title = project.Title,
            Description = project.Description,
            Tier = project.Tier,
            RepoUrl = project.RepoUrl,
            DemoUrl = project.DemoUrl,
            ReadmeUrl = project.ReadmeUrl,
            Status = project.Status,
            TotalHours = project.TotalHoursRaw,
            AiUse = project.AiUse,
            CreatedAt = project.CreatedAt
        });
    }

    //Create Project
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title is required!");
        }

        if (!string.IsNullOrWhiteSpace(dto.RepoUrl) &&
            await _db.Projects.AnyAsync(p => p.RepoUrl == dto.RepoUrl))
        {
            return BadRequest("A project with this repo URL already exists.");
        }

        if (!string.IsNullOrWhiteSpace(dto.DemoUrl) &&
            await _db.Projects.AnyAsync(p => p.DemoUrl == dto.DemoUrl))
        {
            return BadRequest("A project with this demo URL already exists.");
        }

        if (!string.IsNullOrWhiteSpace(dto.ReadmeUrl) &&
            await _db.Projects.AnyAsync(p => p.ReadmeUrl == dto.ReadmeUrl))
        {
            return BadRequest("A project with this readme URL already exists.");
        }

        if (dto.HackatimeProjectNames is { Length: > 0 } hackatimeNames &&
            await _db.Projects.AnyAsync(p => p.HackatimeProjectNames != null &&
                p.HackatimeProjectNames.Any(n => hackatimeNames.Contains(n))))
        {
            return BadRequest("One or more Hackatime project names are already used by another project.");
        }

        Project project = new Project
        {
            Title = dto.Title,
            Description = dto.Description,
            Tier = dto.Tier,
            RepoUrl = dto.RepoUrl,
            DemoUrl = dto.DemoUrl,
            ReadmeUrl = dto.ReadmeUrl,
            HackatimeProjectNames = dto.HackatimeProjectNames,
            OwnerUserId = userId.Value
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, new PrivateProjectDto
        {
            Id = project.Id,
            OwnerUserId = project.OwnerUserId,
            Title = project.Title,
            Description = project.Description,
            Tier = project.Tier,
            RepoUrl = project.RepoUrl,
            DemoUrl = project.DemoUrl,
            ReadmeUrl = project.ReadmeUrl,
            ClaimedByReviewer = project.ClaimedByReviewer,
            ClaimedAt = project.ClaimedAt,
            HackatimeProjectNames = project.HackatimeProjectNames,
            Status = project.Status,
            TrackedDesignHours = project.TrackedDesignHours,
            TrackedBuildHours = project.TrackedBuildHours,
            TotalHoursRaw = project.TotalHoursRaw,
            TotalHoursApproved = project.TotalHoursApproved,
            AiUse = project.AiUse,
            VoltsGranted = project.VoltsGranted,
            CreatedAt = project.CreatedAt
        });

    }

}
