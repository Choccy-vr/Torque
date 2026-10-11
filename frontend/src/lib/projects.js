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
