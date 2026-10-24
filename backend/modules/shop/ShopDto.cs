namespace Torque.Shop;
// GET api/shop: everything the shop page needs, priced for the caller's region.
public record ShopDto
{
    // Highest level among the caller's final-approved ships (0 = none yet).
    public int UnlockedTier { get; init; }
    public string Region { get; init; } = null!;
    public int Volts { get; init; }
    // When the shop closes for good (see Torque.Deadlines), UTC, and whether it has.
    public DateTime ClosesAt { get; init; }
    public bool Closed { get; init; }
    public DailyItemDto? Daily { get; init; }
    public List<ShopTierDto> Tiers { get; init; } = [];
}

public record DailyItemDto
{
    public DateOnly Date { get; init; }
    // When it rotates (next 12 AM US Eastern), UTC.
    public DateTime EndsAt { get; init; }
    public ShopItemDto Item { get; init; } = null!;
}

public record ShopTierDto
{
    public int Tier { get; init; }
    public bool Unlocked { get; init; }
    public List<ShopItemDto> Items { get; init; } = [];
}
