// Shared bits for the /review pages.

// "3h", "2 days": how long a ship has been waiting, for the queue.
export function waitingFor(iso, now = Date.now()) {
    const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"}`;
}

// "4:05 PM": when a claim runs out.
export const formatClock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// One decimal, no trailing ".0": 4.25 -> "4.3h"
export const hoursLabel = (h) => `${Number((h ?? 0).toFixed(1))}h`;

// The decisions a first-pass review can make (ShipmentReviewStatus, minus the
// unsupported "returned"), with what each one does to the builder.
export const DECISIONS = [
    { value: "approved", label: "Approve", about: "Goes on to the fraud check. Hours and Volts pay out at final approval.", submit: "Approve ship" },
    { value: "changes_needed", label: "Changes needed", about: "Sent back with your feedback. They can fix it and reship.", submit: "Send back for changes" },
    { value: "rejected", label: "Reject", about: "Not approved this time. They can still reship the project.", submit: "Reject ship" },
    { value: "perm_rejected", label: "Permanently reject", about: "The project can never ship again. Use it for fraud or abuse.", submit: "Permanently reject" },
];
