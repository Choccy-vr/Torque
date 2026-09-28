using Torque.Projects;

namespace Torque.Shipments;

public class Shipment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ProjectId { get; set; }

    public string? ReviewerNote { get; set; }
    public string? Feedback { get; set; }

    public ShipmentStatus Status { get; set; } = ShipmentStatus.unreviewed;

    public float HourSnapshot { get; set; }
    public float OverrideHours { get; set; }
    public Project ProjectSnapshot { get; set; } = null!;

    public int TierSnapshot { get; set; }
    public int OverrideTier { get; set; }

    public Guid? ReviewId { get; set; }
    public DateTime ReviewedAt { get; set; }

    public int VoltsGranted { get; set; }

    // Set once the shipment has been pushed to Airtable (see AirtablePushWorker);
    // null means not pushed yet, so it's never pushed twice.
    public string? AirtableRecordId { get; set; }
    public DateTime? AirtablePushedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}
public enum ShipmentStatus
{
    unreviewed,
    approved,
    rejected,
    perm_rejected,
    needs_changes

}