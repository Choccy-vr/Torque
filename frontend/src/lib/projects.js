// Backend ProjectStatus -> what the builder sees. "Changes needed" is the only
// state that asks something of them, so it's the only one drawn in coral.
export const PROJECT_STATUS = {
    Unshipped: { label: "Not shipped" },
    Unreviewed: { label: "In review" },
    Claimed: { label: "In review" },
    Fraud_Pending: { label: "Final checks" },
    Changes_Needed: { label: "Changes needed", attention: true },
    Approved: { label: "Approved" },
    Perm_Rejected: { label: "Rejected" },
};

// Backend ShipmentStatus -> what the builder sees. Same rule as projects: only
// "Changes needed" asks something of them, so only it is drawn in coral.
export const SHIP_STATUS = {
    unreviewed: { label: "In review" },
    approved: { label: "Approved" },
    rejected: { label: "Rejected" },
    perm_rejected: { label: "Permanently rejected" },
    needs_changes: { label: "Changes needed", attention: true },
};

export const formatHours = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;

export const formatDay = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The admin area names every backend status exactly (builders see the softer
// labels above). Coral still marks the ones waiting on someone.
export const ADMIN_PROJECT_STATUS = {
    Unshipped: { label: "Unshipped" },
    Unreviewed: { label: "Unreviewed", attention: true },
    Claimed: { label: "Claimed" },
    Fraud_Pending: { label: "Fraud pending" },
    Changes_Needed: { label: "Changes needed" },
    Approved: { label: "Approved" },
    Perm_Rejected: { label: "Perm rejected" },
};

export const ADMIN_SHIP_STATUS = {
    unreviewed: { label: "Unreviewed", attention: true },
    approved: { label: "Approved" },
    rejected: { label: "Rejected" },
    perm_rejected: { label: "Perm rejected" },
    needs_changes: { label: "Changes needed" },
};

// Date and time, for admin records where the hour matters.
export const formatWhen = (iso) =>
    new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// The backend sends 0001-01-01 for timestamps that were never set.
export const isSet = (iso) => Boolean(iso) && new Date(iso).getFullYear() > 2000;

// Project levels 1–4, each with a one-line scope (the level picker, the shop).
export const LEVELS = [
    { level: 1, name: "Starter", about: "Your first motor project. Basic motion with off-the-shelf parts." },
    { level: 2, name: "Stepping stone", about: "One motor done well, or motors plus sensors, screens or buttons." },
    { level: 3, name: "Polished", about: "Advanced motor control or custom electronics, in an enclosure or rigid frame." },
    { level: 4, name: "Flagship", about: "Complex control like FOC, custom PCBs and product-grade mechanics." },
];
