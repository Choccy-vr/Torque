namespace Torque.Grants;
// A build grant as admins see it
// Derived from Grant.cs
public record AdminGrantDto
{
    public Guid Id { get; init; }
    public Guid ShipmentId { get; init; }
    public Guid ProjectId { get; init; }
    public string ProjectTitle { get; init; } = null!;
    public Guid UserId { get; init; }
    public string Username { get; init; } = null!;

    public int Amount { get; init; }

    public bool Fulfilled { get; init; }
    public Guid? FulfilledByUserId { get; init; }
    public DateTime? FulfilledAt { get; init; }

    public string? Note { get; init; }

    public DateTime CreatedAt { get; init; }
}
