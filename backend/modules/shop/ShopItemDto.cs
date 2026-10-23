namespace Torque.Shop;
// One item as a buyer sees it. Prices are already resolved for their region.
// Derived from ShopItem.cs
public record ShopItemDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = null!;
    public string Description { get; init; } = null!;
    public string? ImageUrl { get; init; }
    public int Tier { get; init; }
    // The price with no variant, or the cheapest variant's.
    public int Price { get; init; }
    // null = unlimited. With variants, this is null and each variant has its own.
    public int? Stock { get; init; }
    public int? MaxPerUser { get; init; }
    public int Owned { get; init; }
    public ShopRandomMode RandomMode { get; init; }
    public string[] Regions { get; init; } = [];
    public List<ShopVariantDto> Variants { get; init; } = [];
    // Null = buyable; otherwise one of ShopService.Reasons.
    public string? UnavailableReason { get; init; }
    public string? UnavailableMessage { get; init; }
}

public record ShopVariantDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = null!;
    public int Price { get; init; }
    public int? Stock { get; init; }
}
