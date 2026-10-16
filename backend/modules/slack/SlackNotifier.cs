namespace Torque.Slack;

// Fire-and-forget DMs, best effort like the template: a Slack outage or a bad Slack ID is
// logged and never fails or slows the request that triggered it. Call it after the DB
// commit, with plain values only — the send outlives the request's DbContext.
public class SlackNotifier
{
    private readonly SlackOptions _options;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<SlackNotifier> _logger;

    public SlackNotifier(SlackOptions options, IServiceScopeFactory scopes, ILogger<SlackNotifier> logger)
    {
        _options = options;
        _scopes = scopes;
        _logger = logger;
    }

    public void Send(string? slackId, SlackMessage message)
    {
        if (!_options.Configured || string.IsNullOrWhiteSpace(slackId)) return;

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var client = scope.ServiceProvider.GetRequiredService<SlackClient>();
                await client.SendDmAsync(slackId, message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Slack DM to {SlackId} failed", slackId);
            }
        });
    }
}
