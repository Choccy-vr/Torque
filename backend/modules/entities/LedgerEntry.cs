namespace Torque.Payouts;
// One Volts change for a user. Append-only: AppDbContext refuses to update or delete
// these, so a correction is a new offsetting entry. User.Volts is the cached sum.
public class LedgerEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    // Signed: positive credits Volts, negative debits them.
    public int Amount { get; set; }

    public LedgerEntryKind Kind { get; set; }
    public string Reason { get; set; } = null!;

    // The approved shipment this paid out (ship_payout only). Unique, so a ship is never
    // paid twice.
    public Guid? ShipmentId { get; set; }

    // The reviewer/admin who caused this entry.
    public Guid? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum LedgerEntryKind
{
    ship_payout,
    admin_adjustment
}
