using Torque.Projects;
namespace Torque.Airtable;
// Returned to the Airtable approval automation
public record AirtableApprovalDto
{
    public Guid ShipmentId { get; init; }
    public Guid ProjectId { get; init; }
    public ProjectStatus ProjectStatus { get; init; }
    public ProjectGrantStatus GrantStatus { get; init; }

    // What the final approval credited and paid: hours, Volts (build ships) and the grant
    // (design ships that requested funding).
    public float ApprovedHours { get; init; }
    public decimal VoltsPerHour { get; init; }
    public int VoltsPaid { get; init; }
    public Guid? GrantId { get; init; }

    // true when the ship had already been approved: nothing was paid this time, and the
    // fields above are what the earlier approval did.
    public bool AlreadyApproved { get; init; }

    public DateTime FinalApprovedAt { get; init; }
}
