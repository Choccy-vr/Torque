using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Torque.Hackatime;

public static class HackatimeExtension
{
    public static IServiceCollection AddHackatime(this IServiceCollection services, IConfiguration config)
    {
        var options = new HackatimeOptions
        {
            ClientId = config["HACKATIME_CLIENT_ID"],
            ClientSecret = config["HACKATIME_CLIENT_SECRET"],
            RedirectUri = config["HACKATIME_REDIRECT_URI"] ?? "http://localhost:9999/auth/hackatime/callback",
            BaseUrl = (config["HACKATIME_BASE_URL"] ?? "https://hackatime.hackclub.com").TrimEnd('/'),
            // Reuses the Supabase JWT secret to HMAC-sign OAuth `state` — it's already
            // the one signing secret this backend holds, and state-signing doesn't need
            // a secret of its own.
            StateSecret = config["SUPABASE_JWT_SECRET"]
                ?? throw new InvalidOperationException("Missing SUPABASE_JWT_SECRET")
        };

        if (string.IsNullOrEmpty(options.ClientId) || string.IsNullOrEmpty(options.ClientSecret))
        {
            Console.WriteLine("[Hackatime] HACKATIME_CLIENT_ID/SECRET not set — Hackatime OAuth disabled");
        }

        services.AddSingleton(options);
        services.AddHttpClient<HackatimeService>();

        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Mirrors the template's @Throttle values: 10/min for the OAuth
            // start/callback pair, 15/min for the read-only lookups. Partitioned per
            // signed-in user (falling back to IP) rather than globally.
            rateLimiterOptions.AddPolicy("hackatime-auth", httpContext => RateLimitPartition.GetFixedWindowLimiter(
                PartitionKey(httpContext),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

            rateLimiterOptions.AddPolicy("hackatime-read", httpContext => RateLimitPartition.GetFixedWindowLimiter(
                PartitionKey(httpContext),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

        return services;
    }

    private static string PartitionKey(HttpContext context) =>
        context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anon";
}
