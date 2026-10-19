using Torque.Streaks;
namespace Torque.Projects;
// Everything about a project an admin can see
// Derived from Project.cs
public record AdminProjectDto
{
    public Guid Id { get; init; }
    public Guid OwnerUserId { get; init; }
    public string OwnerUsername { get; init; } = null!;
    public string Title { get; init; } = null!;
    public string? Description { get; init; }
    public int Tier { get; init; }
    public string? RepoUrl { get; init; }
    public string? DemoUrl { get; init; }
    public string? ReadmeUrl { get; init; }
    public string? CoverImageUrl { get; init; }
    public string? AiUse { get; init; }
    public string[]? HackatimeProjectNames { get; init; }
    public int JournalCount { get; init; }
    public ProjectStatus Status { get; init; }
    public Guid ClaimedByReviewer { get; init; }
    public string? ClaimedByUsername { get; init; }
    public DateTime ClaimedAt { get; init; }
    public float TrackedDesignHours { get; init; }
    public float TrackedBuildHours { get; init; }
    public float TotalHours { get; init; }
    public float TotalHoursApproved { get; init; }
    public int VoltsGranted { get; init; }
    public ProjectGrantStatus GrantStatus { get; init; }
    public bool Exceptional { get; init; }
    public bool IsStaffPick { get; init; }
    public bool IsArchived { get; init; }
    public DateTime? ArchivedAt { get; init; }
    public int Streak { get; init; }
    public int MaxStreak { get; init; }
    public DateOnly? LastStreakDate { get; init; }
    public bool StreakFreezesPaused { get; init; }
    public DateTime CreatedAt { get; init; }

    public static AdminProjectDto From(Project project, string ownerUsername, string? claimedByUsername) => new()
    {
        Id = project.Id,
        OwnerUserId = project.OwnerUserId,
        OwnerUsername = ownerUsername,
        Title = project.Title,
        Description = project.Description,
        Tier = project.Tier,
        RepoUrl = project.RepoUrl,
        DemoUrl = project.DemoUrl,
        ReadmeUrl = project.ReadmeUrl,
        CoverImageUrl = project.CoverImageUrl,
        AiUse = project.AiUse,
        HackatimeProjectNames = project.HackatimeProjectNames,
        JournalCount = project.DevlogIds?.Length ?? 0,
        Status = project.Status,
        ClaimedByReviewer = project.ClaimedByReviewer,
        ClaimedByUsername = claimedByUsername,
        ClaimedAt = project.ClaimedAt,
        TrackedDesignHours = project.TrackedDesignHours,
        TrackedBuildHours = project.TrackedBuildHours,
        TotalHours = project.TotalHoursRaw,
        TotalHoursApproved = project.TotalHoursApproved,
        VoltsGranted = project.VoltsGranted,
        GrantStatus = project.GrantStatus,
        Exceptional = project.Exceptional,
        IsStaffPick = project.IsStaffPick,
        IsArchived = project.IsArchived,
        ArchivedAt = project.ArchivedAt,
        Streak = StreakService.EffectiveStreak(project.StreakCount, project.Tier),
        MaxStreak = StreakService.MaxStreakForLevel(project.Tier),
        LastStreakDate = project.LastStreakDate,
        StreakFreezesPaused = project.StreakFreezesPaused,
        CreatedAt = project.CreatedAt
    };
}
