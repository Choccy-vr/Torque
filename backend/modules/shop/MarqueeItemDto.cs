namespace Torque.Shop;
// One item on the landing page's scrolling tape. Public, so no prices or stock.
public record MarqueeItemDto
{
    public string Name { get; init; } = null!;
    public string? ImageUrl { get; init; }
    public int Tier { get; init; }
}
