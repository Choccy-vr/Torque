namespace Torque.Reviews;
// used when a reviewer creates reviews a ship
// Derived from ShipmentReview.cs
public record ReviewShipmentDto
{
    public Guid ShipmentId { get; init; }

    public ShipmentReviewStatus Status { get; init; }

    public bool HideReviewerName { get; init; } = false;

    public Guid ReturnedBy { get; init; }

    public string? Feedback { get; init; }
    public string? InternalNote { get; init; }

    public string? OverrideJustification { get; init; }

    public string? ScreenshotUrl { get; init; }
    public string? TechnicalFeatures { get; init; }
    public string? DeflationJustification { get; init; }
    public string? AdditionalJustification { get; init; }

    public bool Exceptional { get; init; } = false;

    // Approval only. Hours to credit instead of the unpaid journal hours (requires
    // OverrideJustification), and a level (1–4) to set on the project before paying.
    public float? OverrideHours { get; init; }
    public int? OverrideTier { get; init; }

}