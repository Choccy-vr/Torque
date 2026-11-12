namespace Torque.Slack;
// One row of the admin Slack log: a DM or channel invite the bot attempted
public record SlackLogDto
{
    public Guid Id { get; init; }
    public string SlackUserId { get; init; } = null!;
    // The Torque account with that Slack ID, if there is one
    public Guid? UserId { get; init; }
    public string? Username { get; init; }
    public string? ProfilePictureUrl { get; init; }
    public SlackAction Action { get; init; }
    // The DM's notification text, or the channel ID for an invite
    public string Detail { get; init; } = null!;
    public bool Success { get; init; }
    public string? Error { get; init; }
    public DateTime CreatedAt { get; init; }
}
