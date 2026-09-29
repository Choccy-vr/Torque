using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Torque.Airtable;

public class AirtableClient
{
    private readonly HttpClient _http;
    private readonly AirtableOptions _options;
    private readonly ILogger<AirtableClient> _logger;

    public AirtableClient(HttpClient http, AirtableOptions options, ILogger<AirtableClient> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    // Creates one record and returns its Airtable id, or null on any failure (network,
    // 4xx/5xx, 429) — the caller leaves the shipment unpushed and retries later.
    // typecast lets plain strings land in single-select/number/date columns.
    public async Task<string?> CreateRecordAsync(Dictionary<string, object?> fields)
    {
        try
        {
            var url = $"https://api.airtable.com/v0/{_options.BaseId}/{Uri.EscapeDataString(_options.TableName)}";
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(new { records = new[] { new { fields } }, typecast = true })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Airtable create failed ({Status}): {Body}", response.StatusCode, body);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            if (json.TryGetProperty("records", out var records)
                && records.ValueKind == JsonValueKind.Array
                && records.GetArrayLength() > 0
                && records[0].TryGetProperty("id", out var id))
            {
                return id.GetString();
            }

            _logger.LogWarning("Airtable create returned no record id");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Airtable create error");
            return null;
        }
    }
}
