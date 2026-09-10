namespace Torque.Shipments;
// This is exposed publicly (anyone authenticated)
// Derived from Shipment.cs
public record PublicShipmentDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public Guid ProjectId { get; init; }

    public ShipmentStatus Status { get; init; } = ShipmentStatus.unreviewed;

    public float HourSnapshot { get; init; }
    public float OverrideHours { get; init; }

    public int OverrideTier { get; init; }

    public int VoltsGranted { get; init; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
