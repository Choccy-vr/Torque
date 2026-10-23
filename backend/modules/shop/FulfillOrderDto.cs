namespace Torque.Shop;
// Body for marking an order shipped
public record FulfillOrderDto
{
    public string? TrackingReference { get; init; }
    public string? Note { get; init; }
}
