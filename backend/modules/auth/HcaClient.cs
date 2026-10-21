using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Torque.Users;

namespace Torque.Auth;

// What HCA's userinfo endpoint said about a user. Claims is null when it couldn't be
// read; Revoked is set when that's because HCA rejected the user's tokens (they
// deauthorized Torque), as opposed to HCA being unreachable.
public record HcaUserInfo(JsonElement? Claims, bool Revoked = false);

// Talks to Hack Club Auth on a user's behalf with the tokens stored at login. HCA
// access tokens last ~6 months and refresh tokens rotate on every use, so a refresh
// rewrites both onto the User; callers save the change.
public class HcaClient
{
    private readonly HttpClient _http;
    private readonly HcaOptions _options;
    private readonly ILogger<HcaClient> _logger;

    public HcaClient(HttpClient http, HcaOptions options, ILogger<HcaClient> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    public async Task<HcaUserInfo> GetUserInfoAsync(User user, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(user.HcaAccessToken)) return new(null, Revoked: true);

        if (user.HcaTokenExpiresAt is { } expiresAt && expiresAt < DateTime.UtcNow.AddMinutes(5))
        {
            var refreshed = await RefreshAsync(user, ct);
            if (refreshed is not true) return new(null, Revoked: refreshed is false);
        }

        var (status, claims) = await FetchUserInfoAsync(user.HcaAccessToken!, ct);
        if (status == HttpStatusCode.Unauthorized)
        {
            var refreshed = await RefreshAsync(user, ct);
            if (refreshed is not true) return new(null, Revoked: refreshed is false);
            (_, claims) = await FetchUserInfoAsync(user.HcaAccessToken!, ct);
        }

        return new(claims);
    }

    // The userinfo claims for a raw access token (used at login, before anything is
    // stored), or null when they couldn't be fetched.
    public async Task<JsonElement?> GetUserInfoAsync(string accessToken, CancellationToken ct = default) =>
        (await FetchUserInfoAsync(accessToken, ct)).Claims;

    public static void StoreTokens(User user, string? accessToken, string? refreshToken, string? expiresIn)
    {
        if (string.IsNullOrEmpty(accessToken)) return;

        user.HcaAccessToken = accessToken;
        // Keep the old refresh token if HCA didn't send a new one.
        if (!string.IsNullOrEmpty(refreshToken)) user.HcaRefreshToken = refreshToken;
        user.HcaTokenExpiresAt = int.TryParse(expiresIn, out var seconds)
            ? DateTime.UtcNow.AddSeconds(seconds)
            : null;
    }

    private async Task<(HttpStatusCode? Status, JsonElement? Claims)> FetchUserInfoAsync(string accessToken, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, _options.UserInfoEndpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("HCA userinfo fetch failed ({Status})", response.StatusCode);
                return (response.StatusCode, null);
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            return (response.StatusCode, json.ValueKind == JsonValueKind.Object ? json : null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "HCA userinfo fetch error");
            return (null, null);
        }
    }

    // true = new tokens stored on `user`; false = HCA refused the refresh token (the
    // user has to sign in again); null = HCA couldn't be reached.
    private async Task<bool?> RefreshAsync(User user, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(user.HcaRefreshToken)) return false;

        try
        {
            using var response = await _http.PostAsync(_options.TokenEndpoint, new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = user.HcaRefreshToken,
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
            }), ct);

            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized)
            {
                _logger.LogInformation("HCA refused the refresh token for user {UserId}", user.Id);
                return false;
            }
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("HCA token refresh failed ({Status}) for user {UserId}", response.StatusCode, user.Id);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            StoreTokens(user,
                json.TryGetProperty("access_token", out var access) ? access.GetString() : null,
                json.TryGetProperty("refresh_token", out var refresh) ? refresh.GetString() : null,
                json.TryGetProperty("expires_in", out var expires) ? expires.GetRawText() : null);
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "HCA token refresh error for user {UserId}", user.Id);
            return null;
        }
    }
}
