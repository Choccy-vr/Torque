import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Copy, Search, X } from "lucide-react";
import { Empty, InlineError } from "../PageParts.jsx";
import { BTN_GHOST, BTN_PRIMARY, FOCUS, FormError } from "../Form.jsx";
import Switch from "../Switch.jsx";
import { MAX_RESULTS, useParam } from "../../lib/admin.js";

// Building blocks shared by the admin pages: search + filters kept in the URL
// (so Back returns to the same results), result lists, ruled fact ledgers,
// panels and switch rows.

// The Explore search pill. Types freely; the URL (and so the request) only
// follows once typing pauses.
export function SearchField({ label, placeholder }) {
    const [value, setValue] = useParam("q");
    const [text, setText] = useState(value);

    useEffect(() => {
        if (text.trim() === value) return;
        const t = setTimeout(() => setValue(text.trim()), 300);
        return () => clearTimeout(t);
    }, [text, value, setValue]);

    return (
        <div role="search" className="relative w-full sm:max-w-md">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-(--text)/70" />
            <input
                type="search"
                aria-label={label}
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="min-h-12 w-full rounded-(--radius) border-2 border-(--accent)/55 bg-(--card) py-2 pr-13 pl-13 text-(--text) caret-(--accent) transition-all duration-300 ease placeholder:text-(--text)/75 hover:border-(--accent)/80 focus:border-(--accent) focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text) [&::-webkit-search-cancel-button]:hidden"
            />
            {text && (
                <button
                    type="button"
                    onClick={() => { setText(""); setValue(""); }}
                    aria-label="Clear search"
                    className={`absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-(--text)/75 transition-colors duration-300 ease hover:bg-white/10 hover:text-(--text) ${FOCUS}`}
                >
                    <X aria-hidden="true" className="size-4.5" />
                </button>
            )}
        </div>
    );
}

// A pill <select> bound to one URL param. `options` is [value, label][];
// the first is usually ["", "Any …"].
export function FilterSelect({ name, label, options }) {
    const [value, setValue] = useParam(name);
    return (
        <label className="flex min-h-12 items-center gap-2 rounded-(--radius) border-2 border-white/15 bg-(--card) pr-2 pl-4 text-(--text) transition-colors duration-300 ease focus-within:border-(--accent) hover:border-white/30">
            <span className="text-sm text-(--text)/80">{label}</span>
            <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-h-10 cursor-pointer rounded-lg bg-transparent pr-1 font-medium text-(--text) focus:outline-none [&>option]:bg-(--card)"
            >
                {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
            </select>
        </label>
    );
}

export function Toolbar({ children }) {
    return <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

// A search's results: skeleton rows, error, empty, or a ruled list of rows
// (see ResultRow). Says so when the backend's cap may be hiding older ones.
// `flat` draws it as a recessed well, for lists that sit inside a Panel.
export function ResultList({ api, label, empty, flat = false, children }) {
    const frame = flat
        ? "rounded-2xl border-2 border-white/10 bg-(--bg)/30 divide-y-2 divide-white/10 overflow-hidden"
        : "t-card divide-y-2 divide-white/10 overflow-hidden";
    if (api.loading && !api.data) {
        return (
            <ul aria-busy="true" aria-label={`Loading ${label}`} className={frame}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <li key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                        <div className="size-10 shrink-0 rounded-[0.625rem] bg-white/10 motion-safe:animate-pulse" />
                        <div className="flex flex-1 flex-col gap-2">
                            <div className="h-5 w-48 max-w-full rounded bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-4 w-72 max-w-full rounded bg-white/10 motion-safe:animate-pulse" />
                        </div>
                    </li>
                ))}
            </ul>
        );
    }
    if (api.error) return <InlineError what={label} onRetry={api.reload} />;
    if (api.data.length === 0) return <Empty title={empty.title}>{empty.text}</Empty>;

    return (
        <div className="flex flex-col gap-3">
            <ul aria-label={label} aria-busy={api.loading || undefined} className={`${frame} transition-opacity duration-300 ease ${api.loading ? "opacity-60" : ""}`}>
                {api.data.map(children)}
            </ul>
            <p className="text-sm text-(--text)/75 tabular-nums">
                {api.data.length >= MAX_RESULTS
                    ? `Showing the newest ${MAX_RESULTS}. Narrow the search to find older ones.`
                    : `${api.data.length} ${api.data.length === 1 ? "result" : "results"}`}
            </p>
        </div>
    );
}

// One clickable row in a ResultList: a leading visual, a title line, a meta
// line, and trailing chips / numbers.
export function ResultRow({ to, lead, title, meta, trail }) {
    return (
        <li>
            <Link
                to={to}
                className={`group flex items-center gap-4 px-5 py-4 text-(--text) transition-colors duration-300 ease hover:bg-white/5 focus-visible:-outline-offset-2 sm:px-6 ${FOCUS}`}
            >
                {lead}
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 font-semibold break-words sm:truncate">{title}</span>
                        <span className="text-sm break-words text-(--text)/80 sm:truncate">{meta}</span>
                    </div>
                    {trail && <div className="flex flex-wrap items-center gap-2 text-sm text-(--text)/85 tabular-nums sm:justify-end">{trail}</div>}
                </div>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-(--text)/60 transition-transform duration-300 ease group-hover:translate-x-0.5" />
            </Link>
        </li>
    );
}

