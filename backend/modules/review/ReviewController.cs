using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Torque.Data;
using Torque.Extensions;
using Torque.Payouts;
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
    private readonly PayoutService _payouts;

    public ReviewController(AppDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

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
                ApprovedHours = s.ApprovedHours,
                PaidHours = s.PaidHours,
                VoltsPerHour = s.VoltsPerHour,
                IsBuildComplete = s.IsBuildComplete,
                RequestedFunding = s.RequestedFunding,
                HowDidYouHear = s.HowDidYouHear,
                WhatAreWeDoingWell = s.WhatAreWeDoingWell,
                HowCanWeImprove = s.HowCanWeImprove,
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
                ApprovedHours = s.ApprovedHours,
                PaidHours = s.PaidHours,
                VoltsPerHour = s.VoltsPerHour,
                IsBuildComplete = s.IsBuildComplete,
                RequestedFunding = s.RequestedFunding,
                HowDidYouHear = s.HowDidYouHear,
                WhatAreWeDoingWell = s.WhatAreWeDoingWell,
                HowCanWeImprove = s.HowCanWeImprove,
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

        var screenshotUrl = string.IsNullOrWhiteSpace(dto.ScreenshotUrl) ? null : dto.ScreenshotUrl.Trim();
        if (screenshotUrl is not null
            && !(Uri.TryCreate(screenshotUrl, UriKind.Absolute, out var screenshotUri)
                 && (screenshotUri.Scheme == Uri.UriSchemeHttp || screenshotUri.Scheme == Uri.UriSchemeHttps)))
        {
            return BadRequest("ScreenshotUrl must be an http(s) URL.");
        }

        // Approval pushes to Airtable, which needs these to justify the grant.
        if (dto.Status == ShipmentReviewStatus.approved
            && (screenshotUrl is null || string.IsNullOrWhiteSpace(dto.TechnicalFeatures)))
        {
            return BadRequest("ScreenshotUrl and TechnicalFeatures are required when approving.");
        }

        if (dto.OverrideHours is < 0) return BadRequest("OverrideHours can't be negative.");
        if (dto.OverrideHours is not null && string.IsNullOrWhiteSpace(dto.OverrideJustification))
        {
            return BadRequest("OverrideJustification is required when setting OverrideHours.");
        }
        if (dto.OverrideTier is not null and not (>= 1 and <= 4)) return BadRequest("OverrideTier must be 1–4.");

        var shipment = await _db.Shipments.FindAsync(dto.ShipmentId);
        if (shipment is null) return BadRequest("ShipmentId does not reference an existing shipment.");

        if (shipment.Status != ShipmentStatus.unreviewed)
        {
            return BadRequest("This shipment has already been reviewed.");
        }

        var project = await _db.Projects.FindAsync(shipment.ProjectId);
        if (project is null) return NotFound();

        // The level sets the Volts rate, so an approval needs a valid one.
        var level = dto.OverrideTier ?? project.Tier;
        if (dto.Status == ShipmentReviewStatus.approved && level is < 1 or > 4)
        {
            return BadRequest("The project has no valid level (1–4); set OverrideTier to approve.");
        }

        await using var tx = await _db.Database.BeginTransactionAsync();

        // Pays out before the shipment is marked approved, so it isn't counted as an
        // earlier ship. Volts only for build ships; a design ship with requested funding
        // gets a Grant for an admin to fulfil.
        PayoutService.ApprovalResult? payout = null;
        if (dto.Status == ShipmentReviewStatus.approved)
        {
            if (dto.OverrideTier is not null)
            {
                shipment.OverrideTier = dto.OverrideTier.Value;
                project.Tier = dto.OverrideTier.Value;
            }
            payout = await _payouts.ApplyApprovalAsync(shipment, project, userId.Value, level, dto.OverrideHours);
        }

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
            ScreenshotUrl = screenshotUrl,
            TechnicalFeatures = dto.TechnicalFeatures,
            DeflationJustification = dto.DeflationJustification,
            AdditionalJustification = dto.AdditionalJustification,
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
        // Approval here is only the first pass: the project goes to fraud review
        // (second pass), and AirtablePushWorker pushes the shipment to Airtable. A design
        // ship that requested funding instead waits on its grant, after which the build
        // can be shipped (see ShipmentController.Create).
        if (dto.Status == ShipmentReviewStatus.approved)
        {
            project.Status = payout?.Grant is not null ? ProjectStatus.Build_Grant_Pending : ProjectStatus.Fraud_Pending;
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

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The unique ShipmentId index on ledger entries / grants: another reviewer
            // approved this shipment at the same moment.
            return Conflict("This shipment was reviewed at the same time by someone else.");
        }
        if (payout?.Volts > 0) await _payouts.AddToBalanceAsync(shipment.UserId, payout.Volts);
        await tx.CommitAsync();

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
            ScreenshotUrl = review.ScreenshotUrl,
            TechnicalFeatures = review.TechnicalFeatures,
            DeflationJustification = review.DeflationJustification,
            AdditionalJustification = review.AdditionalJustification,
            Exceptional = review.Exceptional,
            ApprovedHours = shipment.ApprovedHours,
            PaidHours = shipment.PaidHours,
            VoltsPerHour = shipment.VoltsPerHour,
            VoltsGranted = shipment.VoltsGranted,
            GrantId = payout?.Grant?.Id,
            CreatedAt = review.CreatedAt
        });
    }
}
