namespace Torque.Shipments;
// This is the data the client sends in to create a shipment
// Derived from Shipment.cs
public record CreateShipmentDto
{
    public string? ProjectId { get; init; }
}
