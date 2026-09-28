namespace Torque.Airtable;

// Server-internal only: no controllers. Shipments that pass first-pass review (project
// flips to Fraud_Pending) are pushed once to Airtable by AirtablePushWorker; Airtable
// automations own the record from there.
public static class AirtableExtension
{
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
            SupabaseServiceRoleKey = config["SUPABASE_SERVICE_ROLE_KEY"]
        };

        if (string.IsNullOrEmpty(options.ApiKey) || string.IsNullOrEmpty(options.BaseId))
        {
            Console.WriteLine("[Airtable] AIRTABLE_API_KEY/AIRTABLE_BASE_ID not set — Airtable push disabled");
            return services;
        }

        if (string.IsNullOrEmpty(options.SupabaseServiceRoleKey))
        {
            Console.WriteLine("[Airtable] SUPABASE_SERVICE_ROLE_KEY not set — rows will be pushed without birthday/address");
        }

        services.AddSingleton(options);
        services.AddHttpClient<AirtableClient>();
        services.AddHttpClient<SupabaseUserClient>();
        services.AddScoped<AirtableSubmissionBuilder>();
        // Singleton + hosted so the dev-only test harness can trigger a pass on demand.
        services.AddSingleton<AirtablePushWorker>();
        services.AddHostedService(sp => sp.GetRequiredService<AirtablePushWorker>());

        return services;
    }
}
