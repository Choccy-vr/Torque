namespace Torque.Shop;

// The fixed shipping regions items are enabled and priced for (Flavortown-style buckets).
// A buyer's region comes from the country on their Hack Club Auth address; anything not
// listed falls into XX (rest of world).
public static class ShopRegions
{
    public const string US = "US";
    public const string CA = "CA";
    public const string EU = "EU";
    public const string UK = "UK";
    public const string IN = "IN";
    public const string AU = "AU";
    public const string RestOfWorld = "XX";

    public static readonly IReadOnlyList<string> All = [US, CA, EU, UK, IN, AU, RestOfWorld];

    public static bool IsValid(string? code) => code is not null && All.Contains(code);

    // ISO 3166 alpha-2 codes and English names → region. HCA may send either.
    private static readonly Dictionary<string, string> Countries = Build();

    public static string RegionFor(string? country)
    {
        if (string.IsNullOrWhiteSpace(country)) return RestOfWorld;
        return Countries.TryGetValue(country.Trim(), out var region) ? region : RestOfWorld;
    }

    private static Dictionary<string, string> Build()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        void Add(string region, params string[] keys)
        {
            foreach (var key in keys) map[key] = region;
        }

        Add(US, "US", "USA", "United States", "United States of America");
        Add(CA, "CA", "Canada");
        Add(UK, "GB", "UK", "United Kingdom", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland");
        Add(IN, "IN", "India");
        Add(AU, "AU", "Australia");
        Add(EU,
            "AT", "Austria", "BE", "Belgium", "BG", "Bulgaria", "HR", "Croatia", "CY", "Cyprus",
            "CZ", "Czechia", "Czech Republic", "DK", "Denmark", "EE", "Estonia", "FI", "Finland",
            "FR", "France", "DE", "Germany", "GR", "Greece", "HU", "Hungary", "IE", "Ireland",
            "IT", "Italy", "LV", "Latvia", "LT", "Lithuania", "LU", "Luxembourg", "MT", "Malta",
            "NL", "Netherlands", "PL", "Poland", "PT", "Portugal", "RO", "Romania", "SK", "Slovakia",
            "SI", "Slovenia", "ES", "Spain", "SE", "Sweden");

        return map;
    }
}
