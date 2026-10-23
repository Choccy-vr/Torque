namespace Torque.Shop;
// An order in the fulfilment queue. Address fields are only filled on the detail
// endpoint (GET api/admin/shop/orders/{id}), not the list.
// Derived from ShopOrder.cs
public record AdminShopOrderDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Username { get; init; } = "";
    public string? UserEmail { get; init; }
    public string? UserSlackId { get; init; }
    public Guid? ShopItemId { get; init; }
    public Guid? VariantId { get; init; }
    public string ItemName { get; init; } = null!;
    public string? VariantName { get; init; }
    public string? ImageUrl { get; init; }
    public int Quantity { get; init; }
    public int UnitPrice { get; init; }
    public int TotalPrice { get; init; }
    public string Region { get; init; } = null!;
    public bool ViaDaily { get; init; }
    public ShopOrderStatus Status { get; init; }
    public string? UserNote { get; init; }
    public string? TrackingReference { get; init; }
    public string? AdminNote { get; init; }
    public string? FulfillerNotes { get; init; }
    public Guid? FulfilledByUserId { get; init; }
    public DateTime? FulfilledAt { get; init; }
    public DateTime? RefundedAt { get; init; }
    public DateTime CreatedAt { get; init; }

    public ShopAddress? Address { get; init; }
}
