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

public record SlackProfile(string? DisplayName, string? ImageUrl);

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

    // The user's Slack display name (falling back to their real name) and profile picture
    // URL, either null if Slack doesn't have one. Null on any failure. Needs users:read.
    public async Task<SlackProfile?> GetProfileAsync(string slackId)
    {
        // users.info is a read method, which Slack only takes form-encoded, not as JSON.
        var info = await CallAsync("users.info", new FormUrlEncodedContent([new("user", slackId)]));
        if (info is not { Ok: true } || !info.Json.TryGetProperty("user", out var user)
            || !user.TryGetProperty("profile", out var profile))
        {
            return null;
        }

        string? Prop(string name) =>
            profile.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String && el.GetString() is { Length: > 0 } v
                ? v
                : null;

        return new SlackProfile(
            Prop("display_name") ?? Prop("real_name"),
            Prop("image_512") ?? Prop("image_192") ?? Prop("image_72"));
    }

    private record SlackResponse(bool Ok, string? Error, JsonElement Json);

    private Task<SlackResponse?> CallAsync(string method, object body) => CallAsync(method, JsonContent.Create(body));

    // Slack answers 200 with { ok: false, error } for API errors, so both that and HTTP
    // failures are logged here. Null only when there's no response to read at all.
    private async Task<SlackResponse?> CallAsync(string method, HttpContent content)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://slack.com/api/{method}")
            {
                Content = content
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
