namespace Torque.Slack;

// Text is the notification / fallback text; Blocks is what Slack renders.
public record SlackMessage(string Text, object[] Blocks);

// Every DM the bot can send. User-written text (titles, feedback, usernames) goes through
// Escape so it can't ping <!channel> or smuggle in links.
public static class SlackMessages
{
    public static SlackMessage Welcome(string username) => Build(
        "Welcome to Torque!",
        "Welcome to Torque! :gear:",
        $"Hey *{Escape(username)}*, you're all set up. Start a project, journal your time, and ship it when it's ready to spin.");

    public static SlackMessage Shipped(string projectTitle, string projectUrl) => Build(
        $"{Escape(projectTitle)} has been shipped!",
        "Project shipped! :rocket:",
        $"*{Escape(projectTitle)}* is in the review queue. We'll DM you as soon as a reviewer has looked at it.",
        projectUrl);

    public static SlackMessage Approved(string projectTitle, string projectUrl, int voltsPaid, int? grantAmount)
    {
        var reward = (voltsPaid, grantAmount) switch
        {
            (> 0, not null) => $" You earned *{voltsPaid} Volts* and a *${grantAmount} grant*.",
            (> 0, null) => $" You earned *{voltsPaid} Volts*.",
            (_, not null) => $" You've been awarded a *${grantAmount} grant*.",
            _ => ""
        };
        return Build(
            $"{Escape(projectTitle)} has been approved!",
            "Project approved! :tada:",
            $"*{Escape(projectTitle)}* passed review.{reward}",
            projectUrl);
    }

    public static SlackMessage ChangesNeeded(string projectTitle, string projectUrl, string? feedback, string? reviewerName) => Build(
        $"{Escape(projectTitle)} needs some changes",
        "Changes requested :wrench:",
        $"{Reviewer(reviewerName)} looked at *{Escape(projectTitle)}* and it needs a few changes before it can be approved. Make them and ship it again!"
            + Feedback(feedback),
        projectUrl);

    public static SlackMessage Rejected(string projectTitle, string projectUrl, string? feedback, string? reviewerName) => Build(
        $"{Escape(projectTitle)} was rejected",
        "Project rejected",
        $"{Reviewer(reviewerName)} reviewed *{Escape(projectTitle)}* and it can't be approved or shipped again."
            + Feedback(feedback),
        projectUrl);

    private static string Reviewer(string? reviewerName) =>
        string.IsNullOrWhiteSpace(reviewerName) ? "A reviewer" : $"*{Escape(reviewerName)}*";

    private static string Feedback(string? feedback) =>
        string.IsNullOrWhiteSpace(feedback) ? "" : $"\n\n*Feedback:*\n>{Escape(feedback.Trim()).Replace("\n", "\n>")}";

    // Section text is capped at 3000 characters by Slack.
    private const int MaxSectionLength = 3000;

    private static SlackMessage Build(string text, string header, string body, string? projectUrl = null)
    {
        if (body.Length > MaxSectionLength) body = body[..(MaxSectionLength - 1)] + "…";

        var blocks = new List<object>
        {
            new { type = "header", text = new { type = "plain_text", text = header, emoji = true } },
            new { type = "section", text = new { type = "mrkdwn", text = body } }
        };
        if (projectUrl is not null)
        {
            blocks.Add(new
            {
                type = "actions",
                elements = new object[]
                {
                    new { type = "button", text = new { type = "plain_text", text = "View project" }, url = projectUrl }
                }
            });
        }
        return new SlackMessage(text, blocks.ToArray());
    }

    // Slack's mrkdwn control characters; escaping them makes <!channel>, <@U123> and
    // <url|label> render as plain text.
    private static string Escape(string text) =>
        text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
