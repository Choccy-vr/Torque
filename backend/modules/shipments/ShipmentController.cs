using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Extensions;
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
    public ShipmentController(AppDbContext db) => _db = db;

    // Get shipments all per user
    [Authorize]
    [HttpGet("get/me")]
    public async Task<IActionResult> GetMeShips()
    {
        var userId = this.GetUserId();
        if (userId is null) return Unauthorized();

        var shipments = await _db.Shipments
            .Where(s => s.UserId == userId.Value)
            .Select(s => new OwnShipmentDto
            {
                Id = s.Id,
                UserId = s.UserId,
                ProjectId = s.ProjectId,
                Status = s.Status,
                HourSnapshot = s.HourSnapshot,
                OverrideHours = s.OverrideHours,
                OverrideTier = s.OverrideTier,
                ReviewId = s.ReviewId,
                ReviewedAt = s.ReviewedAt,
                VoltsGranted = s.VoltsGranted,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(shipments);
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

        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return BadRequest("ProjectId does not reference an existing project.");

        if (project.OwnerUserId != userId.Value) return Forbid();

        if (project.Status != ProjectStatus.Unshipped && project.Status != ProjectStatus.Changes_Needed)
        {
            return BadRequest("This project cannot be shipped from its current status.");
        }

        Shipment shipment = new Shipment
        {
            UserId = userId.Value,
            ProjectId = project.Id,
            Status = ShipmentStatus.unreviewed,
            HourSnapshot = project.TotalHoursRaw,
            TierSnapshot = project.Tier,
            ProjectSnapshot = project
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
            CreatedAt = shipment.CreatedAt
        });
    }
}