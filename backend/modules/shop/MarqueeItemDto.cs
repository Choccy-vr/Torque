namespace Torque.Shop;
// One item on the landing page's scrolling tape. Public, so only the base (default
// region) price, the lowest across its options; no stock.
public record MarqueeItemDto
{
    public string Name { get; init; } = null!;
    public string? ImageUrl { get; init; }
    public int Tier { get; init; }
    public string Description { get; init; } = "";
    public int Price { get; init; }
    // True when it has options, so the price reads "From".
    public bool HasOptions { get; init; }
}
