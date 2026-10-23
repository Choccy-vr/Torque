namespace Torque.Shop;
// Body for creating (POST api/admin/shop/items, or one row of items/bulk) or replacing
// (PUT api/admin/shop/items/{id}) an item. Fields are nullable so missing ones can be
// reported; a PUT replaces every field, so send the whole item.
public record ShopItemInputDto
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public int? Tier { get; init; }
    public int? Price { get; init; }
    public string[]? Regions { get; init; }
    public Dictionary<string, int>? RegionalPrices { get; init; }
    public int? Stock { get; init; }
    public int? MaxPerUser { get; init; }
    public ShopRandomMode? RandomMode { get; init; }
    public bool? IsActive { get; init; }
    public int? SortOrder { get; init; }
    public string? FulfillerNotes { get; init; }
    public List<ShopVariantInputDto>? Variants { get; init; }
}

public record ShopVariantInputDto
{
    // Set to keep (and edit) an existing variant; leave out to add a new one. On a PUT,
    // existing variants not listed are deleted.
    public Guid? Id { get; init; }
    public string? Name { get; init; }
    public int? PriceDelta { get; init; }
    public int? Stock { get; init; }
    public bool? IsActive { get; init; }
    public int? SortOrder { get; init; }
}
