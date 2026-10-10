import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, RotateCw, X } from "lucide-react";
import AppShell, { PageTitle } from "../components/AppShell.jsx";
import Markdown from "../components/Markdown.jsx";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import { getAnnouncements, getMyProjects, getStaffPicks } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";

// Scrolls sideways when the cards don't fit. Bleeds to the panel's inner edges
// (negative margin + matching padding) so cards scroll edge to edge, and is
// focusable so the row can be scrolled with arrow keys.
const ROW = "t-scroll -mx-5 flex snap-x gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-(--text) sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12";
const MESSAGE = "flex grow flex-col items-center justify-center gap-3 text-center text-(--text)";

export default function Home() {
    const { data: projects, error, loading, reload } = useApi(getMyProjects);
    const hasProjects = projects?.length > 0;

    // Newest first; ISO timestamps sort correctly as strings.
    const sorted = hasProjects
        ? [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [];

    return (
        <AppShell title="Dashboard">
            <PageTitle>Dashboard</PageTitle>

            <section
                aria-labelledby="your-projects"
                className="t-card relative mt-6 flex min-h-72 flex-col gap-3 px-5 py-6 sm:px-8 md:mt-8 md:min-h-84 lg:px-12"
            >
                <div className="flex min-h-11 items-center justify-between gap-4">
                    <h2 id="your-projects" className="text-2xl font-bold text-(--text)">Your projects</h2>
                    {hasProjects && (
                        <Link
                            to="/projects"
                            className="group -mr-3 inline-flex min-h-11 items-center gap-1.5 rounded-(--radius) px-3 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10"
                        >
                            View all
                            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
                        </Link>
                    )}
                </div>

                {loading ? (
                    <ul className={ROW} aria-busy="true" aria-label="Loading projects">
                        {[0, 1, 2, 3, 4].map((i) => <ProjectCardSkeleton key={i} compact />)}
                    </ul>
                ) : error ? (
                    <div role="status" className={MESSAGE}>
                        <p className="text-xl font-bold">Couldn't load your projects</p>
                        <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">
                            Something went wrong talking to the server. Check your connection and try again.
                        </p>
                        <button
                            type="button"
                            onClick={reload}
                            className="t-btn t-hover mt-3 inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-8 text-lg font-bold"
                        >
                            <RotateCw aria-hidden="true" className="size-5" />
                            Try again
                        </button>
                    </div>
                ) : hasProjects ? (
                    <ul tabIndex={0} aria-label="Your projects" className={ROW}>
                        {sorted.map((p) => <ProjectCard key={p.id} project={p} compact />)}
                    </ul>
                ) : (
                    <div className={MESSAGE}>
                        <p className="text-xl font-bold">No projects yet</p>
                        <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">
                            Any hardware project that uses a motor counts. Set up Lapse and Hackatime first, so every hour gets tracked.
                        </p>
                        <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-8 text-lg font-bold"
                            >
                                <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
                                Add project
                            </button>
                            <Link
                                to="/docs/getting-started"
                                className="inline-flex min-h-11 items-center rounded-(--radius) border-2 border-(--accent)/55 px-8 text-lg font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                            >
                                Read the setup guide
                            </Link>
                        </div>
                    </div>
                )}
            </section>

            <Announcements />

            <StaffPicks />
        </AppShell>
    );
}

// News from the Torque team: a sideways row of tiles, newest first, like the
// project rows above and below it. Each tile previews its post and opens it in
// full in a dialog, since a tile is too narrow to read a long post in.
function Announcements() {
    const { data: posts, error, loading, reload } = useApi(getAnnouncements);
    const [reading, setReading] = useState(null);
    const rowRef = useRef(null);
    const edges = useScrollEdges(rowRef, posts);

    const page = (direction) => {
        const row = rowRef.current;
        const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
        row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
    };

    return (
        <Panel
            id="announcements"
            title="Announcements"
            className="mt-6"
            action={(edges.start || edges.end) && (
                <div className="-mr-1 flex gap-2">
                    <PageButton icon={ChevronLeft} label="Newer announcements" disabled={!edges.start} onClick={() => page(-1)} />
                    <PageButton icon={ChevronRight} label="Older announcements" disabled={!edges.end} onClick={() => page(1)} />
                </div>
            )}
        >
            {loading ? (
                <ul className={ROW} aria-busy="true" aria-label="Loading announcements">
                    {[0, 1, 2].map((i) => <AnnouncementCardSkeleton key={i} />)}
                </ul>
            ) : error ? (
                <div role="status" className={MESSAGE}>
                    <p className="text-xl font-bold">Couldn't load announcements</p>
                    <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">
                        Something went wrong talking to the server. Check your connection and try again.
                    </p>
                    <button
                        type="button"
                        onClick={reload}
                        className="t-btn t-hover mt-3 inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-8 text-lg font-bold"
                    >
                        <RotateCw aria-hidden="true" className="size-5" />
                        Try again
                    </button>
                </div>
            ) : posts.length > 0 ? (
                // pt-1 leaves room for a tile's 2px hover lift inside the scroller.
                <ul ref={rowRef} id="announcement-row" tabIndex={0} aria-label="Announcements" className={`${ROW} pt-1`}>
                    {posts.map((post) => <AnnouncementCard key={post.id} post={post} onRead={() => setReading(post)} />)}
                </ul>
            ) : (
                <EmptyState
                    title="Nothing new yet"
                    body="News about Torque, like events, deadlines, and new rewards, will be posted here."
                />
            )}
            {reading && <AnnouncementDialog post={reading} onClose={() => setReading(null)} />}
        </Panel>
    );
}

// Whether a horizontal scroller has more content before ({ start }) and after
// ({ end }) what's in view. Re-checked on scroll, resize and new `content`.
function useScrollEdges(ref, content) {
    const [edges, setEdges] = useState({ start: false, end: false });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            const start = el.scrollLeft > 1;
            const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
            setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
        };
        update();
        el.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, [ref, content]);

    return edges;
}

