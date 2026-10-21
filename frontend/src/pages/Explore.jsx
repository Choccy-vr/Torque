import { useCallback } from "react";
import AppShell, { PageHeader } from "../components/AppShell.jsx";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import { Empty, InlineError, Section } from "../components/PageParts.jsx";
import { SearchField } from "../components/admin/AdminParts.jsx";
import { BTN_OUTLINE } from "../components/Form.jsx";
import { getStaffPicks, searchProjects, SEARCH_LIMIT } from "../lib/endpoints.js";
import { useParam } from "../lib/admin.js";
import { useLatest } from "../lib/useApi.js";

const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8";

// A wall of identical drone placeholders says nothing, so a list only gets
// image wells once one of its projects has a cover.
const anyCover = (projects) => projects.some((p) => p.coverImageUrl);

// Explore: search every project, or with no search, browse staff picks. The
// search lives in the URL, so Back returns to the same results. (The
// leaderboard is parked in components/Leaderboard.jsx until it's ready.)
export default function Explore() {
    const [q] = useParam("q");

    return (
        <AppShell title="Explore">
            <PageHeader
                title="Explore"
                lede="Builds from across Torque. If a motor makes it move, it counts."
                action={
                    <div className="w-full sm:w-80 lg:w-96">
                        <SearchField label="Search projects" placeholder="Search projects" />
                    </div>
                }
            />

            <div className="mt-10 flex flex-col gap-12">
                {q ? (
                    <SearchResults q={q} />
                ) : (
                    <StaffPicks />
                )}
            </div>
        </AppShell>
    );
}


function SearchResults({ q }) {
    const [, setQuery] = useParam("q");
    const fetcher = useCallback(() => searchProjects(q), [q]);
    const { data, error, loading, reload } = useLatest(fetcher);
    const count = data?.length ?? 0;

    return (
        <Section id="results" title="Results">
            {error ? (
                <InlineError what="search results" onRetry={reload} />
            ) : !data ? (
                <ul className={GRID} aria-busy="true" aria-label="Loading results">
                    {[0, 1, 2].map((i) => <ProjectCardSkeleton key={i} />)}
                </ul>
            ) : (
                <>
                    {/* With no matches the placeholder below says it, so this is for screen readers only. */}
                    <p role="status" className={`-mt-2 text-(--text)/80 tabular-nums ${count === 0 && !loading ? "sr-only" : ""}`}>
                        {loading
                            ? "Searching…"
                            : count === 0
                                ? `Nothing matches “${q}”.`
                                : count >= SEARCH_LIMIT
                                    ? `Showing the ${SEARCH_LIMIT} best matches for “${q}”. Add a word to narrow it down.`
                                    : `${count} ${count === 1 ? "project matches" : "projects match"} “${q}”.`}
                    </p>
                    {count === 0 ? (
                        !loading && (
                            <Empty
                                title={`Nothing matches “${q}”`}
                                action={<button type="button" onClick={() => setQuery("")} className={BTN_OUTLINE}>Clear search</button>}
                            >
                                Search looks through project titles and descriptions. Try a part or a mechanism, like “stepper”, “servo” or “gimbal”.
                            </Empty>
                        )
                    ) : (
                        <ul className={`${GRID} transition-opacity duration-300 ease ${loading ? "opacity-60" : ""}`} aria-busy={loading || undefined}>
                            {data.map((p) => <ProjectCard key={p.id} project={p} titleAs="h3" image={anyCover(data)} level byline />)}
                        </ul>
                    )}
                </>
            )}
        </Section>
    );
}

function StaffPicks() {
    const { data: picks, error, loading, reload } = useLatest(getStaffPicks);

    return (
        <Section id="staff-picks" title="Staff picks" count={picks?.length}>
            {loading ? (
                <ul className={GRID} aria-busy="true" aria-label="Loading staff picks">
                    {[0, 1, 2].map((i) => <ProjectCardSkeleton key={i} />)}
                </ul>
            ) : error ? (
                <InlineError what="staff picks" onRetry={reload} />
            ) : picks.length === 0 ? (
                <Empty title="No staff picks yet">
                    Standout builds picked by the Torque team will be featured here. Journal well and ship something that moves.
                </Empty>
            ) : (
                <ul className={GRID}>
                    {picks.map((p) => <ProjectCard key={p.id} project={p} titleAs="h3" image={anyCover(picks)} level byline />)}
                </ul>
            )}
        </Section>
    );
}
