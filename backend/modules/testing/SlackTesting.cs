using System.Security.Claims;
using Torque.Data;
using Torque.Slack;
using Torque.Streaks;
// Dev-only Slack DM preview for the test harness
// endpoint: /testing/slack/dm

namespace Torque.Testing;

// `template` is one of welcome | shipped | approved | changes_needed | rejected | streak_at_risk |
// streak_freeze_used | streak_lost | streak_maxed (sample numbers). The DM always
// goes to the signed-in user's own Slack ID — even in dev there's no way to message anyone
// else. Sent synchronously (unlike SlackNotifier) so the harness can show whether it landed.
public record SlackDmTestRequest(string? Template = null, string? ProjectTitle = null, string? Feedback = null);

public static class SlackTesting
{
    public static void MapSlackTesting(this WebApplication app)
    {
        app.MapPost("/testing/slack/dm", async (
            SlackDmTestRequest body, ClaimsPrincipal principal, AppDbContext db, SlackClient slack, SlackOptions options, CancellationToken ct) =>
        {
            if (!options.Configured)
            {
                return Results.Problem("Slack is disabled — set SLACK_BOT_TOKEN in backend/.env.", statusCode: 503);
            }
            if (!Guid.TryParse(principal.FindFirst("sub")?.Value, out var userId)) return Results.Unauthorized();

            var user = await db.Users.FindAsync([userId], ct);
            if (user is null) return Results.NotFound("No user row yet — call GET /api/user/me once first.");
            if (string.IsNullOrWhiteSpace(user.SlackUserID)) return Results.BadRequest("Your account has no Slack ID linked.");

            var title = string.IsNullOrWhiteSpace(body.ProjectTitle) ? "Harness test project" : body.ProjectTitle;
            var url = options.ProjectUrl(Guid.Empty);
            var reviewer = string.IsNullOrWhiteSpace(user.Username) ? null : user.Username;

            SlackMessage? message = body.Template?.Trim().ToLowerInvariant() switch
            {
                "welcome" => SlackMessages.Welcome(user.Username ?? "builder"),
                "shipped" => SlackMessages.Shipped(title, url),
                "approved" => SlackMessages.Approved(title, url, 120, 50),
                "changes_needed" => SlackMessages.ChangesNeeded(title, url, body.Feedback, reviewer),
                "rejected" => SlackMessages.Rejected(title, url, body.Feedback, reviewer),
                "streak_at_risk" => SlackMessages.StreakAtRisk(
                    [new StreakReminderItem(title, url, 12, 20 * 60, FreezeWillCover: true),
                     new StreakReminderItem("Second test project", url, 4, 0, FreezeWillCover: false)], 1),
                "streak_freeze_used" => SlackMessages.StreakFreezeUsed(title, url, 12, 1, 2),
                "streak_lost" => SlackMessages.StreakLost(title, url, 12, 0, freezesPaused: false),
                "streak_maxed" => SlackMessages.StreakMaxed(title, url, 15, 1, StreakService.VoltsPerHour(1, 15)),
                _ => null
            };
            if (message is null)
            {
                return Results.BadRequest("template must be welcome, shipped, approved, changes_needed, rejected, streak_at_risk, streak_freeze_used, streak_lost or streak_maxed.");
            }

            var sent = await slack.SendDmAsync(user.SlackUserID, message);
            return Results.Ok(new
            {
                sent,
                slackId = user.SlackUserID,
                template = body.Template,
                hint = sent ? null : "Not sent — check the server log for Slack warnings (bad token, missing chat:write/im:write scope, or an unknown Slack ID)."
            });
        }).RequireAuthorization();
    }
}
