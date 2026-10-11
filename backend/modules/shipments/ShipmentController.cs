using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Payouts;
using Torque.Projects;
using Torque.Users;
// A controller for Shipments
// endpoint: /ships

namespace Torque.Shipments;

[ApiController]
[Route("api/ships")]
public class ShipmentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;

    public ShipmentController(AppDbContext db, PayoutService payouts)
    {
        _db = db;
        _payouts = payouts;
    }

    // Get shipments all per user
    [Authorize]
    [HttpGet("get/me")]
    public async Task<IActionResult> GetMeShips()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var shipments = await _db.Shipments
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new OwnShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                Status = s.Status,
                Feedback = s.Feedback,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                OverrideTier = s.OverrideTier,
                ReviewId = s.ReviewId,
                ReviewedAt = s.ReviewedAt,
                VoltsGranted = s.VoltsGranted,
                ApprovedHours = s.ApprovedHours,
                PaidHours = s.PaidHours,
                VoltsPerHour = s.VoltsPerHour,
                FinalApprovedAt = s.FinalApprovedAt,
                IsBuildComplete = s.IsBuildComplete,
                RequestedFunding = s.RequestedFunding,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(shipments);
    }

    // Get a single shipment by id (public view)
    [Authorize]
    [HttpGet("get/{id:guid}")]
    public async Task<IActionResult> GetShip(Guid id)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var shipment = await _db.Shipments
            .Where(s => s.Id == id)
            .Select(s => new PublicShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                Status = s.Status,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                OverrideTier = s.OverrideTier,
                VoltsGranted = s.VoltsGranted,
                CreatedAt = s.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (shipment is null) return NotFound();

        return Ok(shipment);
    }

    // Create a shipment (submit a project for review)
    [Authorize]
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateShipmentDto dto)
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        if (!Guid.TryParse(dto.ProjectId, out var projectId) || projectId == Guid.Empty)
        {
            return BadRequest("ProjectId is required!");
        }

        if (dto.IsBuildComplete is null) return BadRequest("IsBuildComplete is required!");
        if (dto.RequestedFunding is null or < 0) return BadRequest("RequestedFunding is required and can't be negative!");
        if (string.IsNullOrWhiteSpace(dto.HowDidYouHear)
            || string.IsNullOrWhiteSpace(dto.WhatAreWeDoingWell)
            || string.IsNullOrWhiteSpace(dto.HowCanWeImprove))
        {
            return BadRequest("HowDidYouHear, WhatAreWeDoingWell and HowCanWeImprove are required!");
        }

        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return BadRequest("ProjectId does not reference an existing project.");

        if (project.OwnerUserId != userId.Value) return Forbid();

        // Design vs build is always the shipper's call (IsBuildComplete). An approved design
        // can ship again either way, but a build ship waits for any grant the design asked
        // for to be sent. An approved build is final.
        if (project.Status == ProjectStatus.Approved)
        {
            if (dto.IsBuildComplete.Value && project.GrantStatus == ProjectGrantStatus.Pending)
            {
                return BadRequest("This project's build grant hasn't been sent yet.");
            }
            if (await _db.Shipments.AnyAsync(s => s.ProjectId == project.Id && s.IsBuildComplete && s.FinalApprovedAt != null))
            {
                return BadRequest("This project's build has already been approved.");
            }
        }
        else if (project.Status != ProjectStatus.Unshipped && project.Status != ProjectStatus.Changes_Needed)
        {
            return BadRequest("This project cannot be shipped from its current status.");
        }

        Shipment shipment = new Shipment
        {
            UserId = userId.Value,
            ProjectId = project.Id,
            Status = ShipmentStatus.unreviewed,
            HourSnapshot = await _payouts.UnpaidJournalHoursAsync(project.Id),
            TierSnapshot = project.Tier,
            ProjectSnapshot = project,
            IsBuildComplete = dto.IsBuildComplete.Value,
            RequestedFunding = dto.RequestedFunding.Value,
            HowDidYouHear = dto.HowDidYouHear.Trim(),
            WhatAreWeDoingWell = dto.WhatAreWeDoingWell.Trim(),
            HowCanWeImprove = dto.HowCanWeImprove.Trim()
        };

        _db.Shipments.Add(shipment);
        project.Status = ProjectStatus.Unreviewed;
        await _db.SaveChangesAsync();

        return Ok(new OwnShipmentDto
        {
            Id = shipment.Id,
            UserId = shipment.UserId,
            ProjectId = shipment.ProjectId,
            Status = shipment.Status,
            HourSnapshot = shipment.HourSnapshot,
            OverrideHours = shipment.OverrideHours,
            OverrideTier = shipment.OverrideTier,
            ReviewId = shipment.ReviewId,
            ReviewedAt = shipment.ReviewedAt,
            VoltsGranted = shipment.VoltsGranted,
            ApprovedHours = shipment.ApprovedHours,
            PaidHours = shipment.PaidHours,
            VoltsPerHour = shipment.VoltsPerHour,
            FinalApprovedAt = shipment.FinalApprovedAt,
            IsBuildComplete = shipment.IsBuildComplete,
            RequestedFunding = shipment.RequestedFunding,
            CreatedAt = shipment.CreatedAt
        });
    }
}