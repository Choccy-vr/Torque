namespace Torque.Shipments;
// This is exposed to only the owner of the ship
// Derived from Shipment.cs
public record OwnShipmentDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid ProjectId { get; init; }

    public ShipmentStatus Status { get; init; } = ShipmentStatus.unreviewed;

    public string? Feedback { get; init; }

    public float HourSnapshot { get; init; }
    public float OverrideHours { get; init; }

    public int OverrideTier { get; init; }

    public Guid? ReviewId { get; init; }
    public DateTime ReviewedAt { get; init; }

    public int VoltsGranted { get; init; }


    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

}