namespace Torque.Shop;
// An item with everything an admin can edit, plus how many have sold.
// Derived from ShopItem.cs
public record AdminShopItemDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = null!;
    public string Description { get; init; } = null!;
    public string? ImageUrl { get; init; }
    public int Tier { get; init; }
    public int Price { get; init; }
    public string[] Regions { get; init; } = [];
    public Dictionary<string, int> RegionalPrices { get; init; } = new();
    public int? Stock { get; init; }
    public int? MaxPerUser { get; init; }
    public ShopRandomMode RandomMode { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public string? FulfillerNotes { get; init; }
    public List<AdminShopVariantDto> Variants { get; init; } = [];
    // Units across non-refunded orders.
    public int Sold { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static AdminShopItemDto From(ShopItem item, int sold) => new()
    {
        Id = item.Id,
        Name = item.Name,
        Description = item.Description,
        ImageUrl = item.ImageUrl,
        Tier = item.Tier,
        Price = item.Price,
        Regions = item.Regions,
        RegionalPrices = item.RegionalPrices,
        Stock = item.Stock,
        MaxPerUser = item.MaxPerUser,
        RandomMode = item.RandomMode,
        IsActive = item.IsActive,
        SortOrder = item.SortOrder,
        FulfillerNotes = item.FulfillerNotes,
        Variants = item.Variants
            .OrderBy(v => v.SortOrder).ThenBy(v => v.Name)
            .Select(v => new AdminShopVariantDto
            {
                Id = v.Id,
                Name = v.Name,
                PriceDelta = v.PriceDelta,
                Stock = v.Stock,
                IsActive = v.IsActive,
                SortOrder = v.SortOrder,
            })
            .ToList(),
        Sold = sold,
        CreatedAt = item.CreatedAt,
        UpdatedAt = item.UpdatedAt,
    };
}

public record AdminShopVariantDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = null!;
    public int PriceDelta { get; init; }
    public int? Stock { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
}
