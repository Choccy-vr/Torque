namespace Torque.Shop;
// Body of POST api/shop/purchase. No price: the server works it out.
public record PurchaseDto
{
    public Guid? ItemId { get; init; }
    // Required when the item has options.
    public Guid? VariantId { get; init; }
    public int? Quantity { get; init; }
    // Must be true: the buyer ticked "ship to this address" at checkout.
    public bool? AddressConfirmed { get; init; }
    public string? Note { get; init; }
    // Generated once per checkout; a retry with the same id returns the same order.
    public Guid? ClientRequestId { get; init; }
}
