using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Torque.Data;
using Torque.Payouts;
using Torque.Projects;
using Torque.Shipments;
using Torque.Streaks;
// Called by an Airtable automation when a shipment's record is approved: the ship's final
// approval (fraud review, the second pass). Not a user endpoint — no login token works
// here; the only way in is the shared secret in the X-Webhook-Secret header.
// endpoint: /api/airtable/<command>

namespace Torque.Airtable;

[ApiController]
[Route("api/airtable")]
[EnableRateLimiting(AirtableExtension.WebhookRateLimit)]
public class AirtableWebhookController : ControllerBase
{
    private const string SecretHeader = "X-Webhook-Secret";

    private readonly AppDbContext _db;
    private readonly PayoutService _payouts;
    private readonly AirtableOptions _options;
    private readonly ILogger<AirtableWebhookController> _logger;

    public AirtableWebhookController(AppDbContext db, PayoutService payouts, AirtableOptions options, ILogger<AirtableWebhookController> logger)
    {
        _db = db;
        _payouts = payouts;
        _options = options;
        _logger = logger;
    }

    // Final approval: credits the ship's hours (optionally adjusted), pays the Volts (build
    // ship) or creates the grant (design ship that requested funding), and moves the
    // project Fraud_Pending -> Approved. Safe to call twice for the same ship.
    [HttpPost("approve")]
    public async Task<IActionResult> Approve([FromBody] AirtableApproveDto dto)
    {
        if (string.IsNullOrEmpty(_options.WebhookSecret)) return StatusCode(503, "Airtable webhook is not configured.");
        if (!HasValidSecret())
        {
            _logger.LogWarning("Rejected Airtable webhook call with a bad secret from {Ip}", HttpContext.Connection.RemoteIpAddress);
            return Unauthorized();
        }

        if (dto.ShipmentId is null || dto.ShipmentId == Guid.Empty) return BadRequest("ShipmentId is required!");
        if (dto.OverrideHours is < 0 || (dto.OverrideHours is { } h && !float.IsFinite(h)))
        {
            return BadRequest("OverrideHours must be a number >= 0.");
        }

        var shipment = await _db.Shipments.FindAsync(dto.ShipmentId.Value);
        if (shipment is null) return NotFound("ShipmentId does not reference an existing shipment.");

        var project = await _db.Projects.FindAsync(shipment.ProjectId);
        if (project is null) return NotFound();

        if (shipment.FinalApprovedAt is not null) return Ok(await AlreadyApprovedAsync(shipment, project));

        if (shipment.Status != ShipmentStatus.approved || project.Status != ProjectStatus.Fraud_Pending)
        {
            return Conflict($"This shipment isn't awaiting final approval (shipment {shipment.Status}, project {project.Status}).");
        }
        // The level sets the Volts rate. First-pass review already required one.
        if (project.Tier is < 1 or > 4) return Conflict("The project has no valid level (1–4).");

        var owner = await _db.Users.FindAsync(project.OwnerUserId);
        if (owner is null) return NotFound();

        await using var tx = await _db.Database.BeginTransactionAsync();

        // Claims the shipment, so an automation that fires twice can't pay twice: the
        // second call blocks on this row, then matches nothing once the first commits.
        var now = DateTime.UtcNow;
        var claimed = await _db.Shipments
            .Where(s => s.Id == shipment.Id && s.FinalApprovedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.FinalApprovedAt, now));
        if (claimed == 0)
        {
            await tx.RollbackAsync();
            await _db.Entry(shipment).ReloadAsync();
            await _db.Entry(project).ReloadAsync();
            return Ok(await AlreadyApprovedAsync(shipment, project));
        }
        shipment.FinalApprovedAt = now;

        // The ledger entry is credited to the first-pass reviewer.
        var reviewerId = shipment.ReviewId is { } reviewId
            ? await _db.ShipmentReviews.Where(r => r.Id == reviewId).Select(r => (Guid?)r.ReviewerId).FirstOrDefaultAsync()
            : null;

        var payout = await _payouts.ApproveAsync(shipment, project, reviewerId, dto.OverrideHours);
        project.Status = ProjectStatus.Approved;
        StreakService.ResumeAfterReview(project, owner);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The unique ShipmentId index on ledger entries / grants: this ship was already
            // paid (approved before payouts moved to final approval).
            return Conflict("This shipment has already been paid out.");
        }
        if (payout.Volts > 0) await _payouts.AddToBalanceAsync(shipment.UserId, payout.Volts);
        await tx.CommitAsync();

        return Ok(new AirtableApprovalDto
        {
            ShipmentId = shipment.Id,
            ProjectId = project.Id,
            ProjectStatus = project.Status,
            GrantStatus = project.GrantStatus,
            ApprovedHours = shipment.ApprovedHours,
            VoltsPerHour = shipment.VoltsPerHour,
            VoltsPaid = payout.Volts,
            GrantId = payout.Grant?.Id,
            AlreadyApproved = false,
            FinalApprovedAt = now
        });
    }

    private bool HasValidSecret()
    {
        var sent = Request.Headers[SecretHeader].ToString();
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(sent),
            Encoding.UTF8.GetBytes(_options.WebhookSecret!));
    }

    private async Task<AirtableApprovalDto> AlreadyApprovedAsync(Shipment shipment, Project project) => new()
    {
        ShipmentId = shipment.Id,
        ProjectId = project.Id,
        ProjectStatus = project.Status,
        GrantStatus = project.GrantStatus,
        ApprovedHours = shipment.ApprovedHours,
        VoltsPerHour = shipment.VoltsPerHour,
        VoltsPaid = shipment.VoltsGranted,
        GrantId = await _db.Grants.Where(g => g.ShipmentId == shipment.Id).Select(g => (Guid?)g.Id).FirstOrDefaultAsync(),
        AlreadyApproved = true,
        FinalApprovedAt = shipment.FinalApprovedAt!.Value
    };
}
