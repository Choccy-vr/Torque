using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Projects;
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

    // Review a shipment (approve / reject / request changes)
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] ReviewShipmentDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var reviewer = await _db.Users.FindAsync(userId);
        if (reviewer is null) return NotFound();

        if (reviewer.Role is null || !reviewer.Role.Contains("reviewer")) return Forbid();

        // "returned" only makes sense once there's a second-pass audit that can invalidate
        // a prior approval; there's no such flow yet, so it isn't a valid decision here.
        if (dto.Status == ShipmentReviewStatus.returned)
        {
            return BadRequest("Status 'returned' is not supported yet.");
        }

        var shipment = await _db.Shipments.FindAsync(dto.ShipmentId);
        if (shipment is null) return BadRequest("ShipmentId does not reference an existing shipment.");

        if (shipment.Status != ShipmentStatus.unreviewed)
        {
            return BadRequest("This shipment has already been reviewed.");
        }

        if (shipment.UserId == userId.Value) return Forbid();

        var project = await _db.Projects.FindAsync(shipment.ProjectId);
        if (project is null) return NotFound();

        var review = new ShipmentReview
        {
            Id = Guid.NewGuid(),
            ProjectId = shipment.ProjectId,
            ShipmentId = shipment.Id,
            ReviewerId = userId.Value,
            Status = dto.Status,
            HideReviewerName = dto.HideReviewerName,
            ReturnedBy = dto.ReturnedBy,
            Feedback = dto.Feedback,
            InternalNote = dto.InternalNote,
            OverrideJustification = dto.OverrideJustification,
            Exceptional = dto.Exceptional
        };
        _db.ShipmentReviews.Add(review);

        shipment.Status = dto.Status switch
        {
            ShipmentReviewStatus.approved => ShipmentStatus.approved,
            ShipmentReviewStatus.rejected => ShipmentStatus.rejected,
            ShipmentReviewStatus.perm_rejected => ShipmentStatus.perm_rejected,
            ShipmentReviewStatus.changes_needed => ShipmentStatus.needs_changes,
            _ => shipment.Status
        };
        shipment.Feedback = dto.Feedback;
        shipment.ReviewId = review.Id;
        shipment.ReviewedAt = DateTime.UtcNow;

        // A rejected or changes_needed shipment leaves the project eligible to be
        // reshipped (Create() only allows shipping from Unshipped/Changes_Needed).
        // perm_rejected is a genuine terminal state — Create() doesn't allow shipping
        // from Perm_Rejected, so there's no path back for the user.
        if (dto.Status == ShipmentReviewStatus.approved)
        {
            project.Status = ProjectStatus.Approved;
            if (dto.Exceptional) project.Exceptional = true;
        }
        else if (dto.Status == ShipmentReviewStatus.perm_rejected)
        {
            project.Status = ProjectStatus.Perm_Rejected;
        }
        else
        {
            project.Status = ProjectStatus.Changes_Needed;
        }

        await _db.SaveChangesAsync();

        return Ok(new AdminShipmentReviewDto
        {
            Id = review.Id,
            ProjectId = review.ProjectId,
            ShipmentId = review.ShipmentId,
            ReviewerId = review.ReviewerId,
            Status = review.Status,
            HideReviewerName = review.HideReviewerName,
            ReturnedBy = review.ReturnedBy,
            Feedback = review.Feedback,
            InternalNote = review.InternalNote,
            OverrideJustification = review.OverrideJustification,
            Exceptional = review.Exceptional,
            CreatedAt = review.CreatedAt
        });
    }
}
