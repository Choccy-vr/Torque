import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, FolderOpen } from "lucide-react";
import { formatDay, formatHours } from "../lib/projects.js";
import { imagesIn } from "../lib/forms.js";
import Markdown from "./Markdown.jsx";

// The Redline Timeline: dated entries hung on a coral rule, newest first.
// Shared by the profile's journal and a project's timeline.

const PAGE = 5;

// Shows a page of `items` at a time so a long log doesn't bury the page.
// `renderItem` returns a <TimelineItem>; `footer` sits under the list once
// every item is shown (e.g. "Showing the latest 30").
export function PagedTimeline({ items, renderItem, page = PAGE, footer, origin }) {
    const [shown, setShown] = useState(page);
    const remaining = items.length - shown;

    return (
        <div className="flex flex-col gap-6">
            <ol className="flex flex-col gap-8 border-l-2 border-(--accent)/55 pl-(--pad) [--pad:1.25rem] sm:[--pad:1.75rem]">
                {items.slice(0, shown).map(renderItem)}
                {remaining <= 0 && origin}
            </ol>
            {remaining > 0 && (
                <button
                    type="button"
                    onClick={() => setShown((n) => n + page)}
                    className="inline-flex min-h-11 items-center self-start rounded-(--radius) border-2 border-(--accent)/55 px-6 font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                >
                    Show {Math.min(remaining, page)} older {remaining === 1 ? "entry" : "entries"}
                </button>
            )}
            {remaining <= 0 && footer}
        </div>
    );
}

// One stop on the redline: a dot on the 2px rule (cut out of it by a ring of
// page colour) with the date beside it, then whatever hangs below. `hollow`
// draws an open ring instead, for the origin point ("Project started").
export function TimelineItem({ date, label, hollow = false, children }) {
    return (
        <li className="relative flex flex-col gap-2.5">
            <span
                aria-hidden="true"
                className={`absolute top-[0.1875rem] left-[calc(-1*var(--pad)-8px)] size-3.5 rounded-full ring-4 ring-(--bg) ${
                    hollow ? "border-2 border-(--accent) bg-(--bg)" : "bg-(--accent)"
                }`}
            />
            <p className="text-sm leading-5 font-medium text-(--text)/85 tabular-nums">
                {label && <>{label} · </>}
                <time dateTime={date}>{formatDay(date)}</time>
            </p>
            {children}
        </li>
    );
}

// Long text collapses behind a toggle; ~360 characters is roughly where
// five lines of a card's measure run out.
const LONG_TEXT = 360;

// The collapsed text: as many whole paragraphs as fit in LONG_TEXT, so the
// cut lands on a real paragraph end. Null when even the first paragraph is
// too long, in which case it's clamped with an ellipsis instead.
function excerptOf(text) {
    const [first, ...rest] = text.split(/\n\s*\n/);
    if (first.length > LONG_TEXT) return null;
    let out = first;
    for (const para of rest) {
        if (out.length + 2 + para.length > LONG_TEXT) break;
        out += `\n\n${para}`;
    }
    return out;
}

export function ExpandableText({ id, text, className = "" }) {
    const [open, setOpen] = useState(false);
    const body = text.trim();
    const long = body.length > LONG_TEXT;
    const excerpt = long ? excerptOf(body) : null;

    return (
        <>
            <p
                id={id}
                className={`max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90 ${long && !open && !excerpt ? "line-clamp-5" : ""} ${className}`}
            >
                {long && !open && excerpt ? excerpt : body}
            </p>
            {long && (
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpen((o) => !o)}
                    className="-ml-3 inline-flex min-h-11 items-center self-start rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10"
                >
                    {open ? "Show less" : "Read more"}
                </button>
            )}
        </>
    );
}

// Collapsed journal bodies show about this much before "Read more" (28rem):
// enough for a paragraph and a photo.
const COLLAPSED_PX = 448;

// A markdown body that folds behind "Read more" when it renders taller than
// COLLAPSED_PX. Measured, not counted, since photos sit inline.
export function ExpandableMarkdown({ id, text }) {
    const [open, setOpen] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        // Re-measure as photos load and the width changes.
        const observer = new ResizeObserver(() => setOverflows(el.offsetHeight > COLLAPSED_PX + 16));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const clipped = overflows && !open;

    return (
        <>
            <div
                id={id}
                // A link in the folded-away part can still take keyboard focus; open up so it's visible.
                onFocus={() => clipped && setOpen(true)}
                style={clipped ? { maxHeight: COLLAPSED_PX } : undefined}
                className={clipped ? "overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" : ""}
            >
                <div ref={contentRef}>
                    <Markdown>{text}</Markdown>
                </div>
            </div>
            {overflows && (
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpen((o) => !o)}
                    className="-ml-3 inline-flex min-h-11 items-center self-start rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10"
                >
                    {open ? "Show less" : "Read more"}
                </button>
            )}
        </>
    );
}

// A journal entry, its body rendered as markdown. `project` ({ id, title }) adds a foot linking to the
// project it's from (the profile, which mixes projects); `hours` adds the
// Hackatime time it logged (the project page).
export function JournalEntry({ entry, project, hours = false }) {
    // Photos now sit inline in the markdown; older entries kept them in a
    // separate list, so show whichever of those the body doesn't already have.
    const inBody = new Set(imagesIn(entry.text));
    const images = (entry.imageUrls ?? []).filter((src) => !inBody.has(src));
    const showHours = hours && entry.trackedHours > 0;

    return (
        <TimelineItem date={entry.createdAt}>
            <article className="t-card flex flex-col gap-2 px-5 py-5 text-(--text) sm:px-7 sm:py-6">
                <h3 className="text-xl font-semibold text-balance break-words text-(--text)">{entry.title}</h3>
                <ExpandableMarkdown id={`entry-${entry.id}`} text={entry.text} />
                {images.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {images.slice(0, 6).map((src, i) => (
                            <li key={src}>
                                <a
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block overflow-hidden rounded-xl border-2 border-white/15 transition-all duration-300 ease hover:-translate-y-0.5 hover:border-(--accent) motion-reduce:hover:translate-y-0"
                                >
                                    <img
                                        src={src}
                                        alt={`Photo ${i + 1} from “${entry.title}”`}
                                        loading="lazy"
                                        className="aspect-[4/3] w-full bg-(--bg) object-cover"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
                {(project || showHours) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-(--text)/80 tabular-nums">
                        {showHours && (
                            <p className="flex items-center gap-1.5">
                                <Clock aria-hidden="true" className="size-4 shrink-0" />
                                {formatHours(Math.round(entry.trackedHours * 10) / 10)} logged
                            </p>
                        )}
                        {project && (
                            <p className="flex items-center gap-1.5">
                                <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
                                <span className="sr-only">Project:</span>
                                <Link
                                    to={`/projects/${project.id}`}
                                    className="rounded-sm underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 hover:decoration-(--accent)"
                                >
                                    {project.title}
                                </Link>
                            </p>
                        )}
                    </div>
                )}
            </article>
        </TimelineItem>
    );
}

export function JournalSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading journal" className="flex flex-col gap-6 border-l-2 border-(--accent)/30 pl-5 sm:pl-7">
            {[0, 1].map((i) => (
                <div key={i} className="t-card flex flex-col gap-3 px-5 py-6 sm:px-7">
                    <div className="h-4 w-40 rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-6 w-2/3 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-5/6 rounded bg-white/10 motion-safe:animate-pulse" />
                </div>
            ))}
        </div>
    );
}
