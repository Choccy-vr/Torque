namespace Torque.Reviews;
// data that is returned for a ship review for Admin
// Derived from ShipmentReview.cs
public record AdminShipmentReviewDto
{
    public Guid Id { get; init; }
    public Guid ProjectId { get; init; }
    public Guid ShipmentId { get; init; }
    public Guid ReviewerId { get; init; }

    public ShipmentReviewStatus Status { get; init; }

    public bool HideReviewerName { get; init; } = false;

    public Guid ReturnedBy { get; init; }

    public string? Feedback { get; init; }
    public string? InternalNote { get; init; }

    public string? OverrideJustification { get; init; }

    public bool Exceptional { get; init; } = false;

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

}