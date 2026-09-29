namespace Torque.Shipments;
// This is the data the client sends in to create a shipment
// Derived from Shipment.cs
public record CreateShipmentDto
{
    public string? ProjectId { get; init; }

    // Required — nullable only so a missing value can be told apart from false/0.
    public bool? IsBuildComplete { get; init; }
    public int? RequestedFunding { get; init; }

    // Required feedback questions.
    public string? HowDidYouHear { get; init; }
    public string? WhatAreWeDoingWell { get; init; }
    public string? HowCanWeImprove { get; init; }
}
