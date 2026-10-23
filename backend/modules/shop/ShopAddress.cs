using System.Text.Json;
using Torque.Auth;

namespace Torque.Shop;

// A shipping address read from the user's HCA userinfo claims (OIDC `address` claim).
public record ShopAddress
{
    public string Name { get; init; } = "";
    public string Line1 { get; init; } = "";
    public string? Line2 { get; init; }
    public string City { get; init; } = "";
    public string? State { get; init; }
    public string? PostalCode { get; init; }
    public string Country { get; init; } = "";

    public string Region => ShopRegions.RegionFor(Country);

    // Null when the claims have no address, or it's missing a street, city or country.
    public static ShopAddress? FromClaims(JsonElement claims)
    {
        if (claims.ValueKind != JsonValueKind.Object
            || !claims.TryGetProperty("address", out var address)
            || address.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var lines = (HcaUserSync.Str(address, "street_address") ?? "")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var city = HcaUserSync.Str(address, "locality")?.Trim();
        var country = HcaUserSync.Str(address, "country")?.Trim();
        if (lines.Length == 0 || string.IsNullOrEmpty(city) || string.IsNullOrEmpty(country)) return null;

        var name = HcaUserSync.Str(claims, "name")?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            name = $"{HcaUserSync.Str(claims, "given_name")} {HcaUserSync.Str(claims, "family_name")}".Trim();
        }

        return new ShopAddress
        {
            Name = name,
            Line1 = lines[0],
            Line2 = lines.Length > 1 ? string.Join(", ", lines.Skip(1)) : null,
            City = city,
            State = Blank(HcaUserSync.Str(address, "region")),
            PostalCode = Blank(HcaUserSync.Str(address, "postal_code")),
            Country = country,
        };
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
