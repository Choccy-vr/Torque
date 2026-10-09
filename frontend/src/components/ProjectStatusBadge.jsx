import { PROJECT_STATUS } from "../lib/projects.js";

export default function ProjectStatusBadge({ status, quiet = false }) {
    const { label, attention: flagged } = PROJECT_STATUS[status] ?? { label: status };
    const attention = flagged && !quiet;

    return (
        <span
            className={`shrink-0 self-start justify-self-start rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap ${
                attention
                    ? "border-(--accent) bg-(--accent)/15 text-(--text)"
                    : "border-white/20 bg-white/5 text-(--text)/85"
            }`}
        >
            {label}
        </span>
    );
}
