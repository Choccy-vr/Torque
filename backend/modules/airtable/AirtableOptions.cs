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

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(60);
}
