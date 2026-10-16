using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Torque.Slack;

// Send-only Slack bot: DMs builders when they sign up, ship, get final approval or get a
// review back (see SlackMessages), and lets a user add themselves to the program's
// channels. Nothing here takes message text from a request — every message is a template.
public static class SlackExtension
{
    public const string JoinRateLimit = "slack-join";

    public static IServiceCollection AddSlack(this IServiceCollection services, IConfiguration config)
    {
        var options = new SlackOptions
        {
            BotToken = config["SLACK_BOT_TOKEN"],
            JoinChannelIds = (config["SLACK_JOIN_CHANNELS"] ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            FrontendUrl = config["FRONTEND_URL"]?.TrimEnd('/') ?? ""
        };

        // Always registered so controllers can inject SlackNotifier; it no-ops when Slack
        // isn't configured.
        services.AddSingleton(options);
        services.AddHttpClient<SlackClient>(http => http.Timeout = TimeSpan.FromSeconds(10));
        services.AddSingleton<SlackNotifier>();

        if (!options.Configured)
        {
            Console.WriteLine("[Slack] SLACK_BOT_TOKEN not set — Slack DMs and channel join disabled");
        }
        else if (options.JoinChannelIds.Length == 0)
        {
            Console.WriteLine("[Slack] SLACK_JOIN_CHANNELS not set — channel join disabled");
        }

        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            rateLimiterOptions.AddPolicy(JoinRateLimit, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.User.FindFirst("sub")?.Value ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

        return services;
    }
}
