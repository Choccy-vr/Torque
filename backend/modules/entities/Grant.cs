using Torque.Payouts;

namespace Torque.Grants;
// A build grant, created when a design ship that requested funding is approved.
// Fulfilment is manual: an admin sends the money and ticks Fulfilled.
public class Grant
{
    public Guid Id { get; set; }
    public Guid ShipmentId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }

    // USD: the design ship's RequestedFunding, capped at DollarsPerHour per approved hour.
    public int Amount { get; set; }
    // The project's grant rate when this was approved ($5 unless boosted). Amount /
    // DollarsPerHour is how many hours the grant covers, which build ships don't pay again.
    public decimal DollarsPerHour { get; set; } = PayoutService.DefaultGrantDollarsPerHour;

    public bool Fulfilled { get; set; } = false;
    public Guid? FulfilledByUserId { get; set; }
    public DateTime? FulfilledAt { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
