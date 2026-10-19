namespace Torque.Shipments;
// One row of the admin ship lookup
public record AdminShipmentSummaryDto
{
    public Guid Id { get; init; }
    public Guid ProjectId { get; init; }
    public string ProjectTitle { get; init; } = null!;
    public Guid UserId { get; init; }
    public string Username { get; init; } = null!;
    public ShipmentStatus Status { get; init; }
    public bool IsBuildComplete { get; init; }
    public float HourSnapshot { get; init; }
    public float ApprovedHours { get; init; }
    public int VoltsGranted { get; init; }
    public int RequestedFunding { get; init; }
    public bool PushedToAirtable { get; init; }
    public DateTime? FinalApprovedAt { get; init; }
    public DateTime CreatedAt { get; init; }
}
