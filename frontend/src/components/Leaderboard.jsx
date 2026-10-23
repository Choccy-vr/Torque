import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import { Empty, InlineError, Section } from "./PageParts.jsx";
import { BTN_OUTLINE, FOCUS } from "./Form.jsx";
import { getLeaderboard } from "../lib/endpoints.js";
import { useParam } from "../lib/admin.js";
import { formatHours } from "../lib/projects.js";
import { useLatest } from "../lib/useApi.js";
import { CoverImage } from "./EmptyImage.jsx";

// The Explore leaderboard, kept off the page until it's ready to launch. To
// bring it back, render <Leaderboard /> under <StaffPicks /> in pages/Explore.jsx.
// The ranking lives in the URL (?board=volts), so Back returns to it.

const anyCover = (projects) => projects.some((p) => p.coverImageUrl);

const BOARDS = [
    { key: "hours", label: "Hours", icon: Clock },
    { key: "volts", label: "Volts", icon: Zap },
];
const FIRST_ROWS = 10;

// Top approved projects, ranked by hours tracked or Volts earned.
export default function Leaderboard() {
    const [param, setParam] = useParam("board");
    const board = param === "volts" ? "volts" : "hours";
    const fetcher = useCallback(() => getLeaderboard(board), [board]);
    const { data, error, loading, reload } = useLatest(fetcher);
    const [showAll, setShowAll] = useState(false);
    const rows = data && (showAll ? data : data.slice(0, FIRST_ROWS));
    const thumbs = Boolean(data && anyCover(data));

    return (
        <Section
            id="leaderboard"
            title="Leaderboard"
            action={
                <div role="group" aria-label="Rank by" className="flex gap-1 rounded-(--radius) border-2 border-white/15 bg-(--bg)/40 p-1">
                    {BOARDS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={board === key}
                            onClick={() => setParam(key === "hours" ? "" : key)}
                            className={`inline-flex min-h-10 items-center gap-2 rounded-(--radius) border-2 px-4 font-semibold text-(--text) transition-all duration-300 ease ${FOCUS} ${
                                board === key ? "border-(--accent) bg-(--accent)/15" : "border-transparent hover:bg-white/10"
                            }`}
                        >
                            <Icon aria-hidden="true" className={`size-4 ${key === "volts" ? "text-(--accent)" : ""}`} />
                            {label}
                        </button>
                    ))}
                </div>
            }
        >
            {error ? (
                <InlineError what="the leaderboard" onRetry={reload} />
            ) : !data ? (
                <LeaderboardSkeleton />
            ) : data.length === 0 ? (
                <Empty title="No one on the board yet">
                    Projects join the leaderboard once a ship gets approved. The first spot is wide open.
                </Empty>
            ) : (
                <div className="flex flex-col items-start gap-4">
                    <ol
                        aria-label={`Top projects by ${board}`}
                        aria-busy={loading || undefined}
                        className={`t-card w-full divide-y-2 divide-white/10 overflow-hidden text-(--text)! transition-opacity duration-300 ease ${loading ? "opacity-60" : ""}`}
                    >
                        {rows.map((p, i) => <LeaderboardRow key={p.id} project={p} rank={i + 1} board={board} thumbs={thumbs} />)}
                    </ol>
                    {data.length > FIRST_ROWS && (
                        <button type="button" onClick={() => setShowAll((v) => !v)} className={BTN_OUTLINE}>
                            {showAll ? `Show top ${FIRST_ROWS}` : `Show all ${data.length}`}
                        </button>
                    )}
                </div>
            )}
        </Section>
    );
}

// The podium (top three) reads in coral; it's large bold type, so it passes.
function LeaderboardRow({ project, rank, board, thumbs }) {
    return (
        <li>
            <Link
                to={`/projects/${project.id}`}
                className={`group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] ${thumbs ? "sm:grid-cols-[2.25rem_auto_minmax(0,1fr)_auto]" : ""} items-center gap-3 px-4 py-3 transition-colors duration-300 ease hover:bg-white/5 focus-visible:-outline-offset-2 sm:gap-4 sm:px-6 ${FOCUS}`}
            >
                <span className={`text-center [font-family:var(--heading-font)] text-2xl font-bold tabular-nums ${rank <= 3 ? "text-(--accent)" : "text-(--text)/75"}`}>
                    <span className="sr-only">Rank </span>{rank}
                </span>
                {thumbs && <Thumb src={project.coverImageUrl} />}
                <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{project.title}</span>
                    {project.ownerUsername && <span className="truncate text-sm text-(--text)/80">by {project.ownerUsername}</span>}
                </span>
                <span className="flex items-center gap-1.5 text-right font-semibold whitespace-nowrap tabular-nums">
                    {board === "volts" ? (
                        <>
                            <Zap aria-hidden="true" className="size-4 text-(--accent)" />
                            {(project.voltsGranted ?? 0).toLocaleString()} Volts
                        </>
                    ) : (
                        formatHours(Math.round((project.totalHoursRaw ?? 0) * 10) / 10)
                    )}
                </span>
            </Link>
        </li>
    );
}

// A small cover tile; an empty dashed frame on a drawing plate when there's no
// cover. Phones skip it so titles get the width.
function Thumb({ src }) {
    return (
        <CoverImage
            src={src}
            className="hidden size-12 shrink-0 rounded-[0.625rem] border-2 border-white/10 sm:block"
            imgClassName="transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.06]"
            frame={null}
        />
    );
}

function LeaderboardSkeleton() {
    return (
        <ol aria-busy="true" aria-label="Loading the leaderboard" className="t-card divide-y-2 divide-white/10 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-3 sm:px-6">
                    <div className="h-7 w-7 rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="size-11 rounded-[0.625rem] bg-white/10 motion-safe:animate-pulse sm:size-12" />
                    <div className="flex flex-1 flex-col gap-2">
                        <div className="h-5 w-48 max-w-full rounded bg-white/10 motion-safe:animate-pulse" />
                        <div className="h-4 w-24 rounded bg-white/10 motion-safe:animate-pulse" />
                    </div>
                    <div className="h-5 w-20 rounded bg-white/10 motion-safe:animate-pulse" />
                </li>
            ))}
        </ol>
    );
}