function PageButton({ icon: Icon, label, disabled, onClick }) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-controls="announcement-row"
            disabled={disabled}
            onClick={onClick}
            className="inline-flex size-11 items-center justify-center rounded-(--radius) border-2 border-(--accent)/55 text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15 disabled:pointer-events-none disabled:border-white/15 disabled:text-(--text)/40"
        >
            <Icon aria-hidden="true" className="size-5" />
        </button>
    );
}

const formatDay = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Same tile as the dashboard's project cards (darker than the panel, softer
// coral edge), but wider so a few lines of a post fit. `relative` keeps the
// sr-only text inside the scroller, so it can't widen the page.
const TILE = "relative w-[min(20rem,calc(100vw-5.5rem))] shrink-0 snap-start rounded-[1.25rem] border-2 border-(--accent)/35 bg-(--bg)/60 sm:w-96";

function PostDate({ post }) {
    const edited = post.updatedAt && formatDay(post.updatedAt) !== formatDay(post.createdAt);
    return (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-(--text)/85 tabular-nums">
            <time dateTime={post.createdAt}>{formatDay(post.createdAt)}</time>
            {edited && (
                <>
                    <span aria-hidden="true" className="text-(--text)/75">·</span>
                    <span className="text-(--text)/75">
                        Edited <time dateTime={post.updatedAt}>{formatDay(post.updatedAt)}</time>
                    </span>
                </>
            )}
        </p>
    );
}

// The whole tile opens the post: "Learn more" stretches an invisible hit area
// over it. The preview is a glimpse, so it holds nothing focusable of its own.
function AnnouncementCard({ post, onRead }) {
    return (
        <li className={`flex flex-col gap-2 px-5 py-4 text-(--text) transition-all duration-300 ease has-[button:hover]:-translate-y-0.5 has-[button:hover]:border-(--accent) has-[button:hover]:shadow-[0_8px_24px_-12px_var(--accent)] motion-reduce:has-[button:hover]:translate-y-0 ${TILE}`}>
            <PostDate post={post} />
            <h3 className="text-lg font-semibold text-pretty break-words line-clamp-2 text-(--heading)">{post.title}</h3>
            <div className="max-h-32 overflow-hidden text-[0.9375rem] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
                <Markdown preview>{post.body}</Markdown>
            </div>
            <button
                type="button"
                onClick={onRead}
                aria-haspopup="dialog"
                className="-ml-3 mt-auto inline-flex min-h-11 items-center self-start rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease after:absolute after:inset-0 after:rounded-[1.125rem] after:content-[''] hover:bg-white/10"
            >
                Learn more<span className="sr-only">: {post.title}</span>
            </button>
        </li>
    );
}

