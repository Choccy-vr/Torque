namespace Torque.Shop;
// A prize in the shop. Unlocked by the buyer's highest approved project level (Tier),
// unless it's today's random item (see DailyShopPick), which anyone can buy.
public class ShopItem
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;
    public string Description { get; set; } = "";
    // http(s) image URL, pasted by an admin like project covers
    public string? ImageUrl { get; set; }

    // 1–4: the project level that unlocks it.
    public int Tier { get; set; }

    // Volts, before any regional override and variant delta (see ShopService.PriceFor).
    public int Price { get; set; }

    // Region codes (ShopRegions.All) it ships to. Not listed = can't be bought there.
    public string[] Regions { get; set; } = [];
    // Region code → price that replaces Price there.
    public Dictionary<string, int> RegionalPrices { get; set; } = new();

    // null = unlimited. Ignored when the item has variants (each tracks its own).
    public int? Stock { get; set; }
    // Most a user can hold across their non-refunded orders. null = no limit.
    public int? MaxPerUser { get; set; }

    public ShopRandomMode RandomMode { get; set; } = ShopRandomMode.eligible;

    // Inactive items are hidden and can't be bought or rolled as the daily item.
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    // Staff-only notes for whoever ships it (supplier link, packing notes, …).
    public string? FulfillerNotes { get; set; }

    public List<ShopItemVariant> Variants { get; set; } = [];

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum ShopRandomMode
{
    // In its level's section, and can be rolled as the daily item.
    eligible,
    // Only buyable on a day it's the daily item; never listed in a level's section.
    random_only,
    // Never rolled as the daily item.
    never
}
