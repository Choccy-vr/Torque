namespace Torque.Airtable;
// Body the Airtable approval automation sends to POST api/airtable/approve
public record AirtableApproveDto
{
    // The Torque shipment id (the "Torque Ship ID" column AirtableSubmissionBuilder fills).
    public Guid? ShipmentId { get; init; }

    // Hours to credit instead of the reviewer's override / the hours snapshotted at ship
    // time. Optional, >= 0.
    public float? OverrideHours { get; init; }
}
