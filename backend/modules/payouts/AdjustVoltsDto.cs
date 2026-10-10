namespace Torque.Payouts;
// Body for an admin's manual Volts credit/debit
public record AdjustVoltsDto
{
    // Signed, non-zero: positive credits, negative debits.
    public int? Amount { get; init; }
    public string? Reason { get; init; }
}
