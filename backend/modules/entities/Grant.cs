namespace Torque.Grants;
// A build grant, created when a design ship that requested funding is approved.
// Fulfilment is manual: an admin sends the money and ticks Fulfilled.
public class Grant
{
    public Guid Id { get; set; }
    public Guid ShipmentId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }

    // USD, copied from the design ship's RequestedFunding.
    public int Amount { get; set; }

    public bool Fulfilled { get; set; } = false;
    public Guid? FulfilledByUserId { get; set; }
    public DateTime? FulfilledAt { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
