using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
// A controller for reading announcements
// endpoint: /api/announcement/<command>

namespace Torque.Announcements;

[ApiController]
[Route("api/announcement")]
public class AnnouncementController : ControllerBase
{
    private readonly AppDbContext _db;
    public AnnouncementController(AppDbContext db) => _db = db;

    // latest announcements, newest first
    [HttpGet]
    public async Task<IActionResult> GetLatest()
    {
        var announcements = await _db.Announcements
            .OrderByDescending(a => a.CreatedAt)
            .Take(30)
            .Select(a => new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Body = a.Body,
                CreatedAt = a.CreatedAt,
                UpdatedAt = a.UpdatedAt
            })
            .ToListAsync();

        return Ok(announcements);
    }

    // announcement by ID
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var announcement = await _db.Announcements.FindAsync(id);
        if (announcement is null) return NotFound();

        return Ok(ToDto(announcement));
    }

    internal static AnnouncementDto ToDto(Announcement a) => new()
    {
        Id = a.Id,
        Title = a.Title,
        Body = a.Body,
        CreatedAt = a.CreatedAt,
        UpdatedAt = a.UpdatedAt
    };
}
