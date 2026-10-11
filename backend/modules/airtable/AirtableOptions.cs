namespace Torque.Airtable;

public class AirtableOptions
{
    public string? ApiKey { get; set; }
    public string? BaseId { get; set; }
    public string TableName { get; set; } = "YSWS Project Submission";

    // Service-role access to Supabase's admin API, used to read the *submitter's*
    // user_metadata (name/birthday/address claims) — at push time the only JWT around
    // is the reviewer's. Without it rows are pushed with no address/birthday.
    public string? SupabaseUrl { get; set; }
    public string? SupabaseServiceRoleKey { get; set; }

    // Shared secret the Airtable approval automation sends in X-Webhook-Secret (see
    // AirtableWebhookController). Unset disables the webhook.
    public string? WebhookSecret { get; set; }

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(60);
}
