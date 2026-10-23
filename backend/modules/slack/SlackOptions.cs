namespace Torque.Slack;

public class SlackOptions
{
    // Bot token (xoxb-...) of the Torque Slack app. Needs chat:write + im:write for DMs,
    // and channels:manage / groups:write to invite users to public / private channels.
    // Unset disables everything Slack.
    public string? BotToken { get; set; }

    // Channels POST api/slack/channels/join invites the caller to. The bot must already be
    // a member of each one, or Slack refuses the invite.
    public string[] JoinChannelIds { get; set; } = [];

    // Base of the "View project" links in DMs.
    public string FrontendUrl { get; set; } = "";

    public bool Configured => !string.IsNullOrEmpty(BotToken);

    public string ProjectUrl(Guid projectId) => $"{FrontendUrl}/projects/{projectId}";

    public string ShopUrl => $"{FrontendUrl}/shop";
}
