namespace Torque.Payouts;
// One Volts history row, returned to the user it belongs to and to admins
// Derived from LedgerEntry.cs
public record LedgerEntryDto
{
    public Guid Id { get; init; }
    public int Amount { get; init; }
    public LedgerEntryKind Kind { get; init; }
    public string Reason { get; init; } = null!;
    public Guid? ShipmentId { get; init; }
    public Guid? CreatedByUserId { get; init; }
    public DateTime CreatedAt { get; init; }
}
