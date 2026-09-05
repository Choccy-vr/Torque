namespace Torque.Shipments;

public class ShipmentReview
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid ShipmentId { get; set; }
    public Guid ReviewerId { get; set; }

    public bool HideReviewerName { get; set; } = false;

    public Guid ReturnedBy { get; set; }

    public string? Feedback { get; set; }
    public string? InternalNote { get; set; }

    public string? OverrideJustification { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}
public enum ShipmentReviewStatus
{
    approved,
    rejected,
    returned,
    changes_needed
}