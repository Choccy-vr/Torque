namespace Torque.Projects;

public class Project
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }

    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public int Tier { get; set; }

    public string? RepoUrl { get; set; }
    public string? DemoUrl { get; set; }
    public string? ReadmeUrl { get; set; }

    public Guid ClaimedByReviewer { get; set; }
    public DateTime ClaimedAt { get; set; }

    public string[]? HackatimeProjectNames { get; set; }

    public ProjectStatus Status { get; set; } = ProjectStatus.Unshipped;

    public float TrackedDesignHours { get; set; } = 0;// hours spent on design stage
    public float TrackedBuildHours { get; set; } = 0;// hours spent on build stage
    public float TotalHoursRaw { get; set; } = 0;// raw total hours tracked
    public float TotalHoursApproved { get; set; } = 0;// total hours tracked approved

    public string? AiUse { get; set; }

    public int VoltsGranted { get; set; } = 0;



    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}
public enum ProjectStatus
{
    Unshipped,
    Unreviewed,
    Claimed,
    Fraud_Pending,
    Changes_Needed,
    Approved
}
