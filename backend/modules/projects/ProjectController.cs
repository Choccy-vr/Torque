using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Hackatime;
using Torque.Streaks;
// A controller for project data
// endpoint: /api/project/<command>

namespace Torque.Projects;

[ApiController]
[Route("api/project")]
public class ProjectController : ControllerBase
{
    private const int MaxTitleLength = 200;
    private const int MaxDescriptionLength = 5000;
    private const int MaxAiUseLength = 2000;
    private const int MaxUrlLength = 2048;

    private readonly AppDbContext _db;
    private readonly HackatimeService _hackatime;

    public ProjectController(AppDbContext db, HackatimeService hackatime)
    {
        _db = db;
        _hackatime = hackatime;
    }

    // project by ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

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
            GrantStatus = project.GrantStatus,
            TotalHours = project.TotalHoursRaw,
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

    // a project's daily streak plus its last 60 recorded days, newest first
    [HttpGet("{id:guid}/streak")]
    public async Task<IActionResult> GetStreak(Guid id)
    {
        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();

        var days = await _db.ProjectStreakDays
            .Where(d => d.ProjectId == id)
            .OrderByDescending(d => d.Date)
            .Take(60)
            .Select(d => new ProjectStreakDayDto
            {
                Date = d.Date,
                Status = d.Status,
                TrackedHours = d.TrackedSeconds / 3600
            })
            .ToArrayAsync();

        var streak = StreakService.EffectiveStreak(project.StreakCount, project.Tier);
        return Ok(new ProjectStreakDto
        {
            ProjectId = project.Id,
            Streak = streak,
            MaxStreak = StreakService.MaxStreakForLevel(project.Tier),
            Multiplier = StreakService.Multiplier(streak),
            LastStreakDate = project.LastStreakDate,
            FreezesPaused = project.StreakFreezesPaused,
            Days = days
        });
    }

    // staff-picked projects, newest first
    [HttpGet("staff-picks")]
    public async Task<IActionResult> GetStaffPicks()
    {
        var projects = await _db.Projects
            .Where(p => p.IsStaffPick)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PublicProjectDto
            {
                Id = p.Id,
                OwnerUserId = p.OwnerUserId.ToString(),
                Title = p.Title,
                Description = p.Description,
                Tier = p.Tier,
                RepoUrl = p.RepoUrl,
                DemoUrl = p.DemoUrl,
                ReadmeUrl = p.ReadmeUrl,
                Status = p.Status,
                GrantStatus = p.GrantStatus,
                TotalHours = p.TotalHoursRaw,
                AiUse = p.AiUse,
                DevlogIds = p.DevlogIds,
                Exceptional = p.Exceptional,
                IsStaffPick = p.IsStaffPick,
                IsArchived = p.IsArchived,
                ArchivedAt = p.ArchivedAt,
                Streak = StreakService.EffectiveStreak(p.StreakCount, p.Tier),
                MaxStreak = StreakService.MaxStreakForLevel(p.Tier),
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(projects);
    }

    // keyword search over unarchived titles/descriptions, title matches ranked first, newest first within a tier
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<SearchProjectDto>());

        var pattern = $"%{q}%";
        var prefixPattern = $"{q}%";

