using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
using Torque.Reviews;
// Admin-only ship lookup (any user's ships, with reviews and Airtable state)
// endpoint: /api/admin/ships

namespace Torque.Shipments;

[ApiController]
[Route("api/admin/ships")]
public class AdminShipmentController : ControllerBase
{
    private const int MaxResults = 50;

    private readonly AppDbContext _db;
    public AdminShipmentController(AppDbContext db) => _db = db;

    // Ships newest first. q matches a ship/project/user id, the project title or the
    // shipper's username; status, userId and projectId filter.
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] ShipmentStatus? status, [FromQuery] Guid? userId, [FromQuery] Guid? projectId)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var ships = _db.Shipments.AsQueryable();
        if (status is not null) ships = ships.Where(s => s.Status == status);
        if (userId is not null) ships = ships.Where(s => s.UserId == userId);
        if (projectId is not null) ships = ships.Where(s => s.ProjectId == projectId);

        var query = q?.Trim();
        if (!string.IsNullOrEmpty(query))
        {
            if (Guid.TryParse(query, out var id))
            {
                ships = ships.Where(s => s.Id == id || s.ProjectId == id || s.UserId == id);
            }
            else
            {
                var pattern = $"%{query}%";
                ships = ships.Where(s =>
                    _db.Projects.Any(p => p.Id == s.ProjectId && EF.Functions.ILike(p.Title, pattern)) ||
                    _db.Users.Any(u => u.Id == s.UserId && EF.Functions.ILike(u.Username, pattern)));
            }
        }

        var results = await ships
            .OrderByDescending(s => s.CreatedAt)
            .Take(MaxResults)
            .Select(s => new AdminShipmentSummaryDto
            {
                Id = s.Id,
                ProjectId = s.ProjectId,
                ProjectTitle = _db.Projects.Where(p => p.Id == s.ProjectId).Select(p => p.Title).FirstOrDefault() ?? "",
                UserId = s.UserId,
                Username = _db.Users.Where(u => u.Id == s.UserId).Select(u => u.Username).FirstOrDefault() ?? "",
                Status = s.Status,
                IsBuildComplete = s.IsBuildComplete,
                HourSnapshot = s.HourSnapshot,
                ApprovedHours = s.ApprovedHours,
                VoltsGranted = s.VoltsGranted,
                RequestedFunding = s.RequestedFunding,
                PushedToAirtable = s.AirtableRecordId != null,
                FinalApprovedAt = s.FinalApprovedAt,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(results);
    }

    // One ship with its reviews (newest first) and Airtable state
    [Authorize]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var (_, denied) = await this.RequireRoleAsync(_db, "admin");
        if (denied is not null) return denied;

        var shipment = await _db.Shipments
            .Where(s => s.Id == id)
            .Select(s => new AdminShipmentDetailDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                ReviewerNote = s.ReviewerNote,
                Feedback = s.Feedback,
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
                FinalApprovedAt = s.FinalApprovedAt,
                IsBuildComplete = s.IsBuildComplete,
                RequestedFunding = s.RequestedFunding,
                HowDidYouHear = s.HowDidYouHear,
                WhatAreWeDoingWell = s.WhatAreWeDoingWell,
                HowCanWeImprove = s.HowCanWeImprove,
                CreatedAt = s.CreatedAt,
                ProjectTitle = _db.Projects.Where(p => p.Id == s.ProjectId).Select(p => p.Title).FirstOrDefault() ?? "",
                Username = _db.Users.Where(u => u.Id == s.UserId).Select(u => u.Username).FirstOrDefault() ?? "",
                AirtableRecordId = s.AirtableRecordId,
                AirtablePushedAt = s.AirtablePushedAt
            })
            .FirstOrDefaultAsync();
        if (shipment is null) return NotFound();

        var reviews = await _db.ShipmentReviews
            .Where(r => r.ShipmentId == id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminShipmentReviewDto
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                ShipmentId = r.ShipmentId,
                ReviewerId = r.ReviewerId,
                ReviewerUsername = _db.Users.Where(u => u.Id == r.ReviewerId).Select(u => u.Username).FirstOrDefault(),
                Status = r.Status,
                HideReviewerName = r.HideReviewerName,
                ReturnedBy = r.ReturnedBy,
                Feedback = r.Feedback,
                InternalNote = r.InternalNote,
                OverrideJustification = r.OverrideJustification,
                ScreenshotUrl = r.ScreenshotUrl,
                TechnicalFeatures = r.TechnicalFeatures,
                DeflationJustification = r.DeflationJustification,
                AdditionalJustification = r.AdditionalJustification,
                Exceptional = r.Exceptional,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(shipment with { Reviews = reviews });
    }
}
