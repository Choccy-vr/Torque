namespace Torque.Settings;

// One global switch: its key (the app_settings row and the URL segment), what the
// admin panel calls it, and the message builders see while it's on.
public record SettingDefinition(string Key, string Label, string Description, string DefaultMessage);

// Every global setting. Adding one: add it here, then gate the endpoint it pauses
// with [PausedBy(SettingKeys.X)] (or an inline IsPausedAsync check when only some
// requests are blocked, like resubmissions).
public static class SettingKeys
{
    public const string ShipsPaused = "ships_paused";
    public const string ResubmissionsPaused = "resubmissions_paused";
    public const string ProjectCreationPaused = "project_creation_paused";
    public const string JournalingPaused = "journaling_paused";
    public const string StreaksPaused = "streaks_paused";
    public const string PayoutsPaused = "payouts_paused";

    public static readonly IReadOnlyList<SettingDefinition> All =
    [
        new(ShipsPaused,
            "Pause ships",
            "Nobody can ship, whether it's a first ship or a resubmission. Building and journaling carry on as normal.",
            "Oops, looks like shipping is paused right now. Keep building and journaling, your hours are safe. Please come back later to ship!"),
        new(ResubmissionsPaused,
            "Pause resubmissions",
            "Projects marked \"changes needed\" can't ship again, so reviewers can clear the queue. First ships still go through.",
            "Oops, looks like resubmissions are paused while we clear the review queue. Keep journaling your fixes, and please come back later to ship!"),
        new(ProjectCreationPaused,
            "Pause new projects",
            "Nobody can start a project. Existing projects can still be edited, journaled on and shipped.",
            "Oops, looks like new projects are paused right now. Please come back later to start one!"),
        new(JournalingPaused,
            "Pause journaling",
            "Nobody can post journal entries. Streaks pause too while this is on, so nobody loses one.",
            "Oops, looks like journaling is paused right now. Your streaks are paused too, so you won't lose them. Please come back later!"),
        new(StreaksPaused,
            "Pause streaks",
            "Missed days don't reset streaks or spend freezes, and they're forgiven when you switch this off. Journaling still extends streaks.",
            "Streaks are paused right now, so a missed day won't break your streak."),
        new(PayoutsPaused,
            "Pause payouts",
            "Approved ships stop going to Airtable for final approval, so no Volts are paid and no grants are created. They queue up and go out when you switch this off. A final approval Airtable sends while this is on is refused; re-run that automation afterwards.",
            "Payouts are paused for a bit. Approved ships are queued and will be paid out once they're back on, so you won't lose anything."),
    ];

    // Either of these stops missed streak days from being settled.
    public static readonly IReadOnlyList<string> StreakPausing = [StreaksPaused, JournalingPaused];

    public static SettingDefinition? Find(string key) => All.FirstOrDefault(d => d.Key == key);
}
