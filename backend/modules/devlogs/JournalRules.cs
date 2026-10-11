using System.Text.RegularExpressions;

namespace Torque.Devlogs;

// What a journal entry needs before it's posted. The text is markdown with its photos
// embedded inline (![alt](url)); the photo links are also kept in ImageUrls so reviewers
// and thumbnails don't have to parse the markdown.
public static partial class JournalRules
{
    public const int MinWritingLength = 150;

    // ![alt](url) or ![alt](<url> "title")
    [GeneratedRegex(@"!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+""[^""]*"")?\s*\)")]
    private static partial Regex MarkdownImage();

    // Photo links embedded in the text, plus any sent separately, in order, without repeats.
    public static string[] ImageUrls(string text, string[]? extra) =>
        [.. MarkdownImage().Matches(text).Select(m => m.Groups[1].Value)
            .Concat(extra ?? [])
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct()];

    // Null when the entry is fine, otherwise the reason it isn't.
    public static string? Check(string text, string[] imageUrls)
    {
        var writing = MarkdownImage().Replace(text, "").Trim();
        if (writing.Length < MinWritingLength)
        {
            return $"Write at least {MinWritingLength} characters about what you did (photos don't count).";
        }
        if (imageUrls.Length == 0)
        {
            return "Add at least one photo of your work.";
        }
        if (imageUrls.Any(u => !Uri.TryCreate(u, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)))
        {
            return "Photo links must be http(s) URLs.";
        }
        return null;
    }
}
