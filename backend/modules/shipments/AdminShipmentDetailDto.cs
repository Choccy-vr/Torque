using Torque.Reviews;
namespace Torque.Shipments;
// A ship with everything around it, for the admin ship lookup: the reviewer view plus
// who/what it belongs to, its Airtable state and every review it got
public record AdminShipmentDetailDto : AdminShipmentDto
{
    public string ProjectTitle { get; init; } = null!;
    public string Username { get; init; } = null!;
    public string? AirtableRecordId { get; init; }
    public DateTime? AirtablePushedAt { get; init; }
    public List<AdminShipmentReviewDto> Reviews { get; init; } = [];
}
