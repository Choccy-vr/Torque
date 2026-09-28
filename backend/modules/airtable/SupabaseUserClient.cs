using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Torque.Airtable;

// Reads a user's Supabase user_metadata (the OIDC claims from Hack Club Auth) via the
// admin API. User.Id is the Supabase `sub`, so it doubles as the admin-API user id.
public class SupabaseUserClient
{
    private readonly HttpClient _http;
    private readonly AirtableOptions _options;
    private readonly ILogger<SupabaseUserClient> _logger;

    public SupabaseUserClient(HttpClient http, AirtableOptions options, ILogger<SupabaseUserClient> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    public bool Configured => !string.IsNullOrEmpty(_options.SupabaseUrl) && !string.IsNullOrEmpty(_options.SupabaseServiceRoleKey);

    // Returns the user's user_metadata object; an empty object when the user has none or
    // doesn't exist; null on a transient failure (so the caller can retry later rather
    // than push a row with missing personal info).
    public async Task<JsonElement?> GetUserMetadataAsync(Guid userId)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.SupabaseUrl}/auth/v1/admin/users/{userId}");
            request.Headers.Add("apikey", _options.SupabaseServiceRoleKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.SupabaseServiceRoleKey);

            var response = await _http.SendAsync(request);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return EmptyObject();
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Supabase admin user fetch failed ({Status}) for user {UserId}", response.StatusCode, userId);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json.TryGetProperty("user_metadata", out var metadata) && metadata.ValueKind == JsonValueKind.Object
                ? metadata
                : EmptyObject();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Supabase admin user fetch error for user {UserId}", userId);
            return null;
        }
    }

    private static JsonElement EmptyObject() => JsonDocument.Parse("{}").RootElement;
}
