namespace Torque.Slack;

// Text is the notification / fallback text; Blocks is what Slack renders.
public record SlackMessage(string Text, object[] Blocks);

// One line of the streak reminder. FreezeWillCover = missing today spends a freeze
// rather than resetting the streak.
public record StreakReminderItem(string Title, string Url, int Streak, double JournaledSeconds, bool FreezeWillCover);

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

    // Evening nudge, one per owner per day, listing every project whose streak today's
    // missing hour would cost (a freeze or the streak).
    public static SlackMessage StreakAtRisk(IReadOnlyList<StreakReminderItem> projects, int freezesLeft)
    {
        var lines = projects.Select(p =>
            $"• <{p.Url}|{Escape(p.Title)}>: {Days(p.Streak)} streak, {Duration(p.JournaledSeconds)} of 1h journaled today"
            + (p.FreezeWillCover ? "" : " — *resets if you miss today*"));

        var footer = projects.All(p => p.FreezeWillCover)
            ? $"If you miss it, a streak freeze will cover the day (you have {Freezes(freezesLeft)})."
            : projects.Any(p => p.FreezeWillCover)
                ? "Freezes will cover the others."
                : "";

        return Build(
            projects.Count == 1
                ? $"Your {Days(projects[0].Streak)} streak on {Escape(projects[0].Title)} ends at midnight"
                : "Your streaks end at midnight",
            "Keep your streak going :hourglass_flowing_sand:",
            "You haven't hit today's hour yet on:\n" + string.Join("\n", lines)
                + "\n\nJournal an hour before midnight (your time) to keep it going." + (footer == "" ? "" : " " + footer),
            projects.Count == 1 ? projects[0].Url : null);
    }

    public static SlackMessage StreakFreezeUsed(string projectTitle, string projectUrl, int streak, int freezesUsed, int freezesLeft) => Build(
        $"A streak freeze saved your {Days(streak)} streak on {Escape(projectTitle)}",
        "Streak freeze used :ice_cube:",
        (freezesUsed == 1
            ? $"You missed a day on *{Escape(projectTitle)}*, so a streak freeze kept your *{Days(streak)} streak* alive."
            : $"You missed {freezesUsed} days on *{Escape(projectTitle)}*, so {freezesUsed} streak freezes kept your *{Days(streak)} streak* alive.")
            + (freezesLeft == 0
                ? " That was your last one, so the next missed day will reset your streak."
                : $" You have *{Freezes(freezesLeft)}* left."),
        projectUrl);

    public static SlackMessage StreakLost(string projectTitle, string projectUrl, int lostStreak, int freezesUsed, bool freezesPaused)
    {
        var reason = (freezesPaused, freezesUsed) switch
        {
            (true, _) => " Streak freezes are paused on this project, so none were used.",
            (false, 0) => " You were out of streak freezes.",
            (false, _) => $" {(freezesUsed == 1 ? "Your last streak freeze" : $"Your last {freezesUsed} streak freezes")} covered the first missed days, then you ran out."
        };
        return Build(
            $"Your {Days(lostStreak)} streak on {Escape(projectTitle)} ended",
            "Streak lost :broken_heart:",
            $"*{Escape(projectTitle)}* missed a day, so its *{Days(lostStreak)} streak* reset to 0.{reason}"
                + " Journal an hour today to start a new one!",
            projectUrl);
    }

    public static SlackMessage StreakMaxed(string projectTitle, string projectUrl, int streak, int level, decimal voltsPerHour) => Build(
        $"{Escape(projectTitle)} hit its max streak!",
        "Max streak reached! :zap:",
        $"*{Escape(projectTitle)}* is on a *{Days(streak)} streak*, so it now earns the top rate for level {level}: "
            + $"*{voltsPerHour:0.#} Volts/hr*. Keep journaling every day to hold it.",
        projectUrl);

    // An admin raised the project's grant cap (POST api/admin/project/{id}/funding-rate).
    public static SlackMessage FundingBoosted(string projectTitle, string projectUrl, decimal dollarsPerHour) => Build(
        $"Your funding on {Escape(projectTitle)} has been boosted!",
        "Funding boosted! :money_with_wings:",
        $"An organizer boosted the grant rate on *{Escape(projectTitle)}* to *${dollarsPerHour:0.##} per design hour* (up from the usual "
            + $"${Payouts.PayoutService.DefaultGrantDollarsPerHour:0.##}). Ask for up to that much per hour you're shipping on your next design ship.",
        projectUrl);

    // One-time nudge a few days after sign-up for people who haven't created a project.
    public static SlackMessage NoProjectNudge(string username, string newProjectUrl, string guidesUrl, string goodProjectUrl) => Build(
        "Ready to start your first Torque project?",
        "What will you build? :gear:",
        $"Hey *{Escape(username)}*, you joined Torque a few days ago but haven't started a project yet. "
            + "If it makes something move with a motor, it counts, and no hardware experience is needed: Level 1 is made for first-timers.\n\n"
            + "*A few ideas to get you going:*\n"
            + "• A blind opener that lets the morning light in for you\n"
            + "• A servo that turns your deadbolt from your phone\n"
            + "• A belt-driven camera slider with a pan and tilt head\n"
            + "• A small robot arm that records and replays its moves\n"
            + "• An inverted pendulum to tune your own PID loop\n"
            + "• An RC car with your own chassis and steering linkage\n\n"
            + $"<{guidesUrl}|Project Guides> has build guides to start from (make them your own, since clones aren't accepted), "
            + $"and <{goodProjectUrl}|What Makes a Good Project?> covers what reviewers look for. "
            + $"Still stuck? Throw your ideas around in <#{TorqueChannelId}>.",
        newProjectUrl, "Start a project");

    // One-time nudge a few days after someone's first project for people who haven't
    // journaled any time. projectTitle is set when they have exactly one project.
    public static SlackMessage NoJournalNudge(string? projectTitle, int projectCount, string buttonUrl, string journalingUrl, string gettingStartedUrl) => Build(
        projectTitle is null
            ? "You haven't logged any time on your projects yet"
            : $"You haven't logged any time on {Escape(projectTitle)} yet",
        "Time to log your first hours :memo:",
        (projectTitle is null
            ? $"You started *{projectCount} projects* a few days ago but haven't logged any time yet. "
            : $"You started *{Escape(projectTitle)}* a few days ago but haven't logged any time on it yet. ")
            + "Journal entries are how your hours count: they earn your Volts or grant, an hour a day builds a streak that raises your Volts rate, "
            + "and they're what reviewers check when you ship.\n\n"
            + $"Already done some work? Make sure Hackatime is tracking it (see <{gettingStartedUrl}|Getting Started>), "
            + $"then post an entry on your project page. <{journalingUrl}|How to journal> walks you through it.",
        buttonUrl, projectTitle is null ? "View projects" : "View project");

    public static SlackMessage ShopOrderPlaced(string itemName, int quantity, int totalVolts, string shopUrl) => Build(
        $"Order placed: {Escape(itemName)}",
        "Order placed! :package:",
        $"You ordered *{Item(itemName, quantity)}* for *{totalVolts} Volts*. It's in the queue now, and we'll DM you when it ships.",
        shopUrl, "View orders");

    public static SlackMessage ShopOrderFulfilled(string itemName, int quantity, string? trackingReference, string shopUrl) => Build(
        $"Your {Escape(itemName)} has shipped!",
        "Order shipped! :truck:",
        $"*{Item(itemName, quantity)}* is on its way."
            + (string.IsNullOrWhiteSpace(trackingReference) ? "" : $"\n\n*Tracking:* {Escape(trackingReference.Trim())}"),
        shopUrl, "View orders");

    public static SlackMessage ShopOrderRefunded(string itemName, int quantity, int totalVolts, string? reason, string shopUrl) => Build(
        $"Your {Escape(itemName)} order was refunded",
        "Order refunded",
        $"Your order for *{Item(itemName, quantity)}* was cancelled and *{totalVolts} Volts* went back to your balance."
            + (string.IsNullOrWhiteSpace(reason) ? "" : $"\n\n*Reason:*\n>{Escape(reason.Trim()).Replace("\n", "\n>")}"),
        shopUrl, "View orders");

    // #torque on the Hack Club Slack
    private const string TorqueChannelId = "C0BHGT33JHH";

    private static string Item(string itemName, int quantity) =>
        quantity > 1 ? $"{quantity}× {Escape(itemName)}" : Escape(itemName);

    private static string Days(int n) => $"{n}-day";
    private static string Freezes(int n) => n == 1 ? "1 freeze" : $"{n} freezes";

    // Only used for under-an-hour amounts
    private static string Duration(double seconds) => $"{(int)(seconds / 60)}m";

    private static string Reviewer(string? reviewerName) =>
        string.IsNullOrWhiteSpace(reviewerName) ? "A reviewer" : $"*{Escape(reviewerName)}*";

    private static string Feedback(string? feedback) =>
        string.IsNullOrWhiteSpace(feedback) ? "" : $"\n\n*Feedback:*\n>{Escape(feedback.Trim()).Replace("\n", "\n>")}";

    // Section text is capped at 3000 characters by Slack.
    private const int MaxSectionLength = 3000;

    private static SlackMessage Build(string text, string header, string body, string? projectUrl = null, string buttonLabel = "View project")
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
                    new { type = "button", text = new { type = "plain_text", text = buttonLabel }, url = projectUrl }
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
