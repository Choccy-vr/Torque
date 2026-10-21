namespace Torque.Airtable;

public class AirtableOptions
{
    public string? ApiKey { get; set; }
    public string? BaseId { get; set; }
    public string TableName { get; set; } = "YSWS Project Submission";

    // Shared secret the Airtable approval automation sends in X-Webhook-Secret (see
    // AirtableWebhookController). Unset disables the webhook.
    public string? WebhookSecret { get; set; }

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(60);
}