// A small neutral pill; `accent` uses the coral wash for states that need eyes.
export function Tag({ accent = false, children }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap ${
                accent ? "border-(--accent) bg-(--accent)/15 text-(--text)" : "border-white/20 bg-white/5 text-(--text)/85"
            }`}
        >
            {children}
        </span>
    );
}

export function BackLink({ to, children }) {
    return (
        <Link
            to={to}
            className={`-ml-3 inline-flex min-h-11 items-center gap-2 self-start rounded-(--radius) px-3 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
        >
            <ArrowLeft aria-hidden="true" className="size-4.5" />
            {children}
        </Link>
    );
}

// A card section with a heading and an optional action at its far end.
export function Panel({ id, title, action, children }) {
    return (
        <section aria-labelledby={id} className="t-card flex flex-col gap-5 px-5 py-6 text-(--text)! sm:px-8">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
                <h2 id={id} className="text-2xl font-bold text-(--text)">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

// The Title Block's stat ledger as ruled cells. `items` is [label, value][];
// falsy entries are skipped.
export function Facts({ items }) {
    const cells = items.filter(Boolean);
    return (
        // Each cell rules its own left and top edge, pulled 2px out so the first
        // row/column's rules sit under the frame; a short last row leaves card, not grey.
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border-2 border-white/15 bg-(--card) lg:grid-cols-3">
            {cells.map(([label, value]) => (
                <div key={label} className="-mt-0.5 -ml-0.5 flex min-w-0 flex-col-reverse gap-0.5 border-t-2 border-l-2 border-white/15 bg-(--card) px-3.5 py-3 sm:px-4">
                    <dt className="text-sm text-(--text)/75">{label}</dt>
                    <dd className="font-semibold break-words text-(--text) tabular-nums">{value ?? <span className="font-normal text-(--text)/60">None</span>}</dd>
                </div>
            ))}
        </dl>
    );
}

// An id in monospace (it's data) with a copy button.
export function CopyId({ value }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard blocked (insecure origin); the id is still selectable.
        }
    }
    return (
        <span className="inline-flex max-w-full items-center gap-1">
            <code className="truncate font-mono text-[0.8125rem] font-normal text-(--text)/85 select-all">{value}</code>
            <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy id"}
                title={copied ? "Copied" : "Copy id"}
                className={`-my-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-(--text)/75 transition-colors duration-300 ease hover:bg-white/10 hover:text-(--text) ${FOCUS}`}
            >
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            </button>
        </span>
    );
}

// A labelled switch that saves on toggle, like the global settings rows.
export function SwitchRow({ id, label, hint, on, busy, onToggle, error }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-1">
                    <p id={`${id}-label`} className="font-semibold text-(--text)">{label}</p>
                    {hint && <p id={`${id}-hint`} className="max-w-[60ch] text-sm leading-relaxed text-(--text)/85">{hint}</p>}
                </div>
                <Switch on={on} busy={busy} onToggle={onToggle} aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} />
            </div>
            <FormError>{error}</FormError>
        </div>
    );
}

// Rows inside a Panel, ruled apart.
export function Rows({ children }) {
    return <div className="flex flex-col divide-y-2 divide-white/10 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">{children}</div>;
}

// An inline "are you sure?" for actions that are hard to undo or reach
// someone else (ban, delete, archive). Focuses its confirm button on open.
export function ConfirmBox({ id, title, children, confirmLabel, busyLabel, icon: Icon, busy, onConfirm, onCancel }) {
    const confirmRef = useRef(null);
    useEffect(() => { confirmRef.current?.focus(); }, []);

    return (
        <div id={id} role="group" aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-2xl border-2 border-(--accent) bg-(--bg)/45 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1.5">
                <p id={`${id}-title`} className="font-bold text-(--text)">{title}</p>
                {children && <div className="max-w-[65ch] leading-relaxed text-(--text)/90">{children}</div>}
            </div>
            <div className="flex flex-wrap gap-3">
                <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm} className={BTN_PRIMARY}>
                    {Icon && <Icon aria-hidden="true" className="size-4.5" />}
                    {busy ? busyLabel : confirmLabel}
                </button>
                <button type="button" disabled={busy} onClick={onCancel} className={BTN_GHOST}>Cancel</button>
            </div>
        </div>
    );
}

// "Nothing here" for a detail page whose id doesn't exist (a 404).
export function NotFoundNote({ children }) {
    return (
        <p role="status" className="rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-6 leading-relaxed text-(--text)/90 sm:px-7">
            {children}
        </p>
    );
}

// The detail pages' entity title: Phantom, Chalk White, coral redline under
// it, with what kind of record it is above.
export function EntityTitle({ id, kind, children }) {
    return (
        <h2 id={id} className="flex flex-col gap-1 text-(--text) after:mt-2 after:block after:h-1 after:w-14 after:rounded-full after:bg-(--accent) after:content-['']">
            {kind && <span className="text-sm font-medium text-(--text)/75">{kind}</span>}
            <span className="[font-family:var(--heading-font)] text-3xl leading-tight font-bold text-balance break-words">{children}</span>
        </h2>
    );
}
