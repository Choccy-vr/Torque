namespace Torque.Shop;
// One option of an item, e.g. a USB drive's "64 GB". An item with variants must be
// bought as one of them.
public class ShopItemVariant
{
    public Guid Id { get; set; }
    public Guid ShopItemId { get; set; }

    public string Name { get; set; } = null!;
    // Volts added to the item's (regional) price. Can be negative.
    public int PriceDelta { get; set; }
    // null = unlimited
    public int? Stock { get; set; }

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
