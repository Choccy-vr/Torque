namespace Torque.Projects;
// Inbound body for the admin funding boost endpoint. Null resets to the default $5/hr.
public record SetFundingRateDto
{
    public decimal? GrantDollarsPerHour { get; init; }
}
