using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Torque.Slack;

public enum SlackInviteResult
{
    Joined,
    AlreadyMember,
    Failed
}

public class SlackClient
{
    private readonly HttpClient _http;
    private readonly SlackOptions _options;
    private readonly ILogger<SlackClient> _logger;

    public SlackClient(HttpClient http, SlackOptions options, ILogger<SlackClient> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    // Opens (or reuses) the bot's DM with the user and posts the message. False on any
    // failure.
    public async Task<bool> SendDmAsync(string slackId, SlackMessage message)
    {
        var open = await CallAsync("conversations.open", new { users = slackId });
        if (open is not { Ok: true } opened
            || !opened.Json.TryGetProperty("channel", out var channel)
            || !channel.TryGetProperty("id", out var channelId))
        {
            return false;
        }

        var post = await CallAsync("chat.postMessage", new
        {
            channel = channelId.GetString(),
            text = message.Text,
            blocks = message.Blocks
        });
        return post is { Ok: true };
    }

    public async Task<SlackInviteResult> InviteAsync(string channelId, string slackId)
    {
        var result = await CallAsync("conversations.invite", new { channel = channelId, users = slackId });
        return result switch
        {
            { Ok: true } => SlackInviteResult.Joined,
            { Error: "already_in_channel" } => SlackInviteResult.AlreadyMember,
            _ => SlackInviteResult.Failed
        };
    }

    private record SlackResponse(bool Ok, string? Error, JsonElement Json);

    // Slack answers 200 with { ok: false, error } for API errors, so both that and HTTP
    // failures are logged here. Null only when there's no response to read at all.
    private async Task<SlackResponse?> CallAsync(string method, object body)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://slack.com/api/{method}")
            {
                Content = JsonContent.Create(body)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.BotToken);

            var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Slack {Method} failed ({Status})", method, response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            var ok = json.TryGetProperty("ok", out var okProp) && okProp.ValueKind == JsonValueKind.True;
            var error = json.TryGetProperty("error", out var errorProp) ? errorProp.GetString() : null;
            if (!ok && error != "already_in_channel")
            {
                _logger.LogWarning("Slack {Method} returned error: {Error}", method, error);
            }
            return new SlackResponse(ok, error, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Slack {Method} error", method);
            return null;
        }
    }
}
