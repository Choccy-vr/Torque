using Torque.Projects;
namespace Torque.Shipments;
// This is exposed to Reviewers
// Derived from Shipment.cs
public record AdminShipmentDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid ProjectId { get; init; }

    public string? ReviewerNote { get; init; }
    public string? Feedback { get; init; }

    public ShipmentStatus Status { get; init; } = ShipmentStatus.unreviewed;

    public float HourSnapshot { get; init; }
    public float OverrideHours { get; init; }
    public Project ProjectSnapshot { get; init; } = null!;

    public int TierSnapshot { get; init; }
    public int OverrideTier { get; init; }

    public Guid? ReviewId { get; init; }
    public DateTime ReviewedAt { get; init; }

    public int VoltsGranted { get; init; }


    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}