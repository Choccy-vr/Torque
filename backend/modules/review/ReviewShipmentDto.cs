namespace Torque.Reviews;
// used when a reviewer creates reviews a ship
// Derived from ShipmentReview.cs
public record ReviewShipmentDto
{
    public Guid ShipmentId { get; init; }

    public ShipmentReviewStatus Status { get; init; }

    public bool HideReviewerName { get; init; } = false;

    public Guid ReturnedBy { get; init; }

    public string? Feedback { get; init; }
    public string? InternalNote { get; init; }

    public string? OverrideJustification { get; init; }

    public bool Exceptional { get; init; } = false;

}