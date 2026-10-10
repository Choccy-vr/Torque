using Microsoft.EntityFrameworkCore;
using Torque.Data;
using Torque.Grants;
using Torque.Projects;
using Torque.Shipments;
using Torque.Streaks;

namespace Torque.Payouts;

// Volts payouts, paid when a reviewer approves a ship. A design ship
// (IsBuildComplete = false) only credits hours; a build ship converts every credited hour
// not yet paid or covered by a grant into Volts at the project's level/streak rate.
public class PayoutService
{
    // A grant of $N covers N / 5 hours, which aren't paid again as Volts.
    public const decimal GrantDollarsPerHour = 5;

    private readonly AppDbContext _db;
    public PayoutService(AppDbContext db) => _db = db;

    public record ApprovalResult(int Volts, Grant? Grant);

    // Journaled hours not yet credited by an approved ship. The default hours for a ship.
    public async Task<float> UnpaidJournalHoursAsync(Guid projectId, CancellationToken ct = default)
    {
        var journaled = await _db.Devlogs
            .Where(d => d.ProjectId == projectId)
            .SumAsync(d => d.TrackedSeconds, ct) / 3600;
        var credited = await _db.Shipments
            .Where(s => s.ProjectId == projectId && s.Status == ShipmentStatus.approved)
            .SumAsync(s => (double)s.ApprovedHours, ct);
        return (float)Math.Max(0, journaled - credited);
    }

    // Credits hours for an approved shipment, and for a build ship adds the Volts payout
    // to the ledger; for a design ship with requested funding, adds a Grant to fulfil.
    // Call before marking the shipment approved, then save, then AddToBalanceAsync(Volts)
    // in the same transaction. The level must already be validated as 1–4.
    public async Task<ApprovalResult> ApplyApprovalAsync(
        Shipment shipment, Project project, Guid reviewerId, int level, float? overrideHours,
        CancellationToken ct = default)
    {
        var approvedHours = overrideHours ?? await UnpaidJournalHoursAsync(project.Id, ct);
        if (overrideHours is not null) shipment.OverrideHours = overrideHours.Value;

        shipment.ApprovedHours = approvedHours;
        project.TotalHoursApproved += approvedHours;

        if (!shipment.IsBuildComplete)
        {
            if (shipment.RequestedFunding <= 0) return new ApprovalResult(0, null);

            var grant = new Grant
            {
                ShipmentId = shipment.Id,
                ProjectId = project.Id,
                UserId = shipment.UserId,
                Amount = shipment.RequestedFunding
            };
            _db.Grants.Add(grant);
            return new ApprovalResult(0, grant);
        }

        var earlier = await _db.Shipments
            .Where(s => s.ProjectId == project.Id && s.Status == ShipmentStatus.approved && s.Id != shipment.Id)
            .Select(s => new { s.ApprovedHours, s.PaidHours })
            .ToListAsync(ct);
        var grantDollars = await _db.Grants
            .Where(g => g.ProjectId == project.Id)
            .SumAsync(g => g.Amount, ct);

        // Everything credited so far, minus what earlier build ships paid and what grants covered.
        var payableHours = (decimal)(earlier.Sum(s => s.ApprovedHours) + approvedHours - earlier.Sum(s => s.PaidHours))
            - grantDollars / GrantDollarsPerHour;
        payableHours = Math.Max(0, payableHours);

        var rate = StreakService.VoltsPerHour(level, project.StreakCount);
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
                CreatedByUserId = reviewerId
            });
        }

        return new ApprovalResult(volts, null);
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
