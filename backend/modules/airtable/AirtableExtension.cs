using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Torque.Airtable;

// Shipments that pass first-pass review (project flips to Fraud_Pending) are pushed once
// to Airtable by AirtablePushWorker. Airtable owns the record from there, and its
// approval automation calls back into AirtableWebhookController to pay the ship out.
public static class AirtableExtension
{
    public const string WebhookRateLimit = "airtable-webhook";

    // Short secrets are guessable, so they leave the webhook off rather than half-locked.
    private const int MinWebhookSecretLength = 32;

    public static IServiceCollection AddAirtable(this IServiceCollection services, IConfiguration config)
    {
        var options = new AirtableOptions
        {
            ApiKey = config["AIRTABLE_API_KEY"],
            BaseId = config["AIRTABLE_BASE_ID"],
            TableName = string.IsNullOrWhiteSpace(config["AIRTABLE_TABLE_NAME"])
                ? "YSWS Project Submission"
                : config["AIRTABLE_TABLE_NAME"]!,
            SupabaseUrl = config["SUPABASE_URL"]?.TrimEnd('/'),
            SupabaseServiceRoleKey = config["SUPABASE_SERVICE_ROLE_KEY"],
            WebhookSecret = config["AIRTABLE_WEBHOOK_SECRET"]
        };

        // Always registered: the webhook controller reads WebhookSecret from it even when
        // the push is disabled.
        services.AddSingleton(options);

        if (string.IsNullOrEmpty(options.WebhookSecret))
        {
            Console.WriteLine("[Airtable] AIRTABLE_WEBHOOK_SECRET not set — approval webhook disabled");
        }
        else if (options.WebhookSecret.Length < MinWebhookSecretLength)
        {
            Console.WriteLine($"[Airtable] AIRTABLE_WEBHOOK_SECRET is under {MinWebhookSecretLength} characters — approval webhook disabled");
            options.WebhookSecret = null;
        }

        // Slows down anyone guessing the secret. Airtable runs automations one record at a
        // time, so a bulk approval stays well under this.
        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            rateLimiterOptions.AddPolicy(WebhookRateLimit, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });

        if (string.IsNullOrEmpty(options.ApiKey) || string.IsNullOrEmpty(options.BaseId))
        {
            Console.WriteLine("[Airtable] AIRTABLE_API_KEY/AIRTABLE_BASE_ID not set — Airtable push disabled");
            return services;
        }

        if (string.IsNullOrEmpty(options.SupabaseServiceRoleKey))
        {
            Console.WriteLine("[Airtable] SUPABASE_SERVICE_ROLE_KEY not set — rows will be pushed without birthday/address");
        }

        services.AddHttpClient<AirtableClient>();
        services.AddHttpClient<SupabaseUserClient>();
        services.AddScoped<AirtableSubmissionBuilder>();
        // Singleton + hosted so the dev-only test harness can trigger a pass on demand.
        services.AddSingleton<AirtablePushWorker>();
        services.AddHostedService(sp => sp.GetRequiredService<AirtablePushWorker>());

        return services;
    }
}
