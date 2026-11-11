namespace Torque.Reviews;
// One row of the reviewer queue (GET api/admin/review/get/pending)
public record ReviewQueueItemDto
{
    public Guid Id { get; init; }
    public Guid ProjectId { get; init; }
    public string ProjectTitle { get; init; } = "";
    public Guid UserId { get; init; }
    public string Username { get; init; } = "";

    public bool IsBuildComplete { get; init; }
    public float HourSnapshot { get; init; }
    public int RequestedFunding { get; init; }
    public int TierSnapshot { get; init; }
    public DateTime CreatedAt { get; init; }

    // Only set while the claim is fresh (see ReviewController.ClaimTtl)
    public Guid? ClaimedBy { get; init; }
    public string? ClaimedByUsername { get; init; }
    public DateTime? ClaimedAt { get; init; }
    public DateTime? ClaimExpiresAt { get; init; }
    public bool ClaimedByMe { get; init; }
}
