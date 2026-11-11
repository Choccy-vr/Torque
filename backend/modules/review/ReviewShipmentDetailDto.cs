using Torque.Projects;
using Torque.Shipments;
namespace Torque.Reviews;
// One ship with everything a reviewer needs on one page (GET api/admin/review/get/{id}):
// the reviewer view plus the live claim, the builder, the project's markers and its
// history (earlier ships and reviews), and the builder's other projects.
public record ReviewShipmentDetailDto : AdminShipmentDto
{
    public string ProjectTitle { get; init; } = "";
    public ProjectStatus ProjectStatus { get; init; }

    // Only set while the claim is fresh (see ReviewController.ClaimTtl)
    public Guid? ClaimedBy { get; init; }
    public string? ClaimedByUsername { get; init; }
    public DateTime? ClaimedAt { get; init; }
    public DateTime? ClaimExpiresAt { get; init; }
    public bool ClaimedByMe { get; init; }

    public ReviewOwnerDto Owner { get; init; } = null!;

    // Live from the project, not the snapshot
    public bool IsStaffPick { get; init; }
    public bool Exceptional { get; init; }
    public float TotalHoursApproved { get; init; }

    // Reviews of this project's earlier ships, newest first (this ship's own too, if any)
    public List<AdminShipmentReviewDto> PreviousReviews { get; init; } = [];
    // The project's other ships, newest first
    public List<ReviewPreviousShipDto> PreviousShips { get; init; } = [];
    // The builder's other projects, newest first (deleted ones too)
    public List<ReviewOtherProjectDto> OtherProjects { get; init; } = [];
}

public record ReviewOwnerDto
{
    public Guid Id { get; init; }
    public string Username { get; init; } = "";
    public string? SlackUserID { get; init; }
    public string? ProfilePictureUrl { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record ReviewPreviousShipDto
{
    public Guid Id { get; init; }
    public bool IsBuildComplete { get; init; }
    public ShipmentStatus Status { get; init; }
    public float HourSnapshot { get; init; }
    public float ApprovedHours { get; init; }
    public DateTime? FinalApprovedAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record ReviewOtherProjectDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = "";
    public ProjectStatus Status { get; init; }
    public int Tier { get; init; }
    public float TotalHoursApproved { get; init; }
    public bool IsArchived { get; init; }
    public DateTime CreatedAt { get; init; }
}
