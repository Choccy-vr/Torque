namespace Torque.Shop;
// Body for an admin refund. The reason is DM'd to the buyer.
public record RefundOrderDto
{
    public string? Reason { get; init; }
}
