import { Link } from "react-router-dom";
import { ArrowRight, Plus, RotateCw } from "lucide-react";
import AppShell, { PageTitle } from "../components/AppShell.jsx";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import { getMyProjects } from "../lib/endpoints.js";
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

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel id="announcements" title="Announcements">
                    <EmptyState
                        title="Nothing new yet"
                        body="News about Torque, like events, deadlines, and new rewards, will be posted here."
                    />
                </Panel>

                <Panel id="your-ships" title="Your ships">
                    <EmptyState
                        title="Nothing shipped yet"
                        body="When you ship a project for review, you can follow its status here."
                    />
                </Panel>
            </div>

            <Panel id="staff-picks" title="Staff picks" className="mt-6">
                <EmptyState
                    title="No staff picks yet"
                    body="Standout projects picked by the Torque team will be featured here."
                />
            </Panel>
        </AppShell>
    );
}

// A titled dashboard panel, padded like the projects panel so every heading
// lines up on the same left edge.
function Panel({ id, title, className = "", children }) {
    return (
        <section
            aria-labelledby={id}
            className={`t-card flex min-h-56 flex-col gap-3 px-5 py-6 sm:px-8 lg:px-12 ${className}`}
        >
            <div className="flex min-h-11 items-center">
                <h2 id={id} className="text-2xl font-bold text-(--text)">{title}</h2>
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
