using System.Text.Json;
using Torque.Hackatime;
using Torque.Lapse;
using Torque.Projects;
using Torque.Reviews;
using Torque.Shipments;
using Torque.Users;

namespace Torque.Airtable;

// Maps a first-pass-approved shipment to a "YSWS Project Submission" row. Column names
// must match the Airtable table exactly. Link to JOURNAL.md has no source in Torque yet,
// Optional - Override Hours Spent Justification is deliberately left blank, and
// Automation/Loops columns belong to Airtable automations, so none of those are sent.
public class AirtableSubmissionBuilder
{
    private readonly HackatimeService _hackatime;
    private readonly LapseService _lapse;
    private readonly SupabaseUserClient _supabase;

    public AirtableSubmissionBuilder(HackatimeService hackatime, LapseService lapse, SupabaseUserClient supabase)
    {
        _hackatime = hackatime;
        _lapse = lapse;
        _supabase = supabase;
    }

    // Returns null when the submitter's Supabase metadata couldn't be fetched (transient),
    // so the push is retried instead of creating a row missing name/address/birthday.
    public async Task<Dictionary<string, object?>?> BuildAsync(Shipment shipment, Project project, User user, ShipmentReview? review)
    {
        var metadata = _supabase.Configured
            ? await _supabase.GetUserMetadataAsync(user.Id)
            : JsonDocument.Parse("{}").RootElement;
        if (metadata is null) return null;

        var (firstName, lastName) = SplitName(Claim(metadata.Value, "given_name"), Claim(metadata.Value, "family_name"), user.Name);

        var address = ClaimElement(metadata.Value, "address");
        var streetLines = (Str(address, "street_address") ?? "")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var names = project.HackatimeProjectNames?.Where(n => !string.IsNullOrEmpty(n)).ToArray() ?? [];
        var (hours, _) = await _hackatime.GetHoursForProjectsAsync(user.Id, names);
        var timelapses = string.IsNullOrEmpty(user.Email) || names.Length == 0
            ? []
            : await _lapse.FindForProjectAsync(user.Email, names);

        var fields = new Dictionary<string, object?>
        {
            ["Project name"] = project.Title,
            ["Description"] = project.Description,
            ["Code URL"] = project.RepoUrl,
            ["Playable URL"] = project.DemoUrl,
            ["Tier"] = (shipment.OverrideTier > 0 ? shipment.OverrideTier : shipment.TierSnapshot).ToString(),
            ["Review Status"] = "Fraud Pending",
            ["Design or build"] = shipment.IsBuildComplete ? "Build" : "Design",
            ["Requested funding"] = shipment.RequestedFunding,
            // Attachment field: Airtable downloads the file from the URL.
            ["Screenshot"] = string.IsNullOrEmpty(review?.ScreenshotUrl) ? null : new[] { new { url = review.ScreenshotUrl } },

            ["First Name"] = firstName,
            ["Last Name"] = lastName,
            ["Email"] = user.Email,
            ["Slack ID"] = user.SlackUserID,
            ["GitHub Username"] = GitHubOwner(project.RepoUrl),
            ["Birthday"] = Claim(metadata.Value, "birthdate"),

            ["Address (Line 1)"] = streetLines.FirstOrDefault(),
            ["Address (Line 2)"] = string.Join(", ", streetLines.Skip(1)),
            ["City"] = Str(address, "locality"),
            ["State / Province"] = Str(address, "region"),
            ["ZIP / Postal Code"] = Str(address, "postal_code"),
            ["Country"] = Str(address, "country") ?? user.Country,

            // 0 means Hackatime was unreachable or nothing is linked — leave it blank.
            ["Hours spent (self reported)"] = hours > 0 ? hours : null,
            ["Optional - Override Hours Spent"] = shipment.OverrideHours > 0 ? shipment.OverrideHours : null,

            ["Justification - Hackatime Project Name(s) + Date Range(s)"] = names.Length == 0
                ? null
                : $"{string.Join(", ", names)} ({project.CreatedAt:yyyy-MM-dd} to {shipment.CreatedAt:yyyy-MM-dd})",
            ["Justification - Submitter Hackatime ID"] = user.HackatimeID,
            // Lapse playback URLs may be rotating signed links; good enough as a pointer.
            ["Justification - Lapse Links, comma-separated"] = string.Join(", ", timelapses.Select(t => t.PlaybackUrl)),
            ["Justification - Specific Technical Features"] = review?.TechnicalFeatures,
            ["Justification - Deflation Justification"] = review?.DeflationJustification,
            ["Justification - Additional Justification"] = review?.AdditionalJustification,

            // Shipper's answers to the ship-time feedback questions.
            ["How did you hear about this?"] = shipment.HowDidYouHear,
            ["What are we doing well?"] = shipment.WhatAreWeDoingWell,
            ["How can we improve?"] = shipment.HowCanWeImprove,
        };

        // Template convention: never send empty values (Airtable rejects some, and blank
        // strings would overwrite defaults set by automations).
        return fields
            .Where(f => f.Value is not null && !(f.Value is string s && string.IsNullOrWhiteSpace(s)))
            .ToDictionary(f => f.Key, f => f.Value);
    }

    // Supabase stores standard OIDC claims at the top of user_metadata and anything
    // non-standard under custom_claims (see EnsureUserExistsFilter's slack_id), so check both.
    private static JsonElement ClaimElement(JsonElement metadata, string name)
    {
        if (metadata.ValueKind != JsonValueKind.Object) return default;
        if (metadata.TryGetProperty(name, out var top) && top.ValueKind != JsonValueKind.Null) return top;
        if (metadata.TryGetProperty("custom_claims", out var custom)
            && custom.ValueKind == JsonValueKind.Object
            && custom.TryGetProperty(name, out var nested)
            && nested.ValueKind != JsonValueKind.Null)
        {
            return nested;
        }
        return default;
    }

    private static string? Claim(JsonElement metadata, string name)
    {
        var el = ClaimElement(metadata, name);
        return el.ValueKind == JsonValueKind.String ? el.GetString() : null;
    }

    private static string? Str(JsonElement obj, string property) =>
        obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    // Prefer HCA's given/family names; otherwise split the full name on the first space.
    private static (string? First, string? Last) SplitName(string? given, string? family, string fullName)
    {
        if (!string.IsNullOrWhiteSpace(given)) return (given, family);

        var parts = fullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => (null, null),
            1 => (parts[0], null),
            _ => (parts[0], parts[1])
        };
    }

    // https://github.com/{owner}/{repo} -> owner
    private static string? GitHubOwner(string? repoUrl)
    {
        if (!Uri.TryCreate(repoUrl, UriKind.Absolute, out var uri)) return null;
        if (!uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase)
            && !uri.Host.Equals("www.github.com", StringComparison.OrdinalIgnoreCase)) return null;

        var owner = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return string.IsNullOrEmpty(owner) ? null : owner;
    }
}
