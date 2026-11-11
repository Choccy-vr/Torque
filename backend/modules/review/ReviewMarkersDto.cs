namespace Torque.Reviews;
// PATCH api/admin/review/project/{id}/markers — omitted/null fields are left unchanged
public record ReviewMarkersDto
{
    public bool? IsStaffPick { get; init; }
    public bool? Exceptional { get; init; }
}
