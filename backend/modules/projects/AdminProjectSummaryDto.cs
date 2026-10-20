namespace Torque.Projects;
// One row of the admin project search
public record AdminProjectSummaryDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = null!;
    public Guid OwnerUserId { get; init; }
    public string OwnerUsername { get; init; } = null!;
    public ProjectStatus Status { get; init; }
    public int Tier { get; init; }
    public float TotalHours { get; init; }
    public float TotalHoursApproved { get; init; }
    public int VoltsGranted { get; init; }
    public ProjectGrantStatus GrantStatus { get; init; }
    public bool IsArchived { get; init; }
    public bool IsStaffPick { get; init; }
    public string? CoverImageUrl { get; init; }
    public DateTime CreatedAt { get; init; }
}
