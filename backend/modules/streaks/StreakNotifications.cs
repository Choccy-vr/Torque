using Torque.Projects;
using Torque.Slack;
using Torque.Users;

namespace Torque.Streaks;

// Turns a StreakChange into its Slack DM. Call after the change is saved.
public static class StreakNotifications
{
    public static void Send(SlackNotifier slack, SlackOptions options, User owner, Project project, StreakChange change)
    {
        var url = options.ProjectUrl(project.Id);

        // A reset outranks the freezes spent on the way to it.
        if (change.LostStreak is { } lost)
        {
            slack.Send(owner.SlackUserID, SlackMessages.StreakLost(project.Title, url, lost, change.FreezesUsed, change.LostWithFreezesPaused));
            return;
        }
        if (change.FreezesUsed > 0)
        {
            slack.Send(owner.SlackUserID, SlackMessages.StreakFreezeUsed(project.Title, url, project.StreakCount, change.FreezesUsed, owner.StreakFreezes));
        }
        if (change.ReachedMax)
        {
            slack.Send(owner.SlackUserID, SlackMessages.StreakMaxed(project.Title, url, project.StreakCount, project.Tier,
                StreakService.VoltsPerHour(project.Tier, project.StreakCount)));
        }
    }
}
