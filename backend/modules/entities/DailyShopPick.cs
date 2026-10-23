namespace Torque.Shop;
// The random item of the day. Date is the US Eastern day it's for; the row is created
// lazily by the first request that day (see ShopService.GetOrCreateDailyAsync).
public class DailyShopPick
{
    public DateOnly Date { get; set; }
    public Guid ShopItemId { get; set; }

    // Set when an admin picked or rerolled it by hand.
    public Guid? SetByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
