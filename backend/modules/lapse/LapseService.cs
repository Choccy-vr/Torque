using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Torque.Lapse;

public class LapseService
{
    private readonly HttpClient _http;
    private readonly LapseOptions _options;
    private readonly IMemoryCache _cache;
    private readonly ILogger<LapseService> _logger;

    // 60s cache of email -> lapse user id, so a review page listing several projects
    // doesn't slam /api/user/queryByEmail once per row. Timelapse lists themselves
    // aren't cached — playbackUrl may be a rotating signed URL.
    private static readonly TimeSpan UserIdCacheTtl = TimeSpan.FromSeconds(60);

    public LapseService(HttpClient http, LapseOptions options, IMemoryCache cache, ILogger<LapseService> logger)
    {
        _http = http;
        _options = options;
        _cache = cache;
        _logger = logger;
    }

    private bool Configured => !string.IsNullOrEmpty(_options.ProgramKey);

    // Returns timelapses belonging to the given email whose linked Hackatime project
    // matches any of `hackatimeProjectNames`. Every failure mode (no key, network, 4xx,
    // malformed) returns [] so a Lapse outage can never block a review.
    public async Task<List<TimelapseDto>> FindForProjectAsync(string email, string[] hackatimeProjectNames)
    {
        if (!Configured || string.IsNullOrWhiteSpace(email) || hackatimeProjectNames.Length == 0) return [];

        var lapseUserId = await QueryByEmailAsync(email);
        if (lapseUserId is null) return [];

        var raw = await FindByUserAsync(lapseUserId);
        if (raw.Count == 0) return [];

        var nameSet = new HashSet<string>(hackatimeProjectNames.Where(n => !string.IsNullOrEmpty(n)));
        var result = new List<TimelapseDto>();

        foreach (var t in raw)
        {
            if (!TryGetString(t, "id", out var id) || !TryGetString(t, "playbackUrl", out var playbackUrl)) continue;

            // Program-key calls return private fields inlined. Be tolerant of either shape.
            string? hackatimeProject = null;
            if (t.TryGetProperty("private", out var priv) && priv.ValueKind == JsonValueKind.Object)
            {
                TryGetString(priv, "hackatimeProject", out hackatimeProject);
            }
            hackatimeProject ??= TryGetString(t, "hackatimeProject", out var top) ? top : null;

            if (string.IsNullOrEmpty(hackatimeProject) || !nameSet.Contains(hackatimeProject)) continue;

            result.Add(new TimelapseDto
            {
                Id = id!,
                Name = TryGetString(t, "name", out var name) ? name! : "",
                PlaybackUrl = playbackUrl!,
                ThumbnailUrl = TryGetString(t, "thumbnailUrl", out var thumb) ? thumb : null,
                Duration = TryGetDouble(t, "duration", out var duration) ? duration : null,
                CreatedAt = TryGetLong(t, "createdAt", out var createdAt) ? createdAt : null,
                HackatimeProject = hackatimeProject,
                Visibility = TryGetString(t, "visibility", out var visibility) ? visibility : null
            });
        }

        result.Sort((a, b) => (b.CreatedAt ?? 0).CompareTo(a.CreatedAt ?? 0));
        return result;
    }

    private async Task<string?> QueryByEmailAsync(string email)
    {
        var cacheKey = $"lapse-user:{email}";
        if (_cache.TryGetValue(cacheKey, out string? cached)) return cached;

        string? id = null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl}/api/user/queryByEmail?email={Uri.EscapeDataString(email)}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ProgramKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var response = await _http.SendAsync(request);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // intentional miss — cache the null below
            }
            else if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Lapse queryByEmail failed: {Status}", response.StatusCode);
                return null; // don't cache transient failures
            }
            else
            {
                var body = await response.Content.ReadFromJsonAsync<JsonElement>();
                var user = body.TryGetProperty("data", out var data) && data.TryGetProperty("user", out var u) ? u
                    : body.TryGetProperty("user", out var u2) ? u2
                    : body.TryGetProperty("data", out var d2) ? d2
                    : default;

                if (user.ValueKind == JsonValueKind.Object && user.TryGetProperty("id", out var idEl))
                {
                    id = idEl.ValueKind == JsonValueKind.Number ? idEl.GetInt64().ToString() : idEl.GetString();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lapse queryByEmail error");
            return null;
        }

        _cache.Set(cacheKey, id, UserIdCacheTtl);
        return id;
    }

    private async Task<List<JsonElement>> FindByUserAsync(string lapseUserId)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl}/api/timelapse/findByUser?user={Uri.EscapeDataString(lapseUserId)}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ProgramKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Lapse findByUser failed: {Status}", response.StatusCode);
                return [];
            }

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var list = body.TryGetProperty("data", out var data) && data.TryGetProperty("timelapses", out var t) ? t
                : body.TryGetProperty("timelapses", out var t2) ? t2
                : body.TryGetProperty("data", out var d2) ? d2
                : default;

            if (list.ValueKind != JsonValueKind.Array) return [];
            return [.. list.EnumerateArray()];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lapse findByUser error");
            return [];
        }
    }

    private static bool TryGetString(JsonElement element, string property, out string? value)
    {
        if (element.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.String)
        {
            value = el.GetString();
            return value is not null;
        }
        value = null;
        return false;
    }

    private static bool TryGetDouble(JsonElement element, string property, out double value)
    {
        if (element.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.Number)
        {
            return el.TryGetDouble(out value);
        }
        value = 0;
        return false;
    }

    private static bool TryGetLong(JsonElement element, string property, out long value)
    {
        if (element.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.Number)
        {
            return el.TryGetInt64(out value);
        }
        value = 0;
        return false;
    }
}
