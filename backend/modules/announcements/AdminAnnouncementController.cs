using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Torque.Data;
using Torque.Extensions;
// Admin-only announcement management
// endpoint: /api/admin/announcement/<command>

namespace Torque.Announcements;

[ApiController]
[Route("api/admin/announcement")]
public class AdminAnnouncementController : ControllerBase
{
    private const int MaxTitleLength = 200;
    private const int MaxBodyLength = 20000;

    private readonly AppDbContext _db;
    public AdminAnnouncementController(AppDbContext db) => _db = db;

    // Post a new announcement
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateAnnouncementDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title is required!");
        }
        if (string.IsNullOrWhiteSpace(dto.Body))
        {
            return BadRequest("Body is required!");
        }
        var error = Validate(dto.Title, dto.Body);
        if (error is not null) return BadRequest(error);

        var announcement = new Announcement
        {
            AuthorUserId = userId.Value,
            Title = dto.Title.Trim(),
            Body = dto.Body
        };

        _db.Announcements.Add(announcement);
        await _db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(AnnouncementController.GetById),
            "Announcement",
            new { id = announcement.Id },
            AnnouncementController.ToDto(announcement));
    }

    // Edit an announcement's title and/or body
    [Authorize]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAnnouncementDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        if (dto.Title is null && dto.Body is null)
        {
            return BadRequest("Nothing to update. Send a title and/or body.");
        }
        if (dto.Title is not null && string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Title can't be empty!");
        }
        if (dto.Body is not null && string.IsNullOrWhiteSpace(dto.Body))
        {
            return BadRequest("Body can't be empty!");
        }
        var error = Validate(dto.Title, dto.Body);
        if (error is not null) return BadRequest(error);

        var announcement = await _db.Announcements.FindAsync(id);
        if (announcement is null) return NotFound();

        if (dto.Title is not null) announcement.Title = dto.Title.Trim();
        if (dto.Body is not null) announcement.Body = dto.Body;
        announcement.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(AnnouncementController.ToDto(announcement));
    }

    // Delete an announcement
    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("admin")) return Forbid();

        var announcement = await _db.Announcements.FindAsync(id);
        if (announcement is null) return NotFound();

        _db.Announcements.Remove(announcement);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static string? Validate(string? title, string? body)
    {
        if (title is not null && title.Trim().Length > MaxTitleLength)
        {
            return $"Title must be {MaxTitleLength} characters or fewer.";
        }
        if (body is not null && body.Length > MaxBodyLength)
        {
            return $"Body must be {MaxBodyLength} characters or fewer.";
        }
        return null;
    }
}
