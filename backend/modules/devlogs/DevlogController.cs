using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Projects;
// A controller for devlog data
// endpoint: /api/devlog/<command>

namespace Torque.Devlogs;

[ApiController]
[Route("api/devlog")]
public class DevlogController : ControllerBase
{
    private readonly AppDbContext _db;
    public DevlogController(AppDbContext db) => _db = db;

    // devlog by ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var devlog = await _db.Devlogs.FindAsync(id);
        if (devlog is null) return NotFound();

        return Ok(new PublicDevlogDto
        {
            Id = devlog.Id,
            OwnerUserId = devlog.OwnerUserId.ToString(),
            ProjectId = devlog.ProjectId.ToString(),
            Title = devlog.Title,
            Text = devlog.Text,
            ImageUrls = devlog.ImageUrls,
            CreatedAt = devlog.CreatedAt
        });
    }

    // devlogs for the authenticated user
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMine()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var devlogs = await _db.Devlogs
            .Where(d => d.OwnerUserId == userId.Value)
            .OrderByDescending(d => d.CreatedAt)
            .Take(30)
            .Select(d => new PublicDevlogDto
            {
                Id = d.Id,
                OwnerUserId = d.OwnerUserId.ToString(),
                ProjectId = d.ProjectId.ToString(),
                Title = d.Title,
                Text = d.Text,
                ImageUrls = d.ImageUrls,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync();

        return Ok(devlogs);
    }

    // fetch up to 30 devlogs by id at once
    [HttpPost("batch")]
    public async Task<IActionResult> GetBatch([FromBody] BatchDevlogDto dto)
    {
        if (dto.Ids is not { Length: > 0 })
        {
            return BadRequest("Ids are required!");
        }
        if (dto.Ids.Length > 30)
        {
            return BadRequest("A maximum of 30 Ids can be requested at once.");
        }

        var ids = new Guid[dto.Ids.Length];
        for (var i = 0; i < dto.Ids.Length; i++)
        {
            if (!Guid.TryParse(dto.Ids[i], out ids[i]))
            {
                return BadRequest($"'{dto.Ids[i]}' is not a valid Id.");
            }
        }

        var devlogs = await _db.Devlogs
            .Where(d => ids.Contains(d.Id))
            .Select(d => new PublicDevlogDto
            {
                Id = d.Id,
                OwnerUserId = d.OwnerUserId.ToString(),
                ProjectId = d.ProjectId.ToString(),
                Title = d.Title,
                Text = d.Text,
                ImageUrls = d.ImageUrls,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync();

        return Ok(devlogs);
    }

    //Create Devlog
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateDevlogDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title is required!");
        }
        if (!Guid.TryParse(dto.ProjectId, out var projectId) || projectId == Guid.Empty)
        {
            return BadRequest("ProjectId is required!");
        }

        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required");
        }

        var project = await _db.Projects.FindAsync(projectId);
        if (project is null)
        {
            return BadRequest("ProjectId does not reference an existing project.");
        }

        Devlog devlog = new Devlog
        {
            Title = dto.Title,
            ProjectId = projectId,
            Text = dto.Text,
            ImageUrls = dto.ImageUrls,
            OwnerUserId = userId.Value,

        };

        _db.Devlogs.Add(devlog);
        project.DevlogIds = [.. project.DevlogIds ?? [], devlog.Id.ToString()];
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = devlog.Id }, new PublicDevlogDto
        {
            Id = devlog.Id,
            OwnerUserId = devlog.OwnerUserId.ToString(),
            ProjectId = devlog.ProjectId.ToString(),
            Title = devlog.Title,
            Text = devlog.Text,
            ImageUrls = devlog.ImageUrls,
            CreatedAt = devlog.CreatedAt
        });

    }

}
