import { CirclePause, RotateCw } from "lucide-react";
import { pausedMessage, useSettings } from "../lib/settings.js";
import { FOCUS } from "./Form.jsx";

// Building blocks shared by the in-app pages (profile, project): redlined
// section headings, the dashed empty / inline-error placeholders, and the
// slim notice strip.

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

// One slim line about where things stand, with an optional action at its end.
// `attention` (full coral edge and icon) is for something the reader must act on.
export function Notice({ icon: Icon, attention = false, action, children }) {
    return (
        // Phones: the action drops under the sentence; wider, it sits at the end.
        <section
            className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-2xl border-2 bg-(--card) px-4 py-3 text-(--text) sm:flex sm:items-center sm:gap-x-4 sm:px-5 ${attention ? "border-(--accent)" : "border-(--accent)/55"}`}
        >
            <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 sm:mt-0 ${attention ? "text-(--accent)" : "text-(--text)/85"}`} />
            <p className="min-w-0 flex-1 leading-relaxed text-(--text)/90">{children}</p>
            {action && <div className="col-start-2 -ml-3 sm:ml-0">{action}</div>}
        </section>
    );
}

// A notice per admin switch in `keys` that's on (see lib/settings.js), with
// the message the admin set. Nothing while settings load or nothing's paused.
export function PauseNotices({ keys, className = "" }) {
    const settings = useSettings();
    const messages = keys.map((key) => [key, pausedMessage(settings, key)]).filter(([, message]) => message);

    // Stays mounted (hidden while empty) so a pause that lands later is announced.
    return (
        <div role="status" className={`flex flex-col gap-3 empty:hidden ${className}`}>
            {messages.map(([key, message]) => (
                <Notice key={key} icon={CirclePause}>{message}</Notice>
            ))}
        </div>
    );
}

// A ‹ / › button that pages a sideways row (see useScrollEdges). `controls` is the row's id.
export function PageButton({ icon: Icon, label, controls, disabled, onClick }) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-controls={controls}
            // aria-disabled rather than disabled: paging to the end must not
            // throw keyboard focus off the button that got it there.
            aria-disabled={disabled || undefined}
            onClick={disabled ? undefined : onClick}
            className={`inline-flex size-11 items-center justify-center rounded-(--radius) border-2 border-(--accent)/55 text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15 aria-disabled:cursor-default aria-disabled:border-white/15 aria-disabled:bg-transparent aria-disabled:text-(--text)/40 ${FOCUS}`}
        >
            <Icon aria-hidden="true" className="size-5" />
        </button>
    );
}
