using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Projects;
using Torque.Settings;
using Torque.Slack;
using Torque.Streaks;
// A controller for devlog data
// endpoint: /api/devlog/<command>

namespace Torque.Devlogs;

[ApiController]
[Route("api/devlog")]
public class DevlogController : ControllerBase
{
    // Most Hackatime time a single journal can cover; anything over is forfeited.
    private const double MaxTrackedSecondsPerJournal = 10 * 3600;

    private readonly AppDbContext _db;
    private readonly HackatimeService _hackatime;
    private readonly StreakService _streaks;
    private readonly SlackNotifier _slack;
    private readonly SlackOptions _slackOptions;

    public DevlogController(AppDbContext db, HackatimeService hackatime, StreakService streaks, SlackNotifier slack, SlackOptions slackOptions)
    {
        _db = db;
        _hackatime = hackatime;
        _streaks = streaks;
        _slack = slack;
        _slackOptions = slackOptions;
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

    // What a journal posted now would credit, without posting one: the Hackatime time
    // logged on the project's linked names since its last journal, capped at 10h.
    [Authorize]
    [EnableRateLimiting("hackatime-read")]
    [HttpGet("preview/{projectId:guid}")]
    public async Task<IActionResult> Preview(Guid projectId)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return NotFound();
        if (project.OwnerUserId != userId.Value) return Forbid();

        var time = await PendingTimeAsync(project, userId.Value);
        return Ok(new
        {
            trackedHours = time.TrackedSeconds / 3600,
            uncappedHours = time.UncappedSeconds / 3600,
            maxHours = MaxTrackedSecondsPerJournal / 3600,
            hackatimeLinked = project.HackatimeProjectNames is { Length: > 0 },
            hackatimeReachable = time.HackatimeTotal is not null
        });
    }

    //Create Devlog
    [Authorize]
    [PausedBy(SettingKeys.JournalingPaused)]
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
        var imageUrls = JournalRules.ImageUrls(dto.Text, dto.ImageUrls);
        var ruleError = JournalRules.Check(dto.Title, dto.Text, imageUrls);
        if (ruleError is not null) return BadRequest(ruleError);

        // Locks the project row until commit, so two journals posted at once can't both
        // credit the same Hackatime time: the second waits, then sees the first's snapshot.
        await using var tx = await _db.Database.BeginTransactionAsync();
        var project = await _db.Projects
            .FromSql($"SELECT * FROM projects WHERE id = {projectId} FOR UPDATE")
            .FirstOrDefaultAsync();
        if (project is null)
        {
            return BadRequest("ProjectId does not reference an existing project.");
        }
        if (project.OwnerUserId != userId.Value) return Forbid();
        if (project.IsArchived) return BadRequest("This project is archived. Unarchive it to journal on it.");

        var user = await _db.Users.FindAsync(userId.Value);
        if (user is null) return Unauthorized();

        var (previousSnapshot, hackatimeTotal, trackedSeconds, uncappedSeconds) = await PendingTimeAsync(project, userId.Value);
        // No journaling without Hackatime: the entry has to credit the time it covers.
        if (hackatimeTotal is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                "Couldn't reach Hackatime, so this entry can't be posted yet. Check your Hackatime connection and try again.");
        }

        Devlog devlog = new Devlog
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            ProjectId = projectId,
            Text = dto.Text,
            ImageUrls = imageUrls,
            OwnerUserId = userId.Value,
            TrackedSeconds = trackedSeconds,
            // The snapshot moves past all the pending time, not just the credited part, so
            // anything over the cap is dropped rather than counted on the next journal.
            HackatimeSecondsSnapshot = previousSnapshot + uncappedSeconds,
        };

        _db.Devlogs.Add(devlog);
        project.DevlogIds = [.. project.DevlogIds ?? [], devlog.Id.ToString()];
        // Raw hours tracked = every journal's credited time (what the hours leaderboard ranks on)
        project.TotalHoursRaw += (float)(trackedSeconds / 3600);
        var streakChange = await _streaks.RecordJournalAsync(devlog, project, user);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        StreakNotifications.Send(_slack, _slackOptions, user, project, streakChange);

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

    // The journal covers the Hackatime time logged since the previous journal (capped;
    // the rest is forfeited). HackatimeTotal is null when Hackatime can't be reached (or
    // isn't connected while names are linked); Create refuses to post then. Projects with
    // no linked names get a total of 0 and can journal without Hackatime time.
    private async Task<(double PreviousSnapshot, double? HackatimeTotal, double TrackedSeconds, double UncappedSeconds)> PendingTimeAsync(Project project, Guid userId)
    {
        var previousSnapshot = await _db.Devlogs
            .Where(d => d.ProjectId == project.Id)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => d.HackatimeSecondsSnapshot)
            .FirstOrDefaultAsync();
        var hackatimeTotal = await _hackatime.GetTotalSecondsForProjectsAsync(userId, project.HackatimeProjectNames ?? []);
        var uncapped = Math.Max(0, (hackatimeTotal ?? previousSnapshot) - previousSnapshot);
        return (previousSnapshot, hackatimeTotal, Math.Min(uncapped, MaxTrackedSecondsPerJournal), uncapped);
    }
}