        var results = await _db.Projects
            .Where(p => !p.IsArchived)
            .Where(p => EF.Functions.ILike(p.Title, pattern) ||
                 (p.Description != null && EF.Functions.ILike(p.Description, pattern)))
            .OrderBy(p =>
                EF.Functions.ILike(p.Title, prefixPattern) ? 0 :
                EF.Functions.ILike(p.Title, pattern) ? 1 : 2)
            .ThenByDescending(p => p.CreatedAt)
            .Take(25)
            .Select(p => new SearchProjectDto
            {
                Id = p.Id,
                Title = p.Title,
                Description = p.Description,
                OwnerUserId = p.OwnerUserId.ToString(),
                Status = p.Status,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }

    // top projects by tracked hours
    [HttpGet("leaderboard/hours")]
    public async Task<IActionResult> GetHoursLeaderboard()
    {
        var projects = await _db.Projects
            .Where(p => p.Status == ProjectStatus.Approved)
            .OrderByDescending(p => p.TotalHoursRaw)
            .Take(50)
            .Select(p => new LeaderboardProjectDto
            {
                Id = p.Id,
                Title = p.Title,
                OwnerUserId = p.OwnerUserId.ToString(),
                TotalHoursRaw = p.TotalHoursRaw,
                VoltsGranted = p.VoltsGranted
            })
            .ToListAsync();

        return Ok(projects);
    }

    // top projects by volts granted
    [HttpGet("leaderboard/volts")]
    public async Task<IActionResult> GetVoltsLeaderboard()
    {
        var projects = await _db.Projects
            .Where(p => p.Status == ProjectStatus.Approved)
            .OrderByDescending(p => p.VoltsGranted)
            .Take(50)
            .Select(p => new LeaderboardProjectDto
            {
                Id = p.Id,
                Title = p.Title,
                OwnerUserId = p.OwnerUserId.ToString(),
                TotalHoursRaw = p.TotalHoursRaw,
                VoltsGranted = p.VoltsGranted
            })
            .ToListAsync();

        return Ok(projects);
    }

    // a user's projects (public view), newest first
    [HttpGet("user/{id:guid}")]
    public async Task<IActionResult> GetByUser(Guid id)
    {
        var projects = await _db.Projects
            .Where(p => p.OwnerUserId == id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PublicProjectDto
            {
                Id = p.Id,
                OwnerUserId = p.OwnerUserId.ToString(),
                Title = p.Title,
                Description = p.Description,
                Tier = p.Tier,
                RepoUrl = p.RepoUrl,
                DemoUrl = p.DemoUrl,
                ReadmeUrl = p.ReadmeUrl,
                Status = p.Status,
                GrantStatus = p.GrantStatus,
                TotalHours = p.TotalHoursRaw,
                AiUse = p.AiUse,
                DevlogIds = p.DevlogIds,
                Exceptional = p.Exceptional,
                IsStaffPick = p.IsStaffPick,
                IsArchived = p.IsArchived,
                ArchivedAt = p.ArchivedAt,
                Streak = StreakService.EffectiveStreak(p.StreakCount, p.Tier),
                MaxStreak = StreakService.MaxStreakForLevel(p.Tier),
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(projects);
    }

    // projects for the authenticated user
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMine()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var projects = await _db.Projects
            .Where(p => p.OwnerUserId == userId.Value)
            .Select(p => new PrivateProjectDto
            {
                Id = p.Id,
                OwnerUserId = p.OwnerUserId.ToString(),
                Title = p.Title,
                Description = p.Description,
                Tier = p.Tier,
                RepoUrl = p.RepoUrl,
                DemoUrl = p.DemoUrl,
                ReadmeUrl = p.ReadmeUrl,
                ClaimedByReviewer = p.ClaimedByReviewer.ToString(),
                ClaimedAt = p.ClaimedAt,
                HackatimeProjectNames = p.HackatimeProjectNames,
                DevlogIds = p.DevlogIds,
                Status = p.Status,
                GrantStatus = p.GrantStatus,
                TrackedDesignHours = p.TrackedDesignHours,
                TrackedBuildHours = p.TrackedBuildHours,
                TotalHoursRaw = p.TotalHoursRaw,
                TotalHoursApproved = p.TotalHoursApproved,
                AiUse = p.AiUse,
                VoltsGranted = p.VoltsGranted,
                IsArchived = p.IsArchived,
                ArchivedAt = p.ArchivedAt,
                Streak = StreakService.EffectiveStreak(p.StreakCount, p.Tier),
                MaxStreak = StreakService.MaxStreakForLevel(p.Tier),
                StreakFreezesPaused = p.StreakFreezesPaused,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(projects);
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
        if (dto.Tier is null)
        {
            return BadRequest("Tier is required!");
        }

        var repoUrl = Clean(dto.RepoUrl);
        var demoUrl = Clean(dto.DemoUrl);
        var readmeUrl = Clean(dto.ReadmeUrl);
        var hackatimeNames = CleanNames(dto.HackatimeProjectNames);

        var error = Validate(dto.Title, dto.Description, dto.Tier, repoUrl, demoUrl, readmeUrl, dto.AiUse)
            ?? await FindDuplicateAsync(null, repoUrl, demoUrl, readmeUrl, hackatimeNames);
        if (error is not null) return BadRequest(error);

        Project project = new Project
        {
            Title = dto.Title.Trim(),
            Description = Clean(dto.Description),
            Tier = dto.Tier.Value,
            RepoUrl = repoUrl,
            DemoUrl = demoUrl,
            ReadmeUrl = readmeUrl,
            HackatimeProjectNames = hackatimeNames,
            AiUse = Clean(dto.AiUse),
            OwnerUserId = userId.Value
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, ToPrivateDto(project));
    }

    // Edit one of the authenticated user's own projects. Omitted fields are left unchanged.
    [Authorize]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (dto.Title is null && dto.Description is null && dto.Tier is null
            && dto.RepoUrl is null && dto.DemoUrl is null && dto.ReadmeUrl is null
            && dto.HackatimeProjectNames is null && dto.AiUse is null)
        {
            return BadRequest("Nothing to update.");
        }
        if (dto.Title is not null && string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title can't be empty!");
        }

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        if (project.OwnerUserId != userId.Value) return Forbid();

        if (project.IsArchived) return Conflict("This project is archived. Unarchive it to edit it.");
        // The reviewer is looking at the project as shipped
        if (StreakService.InReview(project.Status)) return Conflict("This project can't be edited while it's in review.");

        // The level sets the payout rate, so once a ship has been paid on it only a
        // reviewer (overrideTier) can change it.
        var tierChanged = dto.Tier is not null && dto.Tier != project.Tier;
        if (tierChanged && await _db.Shipments.AnyAsync(s => s.ProjectId == project.Id && s.FinalApprovedAt != null))
        {
            return Conflict("The level can't be changed after a ship has been approved. Ask a reviewer.");
        }

        var repoUrl = dto.RepoUrl is null ? project.RepoUrl : Clean(dto.RepoUrl);
        var demoUrl = dto.DemoUrl is null ? project.DemoUrl : Clean(dto.DemoUrl);
        var readmeUrl = dto.ReadmeUrl is null ? project.ReadmeUrl : Clean(dto.ReadmeUrl);
        var hackatimeNames = dto.HackatimeProjectNames is null ? project.HackatimeProjectNames : CleanNames(dto.HackatimeProjectNames);

        var oldNames = project.HackatimeProjectNames ?? [];
        var newNames = hackatimeNames ?? [];
        var namesChanged = !oldNames.ToHashSet().SetEquals(newNames);

        // Only check what's changing, so an old value can't block an unrelated edit
        string? IfChanged(string? value, string? current) => value == current ? null : value;
        var error = Validate(dto.Title, dto.Description, tierChanged ? dto.Tier : null,
                IfChanged(repoUrl, project.RepoUrl), IfChanged(demoUrl, project.DemoUrl),
                IfChanged(readmeUrl, project.ReadmeUrl), dto.AiUse)
            ?? await FindDuplicateAsync(project.Id,
                IfChanged(repoUrl, project.RepoUrl), IfChanged(demoUrl, project.DemoUrl),
                IfChanged(readmeUrl, project.ReadmeUrl), [.. newNames.Except(oldNames)]);
        if (error is not null) return BadRequest(error);

        if (namesChanged)
        {
            var rebaseError = await RebaseHackatimeAsync(project, userId.Value, oldNames, newNames);
            if (rebaseError is not null) return rebaseError;
        }

        if (dto.Title is not null) project.Title = dto.Title.Trim();
        if (dto.Description is not null) project.Description = Clean(dto.Description);
        if (tierChanged) project.Tier = dto.Tier!.Value;
        project.RepoUrl = repoUrl;
        project.DemoUrl = demoUrl;
        project.ReadmeUrl = readmeUrl;
        project.HackatimeProjectNames = hackatimeNames;
        if (dto.AiUse is not null) project.AiUse = Clean(dto.AiUse);
        await _db.SaveChangesAsync();

        return Ok(ToPrivateDto(project));
    }

    // Archive/unarchive one of the authenticated user's own projects
    [Authorize]
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> SetArchived(Guid id, [FromBody] SetArchivedDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        if (project.OwnerUserId != userId.Value) return Forbid();

        if (dto.IsArchived && !project.IsArchived)
        {
            if (StreakService.InReview(project.Status)) return Conflict("This project can't be archived while it's in review.");

            project.IsArchived = true;
            project.ArchivedAt = DateTime.UtcNow;
            // Drop the streak so the streak worker doesn't spend the owner's freezes on it
            project.StreakCount = 0;
            project.LastStreakDate = null;
        }
        else if (!dto.IsArchived && project.IsArchived)
        {
            project.IsArchived = false;
            project.ArchivedAt = null;
        }
        await _db.SaveChangesAsync();

        return Ok(ToPrivateDto(project));
    }

    // Pause/resume spending the owner's streak freezes on one of their own projects
    [Authorize]
    [HttpPost("{id:guid}/streak/freezes")]
    public async Task<IActionResult> SetStreakFreezesPaused(Guid id, [FromBody] SetStreakFreezesPausedDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var project = await _db.Projects.FindAsync(id);
        if (project is null) return NotFound();
        if (project.OwnerUserId != userId.Value) return Forbid();

        project.StreakFreezesPaused = dto.Paused;
        await _db.SaveChangesAsync();

        return Ok(ToPrivateDto(project));
    }

    // Journals credit the Hackatime time logged since the previous journal: the linked
    // projects' all-time total minus the latest journal's snapshot. Changing the linked
    // names shifts that total, so shift the snapshot by the same amount. Otherwise
    // unlinking stalls tracking until the time catches back up, and unlinking then
    // relinking a project credits its time twice. Time already credited can't be lost
    // or regained this way; time logged on a newly linked project before it was linked
    // isn't credited. Null when it worked, otherwise the error to return.
    private async Task<IActionResult?> RebaseHackatimeAsync(Project project, Guid userId, string[] oldNames, string[] newNames)
    {
        // Nothing credited yet, so this is no different from linking them at creation.
        // (Not the snapshot: an unlink can floor it to 0 after time was credited.)
        if (!await _db.Devlogs.AnyAsync(d => d.ProjectId == project.Id && d.TrackedSeconds > 0)) return null;

        var latest = await _db.Devlogs
            .Where(d => d.ProjectId == project.Id)
            .OrderByDescending(d => d.CreatedAt)
            .FirstAsync();

        var oldTotal = await _hackatime.GetTotalSecondsForProjectsAsync(userId, oldNames);
        var newTotal = await _hackatime.GetTotalSecondsForProjectsAsync(userId, newNames);
        if (oldTotal is null || newTotal is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                "Couldn't reach Hackatime to move the tracked time over. Check your Hackatime connection and try again.");
        }

        // Floored at 0: time not yet credited can't exceed what's still linked
        latest.HackatimeSecondsSnapshot = Math.Max(0, latest.HackatimeSecondsSnapshot + newTotal.Value - oldTotal.Value);
        return null;
    }

    // Field rules shared by create and update; null fields are skipped
    private static string? Validate(string? title, string? description, int? tier,
        string? repoUrl, string? demoUrl, string? readmeUrl, string? aiUse)
    {
        if (title is not null && title.Trim().Length > MaxTitleLength)
        {
            return $"Title must be {MaxTitleLength} characters or fewer.";
        }
        if (description is not null && description.Length > MaxDescriptionLength)
        {
            return $"Description must be {MaxDescriptionLength} characters or fewer.";
        }
        if (aiUse is not null && aiUse.Length > MaxAiUseLength)
        {
            return $"AiUse must be {MaxAiUseLength} characters or fewer.";
        }
        if (tier is not null and (< 1 or > 4))
        {
            return "Tier must be between 1 and 4.";
        }
        foreach (var (name, url) in new[] { ("RepoUrl", repoUrl), ("DemoUrl", demoUrl), ("ReadmeUrl", readmeUrl) })
        {
            if (url is not null && !IsHttpUrl(url)) return $"{name} must be an http(s) URL.";
        }
        return null;
    }

    // Repo/demo/readme URLs and Hackatime names each belong to one project
    private async Task<string?> FindDuplicateAsync(Guid? exceptId, string? repoUrl, string? demoUrl, string? readmeUrl, string[]? hackatimeNames)
    {
        var others = _db.Projects.Where(p => p.Id != exceptId);

        if (repoUrl is not null && await others.AnyAsync(p => p.RepoUrl == repoUrl))
        {
            return "A project with this repo URL already exists.";
        }
        if (demoUrl is not null && await others.AnyAsync(p => p.DemoUrl == demoUrl))
        {
            return "A project with this demo URL already exists.";
        }
        if (readmeUrl is not null && await others.AnyAsync(p => p.ReadmeUrl == readmeUrl))
        {
            return "A project with this readme URL already exists.";
        }
        if (hackatimeNames is { Length: > 0 } &&
            await others.AnyAsync(p => p.HackatimeProjectNames != null &&
                p.HackatimeProjectNames.Any(n => hackatimeNames.Contains(n))))
        {
            return "One or more Hackatime project names are already used by another project.";
        }
        return null;
    }

    private static bool IsHttpUrl(string url) =>
        url.Length <= MaxUrlLength
        && Uri.TryCreate(url, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    // Blank optional text is stored as null
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string[]? CleanNames(string[]? names) =>
        names is null ? null : [.. names.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()).Distinct()];

    private static PrivateProjectDto ToPrivateDto(Project project) => new()
    {
        Id = project.Id,
        OwnerUserId = project.OwnerUserId.ToString(),
        Title = project.Title,
        Description = project.Description,
        Tier = project.Tier,
        RepoUrl = project.RepoUrl,
        DemoUrl = project.DemoUrl,
        ReadmeUrl = project.ReadmeUrl,
        ClaimedByReviewer = project.ClaimedByReviewer.ToString(),
        ClaimedAt = project.ClaimedAt,
        HackatimeProjectNames = project.HackatimeProjectNames,
        DevlogIds = project.DevlogIds,
        Status = project.Status,
        GrantStatus = project.GrantStatus,
        TrackedDesignHours = project.TrackedDesignHours,
        TrackedBuildHours = project.TrackedBuildHours,
        TotalHoursRaw = project.TotalHoursRaw,
        TotalHoursApproved = project.TotalHoursApproved,
        AiUse = project.AiUse,
        VoltsGranted = project.VoltsGranted,
        IsArchived = project.IsArchived,
        ArchivedAt = project.ArchivedAt,
        Streak = StreakService.EffectiveStreak(project.StreakCount, project.Tier),
        MaxStreak = StreakService.MaxStreakForLevel(project.Tier),
        StreakFreezesPaused = project.StreakFreezesPaused,
        CreatedAt = project.CreatedAt
    };
}
