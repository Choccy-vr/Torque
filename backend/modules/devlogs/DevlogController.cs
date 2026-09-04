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
            OwnerUserId = devlog.OwnerUserId,
            Title = devlog.Title,
            Text = devlog.Text,
            ImageUrls = devlog.ImageUrls,
            CreatedAt = devlog.CreatedAt
        });
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
        if (dto.ProjectId == Guid.Empty)
        {
            return BadRequest("ProjectId is required!");
        }

        if (string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required");
        }

        if (dto.ImageUrls is { Length: > 0 })
        {
            return BadRequest("Image Urls are required");
        }
        Devlog devlog = new Devlog
        {
            Title = dto.Title,
            ProjectId = dto.ProjectId,
            Text = dto.Text,
            ImageUrls = dto.ImageUrls,
            OwnerUserId = userId.Value,

        };

        _db.Devlogs.Add(devlog);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = devlog.Id }, new PublicDevlogDto
        {
            Id = devlog.Id,
            OwnerUserId = devlog.OwnerUserId,
            ProjectId = devlog.ProjectId,
            Title = devlog.Title,
            Text = devlog.Text,
            ImageUrls = devlog.ImageUrls,
            CreatedAt = devlog.CreatedAt
        });

    }

}
