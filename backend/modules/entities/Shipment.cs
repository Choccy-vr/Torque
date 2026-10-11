using Torque.Projects;

namespace Torque.Shipments;

public class Shipment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ProjectId { get; set; }

    public string? ReviewerNote { get; set; }
    public string? Feedback { get; set; }

    public ShipmentStatus Status { get; set; } = ShipmentStatus.unreviewed;

    public float HourSnapshot { get; set; }
    public float OverrideHours { get; set; }
    public Project ProjectSnapshot { get; set; } = null!;

    public int TierSnapshot { get; set; }
    public int OverrideTier { get; set; }

    public Guid? ReviewId { get; set; }
    public DateTime ReviewedAt { get; set; }

    public int VoltsGranted { get; set; }

    // Set on approval (see Torque.Payouts.PayoutService). ApprovedHours is what this ship
    // credited; PaidHours is what a build ship converted to Volts at VoltsPerHour.
    public float ApprovedHours { get; set; }
    public float PaidHours { get; set; }
    public decimal VoltsPerHour { get; set; }

    // Answered by the shipper when shipping. false = design ship, true = build ship
    // (Airtable "Design or build").
    public bool IsBuildComplete { get; set; }
    public int RequestedFunding { get; set; }
    public string? HowDidYouHear { get; set; }
    public string? WhatAreWeDoingWell { get; set; }
    public string? HowCanWeImprove { get; set; }

    // Set once the shipment has been pushed to Airtable (see AirtablePushWorker);
    // null means not pushed yet, so it's never pushed twice.
    public string? AirtableRecordId { get; set; }
    public DateTime? AirtablePushedAt { get; set; }

    // Set when the ship gets its final approval from Airtable (fraud review, second pass —
    // see AirtableWebhookController). That's when hours are credited and the Volts paid
    // or the grant created; until then ApprovedHours/PaidHours/VoltsGranted are 0.
    public DateTime? FinalApprovedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}
public enum ShipmentStatus
{
    unreviewed,
    approved,
    rejected,
    perm_rejected,
    needs_changes

}