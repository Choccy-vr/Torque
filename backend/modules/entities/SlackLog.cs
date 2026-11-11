namespace Torque.Slack;
// One row per DM or channel invite the Slack bot attempted, written by SlackClient.
// db table: slack_logs
public class SlackLog
{
    public Guid Id { get; set; }

    // Who: the Slack user it was sent to, and their Torque account if one has that Slack ID.
    public string SlackUserId { get; set; } = null!;
    public Guid? UserId { get; set; }

    // What: dm or channel_invite. Detail is the DM's notification text, or the channel ID
    // for an invite.
    public SlackAction Action { get; set; }
    public string Detail { get; set; } = null!;

    // Whether it went through. An invite to a channel they're already in counts as a success
    // (Error is still "already_in_channel"). Error is Slack's error code, or "no_response" if
    // the request itself failed (timeout, HTTP error).
    public bool Success { get; set; }
    public string? Error { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum SlackAction
{
    dm,
    channel_invite
}
