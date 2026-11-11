using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Torque.Data;

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
    private readonly IServiceScopeFactory _scopes;

    public SlackClient(HttpClient http, SlackOptions options, ILogger<SlackClient> logger, IServiceScopeFactory scopes)
    {
        _http = http;
        _options = options;
        _logger = logger;
        _scopes = scopes;
    }

    // Opens (or reuses) the bot's DM with the user and posts the message. False on any
    // failure. Every attempt is recorded in slack_logs.
    public async Task<bool> SendDmAsync(string slackId, SlackMessage message)
    {
        var open = await CallAsync("conversations.open", new { users = slackId });
        if (open is not { Ok: true } opened
            || !opened.Json.TryGetProperty("channel", out var channel)
            || !channel.TryGetProperty("id", out var channelId))
        {
            await LogAsync(slackId, SlackAction.dm, message.Text, false, ErrorOf(open) ?? "no_channel");
            return false;
        }

        var post = await CallAsync("chat.postMessage", new
        {
            channel = channelId.GetString(),
            text = message.Text,
            blocks = message.Blocks
        });
        var sent = post is { Ok: true };
        await LogAsync(slackId, SlackAction.dm, message.Text, sent, ErrorOf(post));
        return sent;
    }

    // Every attempt is recorded in slack_logs.
    public async Task<SlackInviteResult> InviteAsync(string channelId, string slackId)
    {
        var result = await CallAsync("conversations.invite", new { channel = channelId, users = slackId });
        var status = result switch
        {
            { Ok: true } => SlackInviteResult.Joined,
            { Error: "already_in_channel" } => SlackInviteResult.AlreadyMember,
            _ => SlackInviteResult.Failed
        };
        await LogAsync(slackId, SlackAction.channel_invite, channelId, status != SlackInviteResult.Failed, ErrorOf(result));
        return status;
    }

    private static string? ErrorOf(SlackResponse? response) => response is null ? "no_response" : response.Error;

    // Written in its own scope so it never flushes the caller's pending changes, and never
    // throws: a logging failure mustn't turn a sent DM into a failed one.
    private async Task LogAsync(string slackId, SlackAction action, string detail, bool success, string? error)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userId = await db.Users
                .Where(u => u.SlackUserID == slackId)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();
            db.SlackLogs.Add(new SlackLog
            {
                SlackUserId = slackId,
                UserId = userId,
                Action = action,
                Detail = detail,
                Success = success,
                Error = error
            });
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Couldn't record Slack {Action} to {SlackId}", action, slackId);
        }
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
