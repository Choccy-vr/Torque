using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Grants;
using Torque.Projects;
using Torque.Shipments;
using Torque.Streaks;

namespace Torque.Payouts;

// Payouts, made when a ship gets its final approval from Airtable (fraud review — see
// AirtableWebhookController). First-pass review pays nothing. A build ship
// (IsBuildComplete = true) converts every credited hour not yet paid or covered by a grant
// into Volts at the project's level/streak rate; a design ship that requested funding
// gets a Grant for an admin to send.
public class PayoutService
{
    // A grant of $N covers N / 5 hours, which aren't paid again as Volts.
    public const decimal GrantDollarsPerHour = 5;

    private readonly AppDbContext _db;
    public PayoutService(AppDbContext db) => _db = db;

    public record PayoutResult(int Volts, Grant? Grant);

    // Journaled hours not yet credited by a final-approved ship. Snapshotted as a ship's hours.
    public async Task<float> UnpaidJournalHoursAsync(Guid projectId, CancellationToken ct = default)
    {
        var journaled = await _db.Devlogs
            .Where(d => d.ProjectId == projectId)
            .SumAsync(d => d.TrackedSeconds, ct) / 3600;
        var credited = await _db.Shipments
            .Where(s => s.ProjectId == projectId && s.FinalApprovedAt != null)
            .SumAsync(s => (double)s.ApprovedHours, ct);
        return (float)Math.Max(0, journaled - credited);
    }

    // Final approval: credits the ship's hours (overrideHours, else the reviewer's
    // override, else the hours snapshotted when it was shipped) and pays it out — Volts to
    // the ledger for a build ship, a Grant for a design ship that requested funding. Then
    // save, then AddToBalanceAsync(Volts), in one transaction. The project's level must
    // already be validated as 1–4.
    public async Task<PayoutResult> ApproveAsync(
        Shipment shipment, Project project, Guid? paidByUserId, float? overrideHours, CancellationToken ct = default)
    {
        var approvedHours = overrideHours ?? (shipment.OverrideHours > 0 ? shipment.OverrideHours : shipment.HourSnapshot);
        if (overrideHours is not null) shipment.OverrideHours = overrideHours.Value;

        shipment.ApprovedHours = approvedHours;
        project.TotalHoursApproved += approvedHours;

        if (!shipment.IsBuildComplete)
        {
            if (shipment.RequestedFunding <= 0) return new PayoutResult(0, null);

            var grant = new Grant
            {
                ShipmentId = shipment.Id,
                ProjectId = project.Id,
                UserId = shipment.UserId,
                Amount = shipment.RequestedFunding
            };
            _db.Grants.Add(grant);
            project.GrantStatus = ProjectGrantStatus.Pending;
            return new PayoutResult(0, grant);
        }

        var earlier = await _db.Shipments
            .Where(s => s.ProjectId == project.Id && s.FinalApprovedAt != null && s.Id != shipment.Id)
            .Select(s => new { s.ApprovedHours, s.PaidHours })
            .ToListAsync(ct);
        var grantDollars = await _db.Grants
            .Where(g => g.ProjectId == project.Id)
            .SumAsync(g => g.Amount, ct);

        // Everything credited so far, minus what earlier build ships paid and what grants covered.
        var payableHours = (decimal)(earlier.Sum(s => s.ApprovedHours) + approvedHours - earlier.Sum(s => s.PaidHours))
            - grantDollars / GrantDollarsPerHour;
        payableHours = Math.Max(0, payableHours);

        // The streak was paused while the ship was in review, so this is the rate it shipped at.
        var rate = StreakService.VoltsPerHour(project.Tier, project.StreakCount);
        var volts = (int)Math.Floor(payableHours * rate);

        shipment.PaidHours = (float)payableHours;
        shipment.VoltsPerHour = rate;
        shipment.VoltsGranted = volts;
        project.VoltsGranted += volts;

        if (volts > 0)
        {
            _db.LedgerEntries.Add(new LedgerEntry
            {
                UserId = shipment.UserId,
                Amount = volts,
                Kind = LedgerEntryKind.ship_payout,
                Reason = $"Ship payout: {project.Title}",
                ShipmentId = shipment.Id,
                CreatedByUserId = paidByUserId
            });
        }

        return new PayoutResult(volts, null);
    }

    // Atomic increment of the cached balance, so concurrent payouts never lose an update.
    public Task AddToBalanceAsync(Guid userId, int amount, CancellationToken ct = default) =>
        _db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.Volts, x => x.Volts + amount), ct);

    // Manual admin credit/debit. Returns the new balance, or null if the user doesn't
    // exist or a debit would take them below 0.
    public async Task<int?> AdjustAsync(Guid userId, int amount, string reason, Guid adminId, CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var updated = await _db.Users
            .Where(u => u.Id == userId && u.Volts + amount >= 0)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.Volts, x => x.Volts + amount), ct);
        if (updated == 0) return null;

        _db.LedgerEntries.Add(new LedgerEntry
        {
            UserId = userId,
            Amount = amount,
            Kind = LedgerEntryKind.admin_adjustment,
            Reason = reason,
            CreatedByUserId = adminId
        });
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.Volts)
            .FirstAsync(ct);
    }

    public Task<List<LedgerEntryDto>> HistoryAsync(Guid userId, CancellationToken ct = default) =>
        _db.LedgerEntries
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new LedgerEntryDto
            {
                Id = e.Id,
                Amount = e.Amount,
                Kind = e.Kind,
                Reason = e.Reason,
                ShipmentId = e.ShipmentId,
                CreatedByUserId = e.CreatedByUserId,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync(ct);
}
