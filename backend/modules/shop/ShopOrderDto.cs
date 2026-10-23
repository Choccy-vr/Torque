namespace Torque.Shop;
// One of the caller's own orders. Leaves out the address and staff notes.
// Derived from ShopOrder.cs
public record ShopOrderDto
{
    public Guid Id { get; init; }
    public Guid? ShopItemId { get; init; }
    public string ItemName { get; init; } = null!;
    public string? VariantName { get; init; }
    public string? ImageUrl { get; init; }
    public int Quantity { get; init; }
    public int UnitPrice { get; init; }
    public int TotalPrice { get; init; }
    public bool ViaDaily { get; init; }
    public ShopOrderStatus Status { get; init; }
    public string? TrackingReference { get; init; }
    public string? UserNote { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? FulfilledAt { get; init; }
    public DateTime? RefundedAt { get; init; }
}
