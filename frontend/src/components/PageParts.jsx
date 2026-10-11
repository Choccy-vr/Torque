import { RotateCw } from "lucide-react";

// Building blocks shared by the in-app pages (profile, project): redlined
// section headings and the dashed empty / inline-error placeholders.

// `action` sits at the heading's far end (e.g. the project's "New entry").
export function Section({ id, title, count, action, children }) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <h2 id={id} className="flex items-baseline gap-3 text-(--text)">
                    {/* The docs' coral h2 tick, so sections read as redlined. */}
                    <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-(--accent)" />
                    <span className="[font-family:var(--heading-font)] text-3xl font-bold">{title}</span>
                    {count > 0 && <span className="text-lg font-medium text-(--text)/75 tabular-nums">{count}</span>}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

export function Empty({ title, children, action }) {
    return (
        <div className="flex flex-col items-start gap-1.5 rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-8 text-(--text) sm:px-7">
            <p className="text-lg font-bold">{title}</p>
            <p className="max-w-[55ch] leading-relaxed text-(--text)/80">{children}</p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

export function InlineError({ what, onRetry }) {
    return (
        <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-6 text-(--text) sm:px-7">
            <p className="leading-relaxed text-(--text)/90">Couldn't load {what}. Check your connection and try again.</p>
            <RetryButton onClick={onRetry} />
        </div>
    );
}

export function RetryButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-6 font-bold"
        >
            <RotateCw aria-hidden="true" className="size-4" />
            Try again
        </button>
    );
}
