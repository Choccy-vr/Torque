using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.EntityFrameworkCore;
using Torque.Airtable;
using Torque.Auth;
using Torque.Data;
using Torque.Hackatime;
using Torque.Lapse;
using Torque.Projects;
using Torque.Settings;
using Torque.Shipments;
using Torque.Slack;
using Torque.Uploads;

namespace Torque.Status;

// Checks every integration live for the admin "System status" dialog: whether it's
// configured, and if so whether a cheap, read-only call to it works. Nothing here writes
// anywhere or sends a message, and no secret ends up in a result.
public class ModuleStatusService
{
    // Each live check gets this long before it counts as down.
    private static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(6);

    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly SettingsService _settings;
    private readonly IServiceProvider _services;
    private readonly HcaOptions _hca;
    private readonly HackatimeOptions _hackatime;
    private readonly LapseOptions _lapse;
    private readonly AirtableOptions _airtable;
    private readonly SlackOptions _slack;
    private readonly UploadOptions _uploads;

    public ModuleStatusService(
        HttpClient http, AppDbContext db, SettingsService settings, IServiceProvider services,
        HcaOptions hca, HackatimeOptions hackatime, LapseOptions lapse, AirtableOptions airtable,
        SlackOptions slack, UploadOptions uploads)
    {
        _http = http;
        _db = db;
        _settings = settings;
        _services = services;
        _hca = hca;
        _hackatime = hackatime;
        _lapse = lapse;
        _airtable = airtable;
        _slack = slack;
        _uploads = uploads;
    }

    public async Task<ModuleStatusReportDto> CheckAllAsync(CancellationToken ct)
    {
        // The DbContext can't run queries in parallel, so the database-backed checks go
        // first, one at a time; the outside calls then all run at once.
        var database = await CheckDatabaseAsync(ct);
        var airtableFacts = await AirtableFactsAsync(database.Status == ModuleHealth.healthy, ct);

        var checks = await Task.WhenAll(
            CheckHcaAsync(ct),
            CheckHackatimeAsync(ct),
            CheckAirtableAsync(airtableFacts, ct),
            CheckSlackAsync(ct),
            CheckLapseAsync(ct),
            CheckUploadsAsync(ct));

        return new ModuleStatusReportDto(DateTime.UtcNow, [database, .. checks]);
    }

    // ------------------------------------------------------------------ database

