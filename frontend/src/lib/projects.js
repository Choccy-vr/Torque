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

export const formatHours = (h) => `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;