// The full post, in a native modal dialog: Esc closes it, focus stays inside
// while it's open, and closing returns focus to the tile's button. Every way
// out goes through dialog.close() so that focus return always happens.
function AnnouncementDialog({ post, onClose }) {
    const ref = useRef(null);
    const pressedBackdrop = useRef(false);

    // No close() on cleanup: unmounting removes it from the top layer anyway,
    // and a close event from Strict Mode's re-run would dismiss it at once.
    useEffect(() => {
        if (!ref.current.open) ref.current.showModal();
    }, []);

    const close = () => ref.current?.close();

    return (
        <dialog
            ref={ref}
            aria-labelledby="announcement-dialog-title"
            onClose={onClose}
            // Clicks on the backdrop land on the dialog element itself. Only a
            // press that starts there too counts, so a text selection dragged
            // out of the post doesn't close it.
            onPointerDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && close()}
            className="t-card t-scroll m-auto max-h-[min(85vh,48rem)] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-0 text-(--text) backdrop:bg-black/60"
        >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-(--card) py-2 pr-2 pl-5 sm:pr-4 sm:pl-8">
                <PostDate post={post} />
                <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius) text-(--text) transition-all duration-300 ease hover:bg-white/10"
                >
                    <X aria-hidden="true" className="size-5" />
                </button>
            </div>
            <div className="flex flex-col gap-3 px-5 pb-6 sm:px-8 sm:pb-8">
                <h2 id="announcement-dialog-title" className="text-2xl font-bold text-pretty break-words text-(--heading)">
                    {post.title}
                </h2>
                <Markdown>{post.body}</Markdown>
            </div>
        </dialog>
    );
}

function AnnouncementCardSkeleton() {
    return (
        <li aria-hidden="true" className={`flex flex-col gap-3 px-5 py-4 ${TILE}`}>
            <div className="h-4 w-28 rounded bg-white/10 motion-safe:animate-pulse" />
            <div className="h-6 w-3/4 rounded-lg bg-white/10 motion-safe:animate-pulse" />
            <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
            <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-white/10 motion-safe:animate-pulse" />
        </li>
    );
}

// Standout projects picked by the Torque team, in the same scrolling row as
// your projects. They're other people's, so review status is drawn neutral.
function StaffPicks() {
    const { data: picks, error, loading, reload } = useApi(getStaffPicks);

    return (
        <Panel id="staff-picks" title="Staff picks" className="mt-6">
            {loading ? (
                <ul className={ROW} aria-busy="true" aria-label="Loading staff picks">
                    {[0, 1, 2, 3, 4].map((i) => <ProjectCardSkeleton key={i} compact />)}
                </ul>
            ) : error ? (
                <div role="status" className={MESSAGE}>
                    <p className="text-xl font-bold">Couldn't load staff picks</p>
                    <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">
                        Something went wrong talking to the server. Check your connection and try again.
                    </p>
                    <button
                        type="button"
                        onClick={reload}
                        className="t-btn t-hover mt-3 inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-8 text-lg font-bold"
                    >
                        <RotateCw aria-hidden="true" className="size-5" />
                        Try again
                    </button>
                </div>
            ) : picks.length > 0 ? (
                <ul tabIndex={0} aria-label="Staff picks" className={ROW}>
                    {picks.map((p) => <ProjectCard key={p.id} project={p} compact quietStatus />)}
                </ul>
            ) : (
                <EmptyState
                    title="No staff picks yet"
                    body="Standout projects picked by the Torque team will be featured here."
                />
            )}
        </Panel>
    );
}

// A titled dashboard panel, padded like the projects panel so every heading
// lines up on the same left edge.
// `action` sits at the right end of the heading row.
function Panel({ id, title, action, className = "", children }) {
    return (
        <section
            aria-labelledby={id}
            className={`t-card flex min-h-56 flex-col gap-3 px-5 py-6 sm:px-8 lg:px-12 ${className}`}
        >
            <div className="flex min-h-11 items-center justify-between gap-4">
                <h2 id={id} className="text-2xl font-bold text-(--text)">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

function EmptyState({ title, body }) {
    return (
        <div className={MESSAGE}>
            <p className="text-xl font-bold text-(--text)">{title}</p>
            <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">{body}</p>
        </div>
    );
}
