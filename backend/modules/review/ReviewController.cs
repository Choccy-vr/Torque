using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Shipments;
using Torque.Users;
// A controller for reviewing projects
// endpoint: /api/admin/review/

namespace Torque.Reviews;

[ApiController]
[Route("api/admin/review")]
public class ReviewController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReviewController(AppDbContext db) => _db = db;

    // Get shipments that need reviewing oldest to newest
    [Authorize]
    [HttpGet("get/pending")]
    public async Task<IActionResult> GetPendingShips()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("reviewer")) return Forbid();

        var shipments = await _db.Shipments
            .Where(s => s.Status == ShipmentStatus.unreviewed)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new AdminShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                ReviewerNote = s.ReviewerNote,
                Status = s.Status,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                ProjectSnapshot = s.ProjectSnapshot,
                TierSnapshot = s.TierSnapshot,
                OverrideTier = s.OverrideTier,
                ReviewId = s.ReviewId,
                ReviewedAt = s.ReviewedAt,
                VoltsGranted = s.VoltsGranted,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(shipments);
    }

    // Get a single shipment by id
    [Authorize]
    [HttpGet("get/{id:guid}")]
    public async Task<IActionResult> GetShip(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        if (user.Role is null || !user.Role.Contains("reviewer")) return Forbid();

        var shipment = await _db.Shipments
            .Where(s => s.Id == id)
            .Select(s => new AdminShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                ReviewerNote = s.ReviewerNote,
                Status = s.Status,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                ProjectSnapshot = s.ProjectSnapshot,
                TierSnapshot = s.TierSnapshot,
                OverrideTier = s.OverrideTier,
                ReviewId = s.ReviewId,
                ReviewedAt = s.ReviewedAt,
                VoltsGranted = s.VoltsGranted,
                CreatedAt = s.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (shipment is null) return NotFound();

        return Ok(shipment);
    }
}
