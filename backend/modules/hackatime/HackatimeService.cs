using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Torque.Data;
using Torque.Users;

namespace Torque.Hackatime;

public class HackatimeService
{
    // Written to User.InternalNote when the connect-time trust check bans an account.
    public const string ConnectBanMarker = "hackatime_banned_at_connect";

    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly HackatimeOptions _options;
    private readonly ILogger<HackatimeService> _logger;

    public HackatimeService(HttpClient http, AppDbContext db, HackatimeOptions options, ILogger<HackatimeService> logger)
    {
        _http = http;
        _db = db;
        _options = options;
        _logger = logger;
    }

    public bool Configured => !string.IsNullOrEmpty(_options.ClientId) && !string.IsNullOrEmpty(_options.ClientSecret);

    private string SignState(string state)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.StateSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"hackatime:{state}"));
        return Convert.ToHexStringLower(hash);
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var bytesA = Encoding.UTF8.GetBytes(a);
        var bytesB = Encoding.UTF8.GetBytes(b);
        if (bytesA.Length != bytesB.Length) return false;
        return CryptographicOperations.FixedTimeEquals(bytesA, bytesB);
    }

    private static void Ban(User user, string marker, string detail)
    {
        user.Role = [.. (user.Role ?? []).Where(r => r != "banned"), "banned"];
        user.InternalNote = $"{marker}: {detail}";
    }

    // Builds the Hackatime authorize URL. `state` is handed back to the caller so the
    // frontend can hold onto it (e.g. sessionStorage) and echo it back as `storedState`
    // in the callback — that round trip is what proves the callback belongs to a flow
    // this backend actually started, since there's no server-side session to check against.
    public (string Url, string State) StartAuth()
    {
        if (!Configured) throw new InvalidOperationException("Hackatime OAuth is not configured");

        var state = Guid.NewGuid().ToString();
        var signedState = $"{state}.{SignState(state)}";

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = _options.ClientId,
            ["redirect_uri"] = _options.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = "profile read",
            ["state"] = signedState
        };

        var url = QueryHelpers.AddQueryString($"{_options.BaseUrl}/oauth/authorize", query);
        return (url, state);
    }

    public async Task HandleCallbackAsync(Guid userId, string code, string returnedSignedState, string storedState)
    {
        if (!Configured) throw new InvalidOperationException("Hackatime OAuth is not configured");

        var dotIndex = returnedSignedState.LastIndexOf('.');
        if (dotIndex == -1) throw new InvalidOperationException("Malformed state parameter");

        var stateValue = returnedSignedState[..dotIndex];
        var signature = returnedSignedState[(dotIndex + 1)..];

        if (!FixedTimeEquals(stateValue, storedState))
        {
            throw new InvalidOperationException("State mismatch");
        }

        if (!FixedTimeEquals(signature, SignState(stateValue)))
        {
            throw new InvalidOperationException("Invalid state signature");
        }

        var tokenResponse = await _http.PostAsync($"{_options.BaseUrl}/oauth/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = _options.RedirectUri,
            ["client_id"] = _options.ClientId!,
            ["client_secret"] = _options.ClientSecret!
        }));

        if (!tokenResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Hackatime token exchange failed: {Status}", tokenResponse.StatusCode);
            throw new InvalidOperationException("Hackatime token exchange failed");
        }

        var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
        if (!tokenJson.TryGetProperty("access_token", out var accessTokenEl) || accessTokenEl.ValueKind != JsonValueKind.String)
        {
            throw new InvalidOperationException("Invalid token response from Hackatime");
        }
        var accessToken = accessTokenEl.GetString()!;

        string? hackatimeUserId = null;
        var bannedAtConnect = false;
        string? trustLevel = null;
        try
        {
            using var meRequest = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl}/api/v1/authenticated/me");
            meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var meResponse = await _http.SendAsync(meRequest);
            if (meResponse.IsSuccessStatusCode)
            {
                var meJson = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
                var data = meJson.TryGetProperty("data", out var d) ? d : meJson;
                if (data.TryGetProperty("id", out var idEl))
                {
                    hackatimeUserId = idEl.ValueKind == JsonValueKind.Number
                        ? idEl.GetInt64().ToString()
                        : idEl.GetString();
                }

                var trustSource = data.TryGetProperty("trust_factor", out var tf) ? tf
                    : meJson.TryGetProperty("trust_factor", out var tf2) ? tf2
                    : default;
                if (trustSource.ValueKind == JsonValueKind.Object
                    && trustSource.TryGetProperty("trust_level", out var tl)
                    && tl.ValueKind == JsonValueKind.String)
                {
                    trustLevel = tl.GetString();
                }
                bannedAtConnect = trustLevel == "red";
            }
            else
            {
                _logger.LogWarning("Hackatime /me failed ({Status}) for user {UserId}", meResponse.StatusCode, userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hackatime /me error for user {UserId}", userId);
        }

        var user = await _db.Users.FindAsync(userId) ?? throw new InvalidOperationException("User not found");

        if (bannedAtConnect)
        {
            _logger.LogWarning("Hackatime-banned user attempted connection: {UserId} (hackatimeUserId={HackatimeUserId})", userId, hackatimeUserId);
            Ban(user, ConnectBanMarker, $"linked Hackatime account trust_level=red at connect time (hackatimeUserId={hackatimeUserId})");
            await _db.SaveChangesAsync();
            throw new HackatimeBannedException("Your Hackatime account is banned.");
        }

        user.HackatimeToken = accessToken;
        if (!string.IsNullOrEmpty(hackatimeUserId)) user.HackatimeID = hackatimeUserId;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Hackatime connected for user {UserId}", userId);
    }

    // Only project name strings are returned — no other Hackatime data is exposed.
    public async Task<string[]> GetProjectNamesAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (string.IsNullOrEmpty(user?.HackatimeToken)) return [];

        var projects = await FetchProjectsAsync(user.HackatimeToken, userId);
        if (projects.ValueKind != JsonValueKind.Array) return [];

        return [.. projects.EnumerateArray()
            .Select(p => p.ValueKind == JsonValueKind.String
                ? p.GetString()
                : (p.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null))
            .Where(n => !string.IsNullOrEmpty(n))
            .Select(n => n!)];
    }

    // All-time hours (in seconds from Hackatime, converted to hours) for the given
    // linked project names, plus a per-project breakdown. Single API call.
    public async Task<(double Hours, Dictionary<string, double> PerProject)> GetHoursForProjectsAsync(Guid userId, string[] projectNames)
    {
        if (projectNames.Length == 0) return (0, []);

        var user = await _db.Users.FindAsync(userId);
        if (string.IsNullOrEmpty(user?.HackatimeToken)) return (0, []);

        var projects = await FetchProjectsAsync(user.HackatimeToken, userId);
        if (projects.ValueKind != JsonValueKind.Array) return (0, []);

        var nameSet = new HashSet<string>(projectNames);
        double totalSeconds = 0;
        var perProject = new Dictionary<string, double>();

        foreach (var project in projects.EnumerateArray())
        {
            if (!project.TryGetProperty("name", out var nameEl) || nameEl.ValueKind != JsonValueKind.String) continue;
            var name = nameEl.GetString()!;
            if (!nameSet.Contains(name)) continue;

            var seconds = project.TryGetProperty("total_seconds", out var secEl) && secEl.ValueKind == JsonValueKind.Number
                ? secEl.GetDouble()
                : 0;
            totalSeconds += seconds;
            perProject[name] = Math.Round(seconds / 3600 * 10) / 10;
        }

        return (Math.Round(totalSeconds / 3600 * 10) / 10, perProject);
    }

    // include_archived=true: Hackatime excludes archived projects by default, so a
    // linked project the user later archives would otherwise silently vanish/zero out.
    private async Task<JsonElement> FetchProjectsAsync(string token, Guid userId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl}/api/v1/authenticated/projects?include_archived=true");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        try
        {
            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Hackatime projects fetch failed ({Status}) for user {UserId}", response.StatusCode, userId);
                return default;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            if (json.TryGetProperty("projects", out var projects)) return projects;
            if (json.TryGetProperty("data", out var data)) return data;
            return default;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Hackatime projects fetch error for user {UserId}", userId);
            return default;
        }
    }
}
