using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Projects;
using Torque.Streaks;
// A controller for devlog data
// endpoint: /api/devlog/<command>

namespace Torque.Devlogs;

[ApiController]
[Route("api/devlog")]
public class DevlogController : ControllerBase
{
    // Most Hackatime time a single journal can cover; anything over carries to the next.
    private const double MaxTrackedSecondsPerJournal = 10 * 3600;

    private readonly AppDbContext _db;
    private readonly HackatimeService _hackatime;
    private readonly StreakService _streaks;

    public DevlogController(AppDbContext db, HackatimeService hackatime, StreakService streaks)
    {
        _db = db;
        _hackatime = hackatime;
        _streaks = streaks;
    }

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
            TrackedHours = devlog.TrackedSeconds / 3600,
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
                TrackedHours = d.TrackedSeconds / 3600,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync();

        return Ok(devlogs);
    }

    // a user's devlogs (public view), newest first
    [HttpGet("user/{id:guid}")]
    public async Task<IActionResult> GetByUser(Guid id)
    {
        var devlogs = await _db.Devlogs
            .Where(d => d.OwnerUserId == id)
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
                TrackedHours = d.TrackedSeconds / 3600,
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
                TrackedHours = d.TrackedSeconds / 3600,
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
        if (project.OwnerUserId != userId.Value) return Forbid();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user is null) return Unauthorized();

        // The journal covers the Hackatime time logged since the previous journal (capped).
        // If Hackatime can't be reached it covers nothing, and the next journal picks it up.
        var previousSnapshot = await _db.Devlogs
            .Where(d => d.ProjectId == projectId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => d.HackatimeSecondsSnapshot)
            .FirstOrDefaultAsync();
        var hackatimeTotal = await _hackatime.GetTotalSecondsForProjectsAsync(userId.Value, project.HackatimeProjectNames ?? []);
        var trackedSeconds = Math.Clamp((hackatimeTotal ?? previousSnapshot) - previousSnapshot, 0, MaxTrackedSecondsPerJournal);

        Devlog devlog = new Devlog
        {
            Id = Guid.NewGuid(),
            Title = dto.Title,
            ProjectId = projectId,
            Text = dto.Text,
            ImageUrls = dto.ImageUrls ?? [],
            OwnerUserId = userId.Value,
            TrackedSeconds = trackedSeconds,
            HackatimeSecondsSnapshot = previousSnapshot + trackedSeconds,
        };

        _db.Devlogs.Add(devlog);
        project.DevlogIds = [.. project.DevlogIds ?? [], devlog.Id.ToString()];
        await _streaks.RecordJournalAsync(devlog, project, user);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = devlog.Id }, new PublicDevlogDto
        {
            Id = devlog.Id,
            OwnerUserId = devlog.OwnerUserId.ToString(),
            ProjectId = devlog.ProjectId.ToString(),
            Title = devlog.Title,
            Text = devlog.Text,
            ImageUrls = devlog.ImageUrls,
            TrackedHours = devlog.TrackedSeconds / 3600,
            CreatedAt = devlog.CreatedAt
        });

    }

}