    private async Task<ModuleStatusDto> CheckDatabaseAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "database",
            Name = "Database",
            Description = "Postgres: every user, project, ship and order.",
            Required = true
        };

        var (ok, ms, error) = await TimeAsync(async token => await _db.Database.CanConnectAsync(token), ct);
        if (!ok) return module with { Status = ModuleHealth.down, Detail = error ?? "Can't connect.", LatencyMs = ms };

        var pending = (await _db.Database.GetPendingMigrationsAsync(ct)).Count();
        return pending > 0
            ? module with
            {
                Status = ModuleHealth.degraded,
                Detail = pending == 1
                    ? "Connected, but 1 migration hasn't been applied."
                    : $"Connected, but {pending} migrations haven't been applied.",
                LatencyMs = ms
            }
            : module with { Status = ModuleHealth.healthy, Detail = "Connected, schema up to date.", LatencyMs = ms };
    }

    // ------------------------------------------------------------------ Hack Club Auth

    private async Task<ModuleStatusDto> CheckHcaAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "hca",
            Name = "Hack Club Auth",
            Description = "Sign-in, plus the address and verification status the shop and Airtable use.",
            Required = true,
            Facts = [new("Server", HostOf(_hca.Authority))]
        };

        // The OIDC discovery document is what sign-in loads first, so if this works,
        // sign-in can start.
        var (status, ms, error) = await GetAsync($"{_hca.Authority}/.well-known/openid-configuration", null, ct);
        return status == HttpStatusCode.OK
            ? module with { Status = ModuleHealth.healthy, Detail = "Reachable; sign-in can start.", LatencyMs = ms }
            : module with { Status = ModuleHealth.down, Detail = error ?? $"Discovery document answered {Describe(status)}.", LatencyMs = ms };
    }

    // ------------------------------------------------------------------ Hackatime

    private async Task<ModuleStatusDto> CheckHackatimeAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "hackatime",
            Name = "Hackatime",
            Description = "Links builders' Hackatime accounts and counts their coding hours.",
            Facts = [new("Server", HostOf(_hackatime.BaseUrl))]
        };

        if (string.IsNullOrEmpty(_hackatime.ClientId) || string.IsNullOrEmpty(_hackatime.ClientSecret))
        {
            return module with
            {
                Status = ModuleHealth.disabled,
                Detail = "Not configured: linking Hackatime and counting hours are off.",
                Missing = ["HACKATIME_CLIENT_ID", "HACKATIME_CLIENT_SECRET"]
            };
        }

        // The OAuth credentials can only be tried with a real sign-in, so this checks
        // that Hackatime itself is up.
        var (status, ms, error) = await GetAsync(_hackatime.BaseUrl, null, ct);
        return status is { } s && (int)s < 500
            ? module with { Status = ModuleHealth.healthy, Detail = "Reachable.", LatencyMs = ms }
            : module with { Status = ModuleHealth.down, Detail = error ?? $"Answered {Describe(status)}.", LatencyMs = ms };
    }

    // ------------------------------------------------------------------ Airtable

    private async Task<List<ModuleFactDto>> AirtableFactsAsync(bool dbUp, CancellationToken ct)
    {
        if (!dbUp) return [];

        // Same filter as AirtablePushWorker: approved ships it hasn't pushed yet.
        var waiting = await _db.Shipments
            .Where(s => s.Status == ShipmentStatus.approved && s.AirtableRecordId == null)
            .Where(s => _db.Projects.Any(p => p.Id == s.ProjectId && p.Status == ProjectStatus.Fraud_Pending))
            .CountAsync(ct);
        var lastPush = await _db.Shipments.MaxAsync(s => s.AirtablePushedAt, ct);
        var paused = await _settings.IsPausedAsync(SettingKeys.PayoutsPaused, ct);

        List<ModuleFactDto> facts =
        [
            new("Waiting to push", waiting.ToString("N0")),
            new("Last push", lastPush is { } at ? at.ToString("O") : "Never")
        ];
        if (paused) facts.Add(new("Push", "Held by the payouts switch"));
        return facts;
    }

    private async Task<ModuleStatusDto> CheckAirtableAsync(List<ModuleFactDto> facts, CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "airtable",
            Name = "Airtable",
            Description = "Approved ships are pushed to the YSWS submissions table; its approval automation pays them out.",
            Facts = [new("Table", _airtable.TableName), .. facts]
        };
        var webhookOn = !string.IsNullOrEmpty(_airtable.WebhookSecret);

        if (string.IsNullOrEmpty(_airtable.ApiKey) || string.IsNullOrEmpty(_airtable.BaseId))
        {
            return module with
            {
                Status = ModuleHealth.disabled,
                Detail = "Not configured: approved ships aren't pushed to Airtable.",
                Missing = webhookOn
                    ? ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID"]
                    : ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_WEBHOOK_SECRET"],
                Facts = []
            };
        }

        // whoami works with any valid token whatever its scopes, so it checks the token
        // without reading or writing a record.
        var (status, ms, error) = await GetAsync("https://api.airtable.com/v0/meta/whoami", _airtable.ApiKey, ct);
        if (status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return module with { Status = ModuleHealth.down, Detail = "Airtable rejected the API key.", LatencyMs = ms };
        }
        if (status != HttpStatusCode.OK)
        {
            return module with { Status = ModuleHealth.down, Detail = error ?? $"Answered {Describe(status)}.", LatencyMs = ms };
        }

        return webhookOn
            ? module with { Status = ModuleHealth.healthy, Detail = "API key works; approval webhook is on.", LatencyMs = ms }
            : module with
            {
                Status = ModuleHealth.degraded,
                Detail = "API key works, but the approval webhook is off, so approvals in Airtable won't pay out.",
                LatencyMs = ms,
                Missing = ["AIRTABLE_WEBHOOK_SECRET"]
            };
    }

    // ------------------------------------------------------------------ Slack

    private async Task<ModuleStatusDto> CheckSlackAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "slack",
            Name = "Slack",
            Description = "DMs builders about ships, reviews, streaks and orders, and adds them to the program's channels.",
            Facts = [new("Join channels", _slack.JoinChannelIds.Length.ToString())]
        };

        if (!_slack.Configured)
        {
            return module with
            {
                Status = ModuleHealth.disabled,
                Detail = "Not configured: no DMs are sent and channel join is off.",
                Missing = ["SLACK_BOT_TOKEN"],
                Facts = []
            };
        }

        var sw = Stopwatch.StartNew();
        try
        {
            using var timeout = Timeout(ct);
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://slack.com/api/auth.test");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _slack.BotToken);
            using var response = await _http.SendAsync(request, timeout.Token);
            var ms = sw.ElapsedMilliseconds;
            if (!response.IsSuccessStatusCode)
            {
                return module with { Status = ModuleHealth.down, Detail = $"Answered {Describe(response.StatusCode)}.", LatencyMs = ms };
            }

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(timeout.Token);
            if (!(json.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.True))
            {
                var code = json.TryGetProperty("error", out var e) ? e.GetString() : null;
                return module with { Status = ModuleHealth.down, Detail = $"Slack rejected the bot token ({code ?? "unknown error"}).", LatencyMs = ms };
            }

            List<ModuleFactDto> facts = [];
            if (json.TryGetProperty("team", out var team) && team.GetString() is { Length: > 0 } teamName) facts.Add(new("Workspace", teamName));
            if (json.TryGetProperty("user", out var bot) && bot.GetString() is { Length: > 0 } botName) facts.Add(new("Bot", $"@{botName}"));
            facts.AddRange(module.Facts);

            return _slack.JoinChannelIds.Length == 0
                ? module with
                {
                    Status = ModuleHealth.degraded,
                    Detail = "Bot token works and DMs go out, but channel join is off.",
                    LatencyMs = ms,
                    Missing = ["SLACK_JOIN_CHANNELS"],
                    Facts = facts
                }
                : module with { Status = ModuleHealth.healthy, Detail = "Bot token works.", LatencyMs = ms, Facts = facts };
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return module with { Status = ModuleHealth.down, Detail = Unreachable(ex), LatencyMs = sw.ElapsedMilliseconds };
        }
    }

    // ------------------------------------------------------------------ Lapse

    private async Task<ModuleStatusDto> CheckLapseAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "lapse",
            Name = "Lapse",
            Description = "Shows reviewers the timelapses builders recorded for a project.",
            Facts = [new("Server", HostOf(_lapse.BaseUrl))]
        };

        if (string.IsNullOrEmpty(_lapse.ProgramKey))
        {
            return module with
            {
                Status = ModuleHealth.disabled,
                Detail = "Not configured: reviewers don't see timelapses.",
                Missing = ["LAPSE_PROGRAM_KEY"],
                Facts = []
            };
        }

        // Looking up an address that can't exist answers 200 with no user when the key
        // works, and 401/403 when it doesn't, so it checks the key without touching anyone.
        var url = $"{_lapse.BaseUrl}/api/user/queryByEmail?email={Uri.EscapeDataString("status-check@torque.invalid")}";
        var (status, ms, error) = await GetAsync(url, _lapse.ProgramKey, ct);
        return status switch
        {
            HttpStatusCode.OK => module with { Status = ModuleHealth.healthy, Detail = "Program key works.", LatencyMs = ms },
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                module with { Status = ModuleHealth.down, Detail = "Lapse rejected the program key.", LatencyMs = ms },
            HttpStatusCode.NotFound =>
                module with { Status = ModuleHealth.down, Detail = "The API route wasn't found. Check LAPSE_BASE_URL.", LatencyMs = ms },
            _ => module with { Status = ModuleHealth.down, Detail = error ?? $"Answered {Describe(status)}.", LatencyMs = ms }
        };
    }

    // ------------------------------------------------------------------ uploads

    private async Task<ModuleStatusDto> CheckUploadsAsync(CancellationToken ct)
    {
        var module = new ModuleStatusDto
        {
            Key = "uploads",
            Name = "Image uploads",
            Description = "Stores the photos on projects, journals and shop items in the S3/R2 bucket.",
            Facts = _uploads.Configured
                ? [new("Bucket", _uploads.BucketName!), new("Public URL", HostOf(_uploads.PublicUrl!))]
                : []
        };

        var s3 = _services.GetService<IAmazonS3>();
        if (!_uploads.Configured || s3 is null)
        {
            return module with
            {
                Status = ModuleHealth.disabled,
                Detail = "Not configured: nobody can add photos.",
                Missing = ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET_NAME", "S3_PUBLIC_URL"]
            };
        }

        var sw = Stopwatch.StartNew();
        try
        {
            using var timeout = Timeout(ct);
            await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = _uploads.BucketName, MaxKeys = 1 }, timeout.Token);
            return module with { Status = ModuleHealth.healthy, Detail = "Bucket reachable with these keys.", LatencyMs = sw.ElapsedMilliseconds };
        }
        catch (AmazonS3Exception ex) when (!ct.IsCancellationRequested)
        {
            var detail = ex.StatusCode switch
            {
                HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized => "The bucket rejected the access keys.",
                HttpStatusCode.NotFound => "The bucket wasn't found. Check S3_BUCKET_NAME.",
                _ => $"The bucket answered {ex.ErrorCode ?? Describe(ex.StatusCode)}."
            };
            return module with { Status = ModuleHealth.down, Detail = detail, LatencyMs = sw.ElapsedMilliseconds };
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return module with { Status = ModuleHealth.down, Detail = Unreachable(ex), LatencyMs = sw.ElapsedMilliseconds };
        }
    }

    // ------------------------------------------------------------------ helpers

    private static CancellationTokenSource Timeout(CancellationToken ct)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(CheckTimeout);
        return cts;
    }

    // A GET with an optional bearer token: the status code (null when there was no
    // answer at all), how long it took, and why it failed when there was no answer.
    private async Task<(HttpStatusCode? Status, long Ms, string? Error)> GetAsync(string url, string? bearer, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var timeout = Timeout(ct);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (bearer is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            return (response.StatusCode, sw.ElapsedMilliseconds, null);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return (null, sw.ElapsedMilliseconds, Unreachable(ex));
        }
    }

    private static async Task<(bool Ok, long Ms, string? Error)> TimeAsync(Func<CancellationToken, Task<bool>> check, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            using var timeout = Timeout(ct);
            var ok = await check(timeout.Token);
            return (ok, sw.ElapsedMilliseconds, ok ? null : "Can't connect.");
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return (false, sw.ElapsedMilliseconds, Unreachable(ex));
        }
    }

    private static string Unreachable(Exception ex) => ex switch
    {
        OperationCanceledException => $"No answer within {CheckTimeout.TotalSeconds:0} seconds.",
        HttpRequestException { HttpRequestError: HttpRequestError.NameResolutionError } => "Couldn't resolve the host name.",
        HttpRequestException { HttpRequestError: HttpRequestError.ConnectionError } => "Couldn't connect.",
        HttpRequestException { HttpRequestError: HttpRequestError.SecureConnectionError } => "TLS handshake failed.",
        _ => "Couldn't reach it."
    };

    private static string Describe(HttpStatusCode? status) =>
        status is { } s ? $"HTTP {(int)s}" : "nothing";

    private static string HostOf(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.Host : url;

}
