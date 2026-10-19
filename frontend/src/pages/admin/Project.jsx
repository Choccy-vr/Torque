import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArrowUpRight, Clapperboard, FileText, FolderGit2, Globe, Sparkles, Star } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import {
    BackLink, ConfirmBox, CopyId, EntityTitle, Facts, NotFoundNote, Panel, ResultList, Rows, SwitchRow, Tag,
} from "../../components/admin/AdminParts.jsx";
import { useAction } from "../../lib/admin.js";
import { InlineError } from "../../components/PageParts.jsx";
import { BTN_OUTLINE, FOCUS, FormError } from "../../components/Form.jsx";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import Cover from "../../components/project/Cover.jsx";
import {
    getAdminProject, getProjectTimelapses, searchAdminShips, setStaffPick, updateAdminProject,
} from "../../lib/endpoints.js";
import { ADMIN_PROJECT_STATUS, formatDay, formatWhen, isSet } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";
import { ShipRow } from "./Ships.jsx";

const hours = (h) => `${Number((h ?? 0).toFixed(1))}h`;
const GRANT = { None: "None", Pending: "Waiting to be sent", Fulfilled: "Sent" };
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

const LINKS = [
    { key: "repoUrl", label: "Repository", icon: FolderGit2 },
    { key: "demoUrl", label: "Demo", icon: Globe },
    { key: "readmeUrl", label: "Readme", icon: FileText },
];

// /admin/projects/:id — one project with its private numbers, the admin
// overrides, its ships and the owner's timelapses.
export default function AdminProject() {
    const { id } = useParams();
    return (
        <AdminShell title="Project">
            <ProjectDetail key={id} id={id} />
        </AdminShell>
    );
}

function ProjectDetail({ id }) {
    const fetchProject = useCallback(() => getAdminProject(id), [id]);
    const api = useApi(fetchProject);
    const [saved, setSaved] = useState(null);
    const project = saved ?? api.data;

    if (api.error) {
        return (
            <div className="flex flex-col gap-4">
                <BackLink to="/admin/projects">Projects</BackLink>
                {api.error.status === 404
                    ? <NotFoundNote>No project with this id. It may have been deleted.</NotFoundNote>
                    : <InlineError what="this project" onRetry={api.reload} />}
            </div>
        );
    }
    if (!project) return <div aria-busy="true" aria-label="Loading project" className="t-card h-96 motion-safe:animate-pulse text-(--text)!" />;

    return (
        <div className="flex flex-col gap-6">
            <BackLink to="/admin/projects">Projects</BackLink>
            <Sheet project={project} />
            <Overrides project={project} onSaved={setSaved} />
            <ProjectShips projectId={project.id} />
            <Timelapses projectId={project.id} linked={project.hackatimeProjectNames?.length > 0} />
        </div>
    );
}

function Sheet({ project: p }) {
    const links = LINKS.filter(({ key }) => p[key]);
    return (
        <article aria-labelledby="project-title" className="t-card overflow-hidden text-(--text)!">
            <Cover project={p} />
            <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <ProjectStatusBadge status={p.status} statuses={ADMIN_PROJECT_STATUS} />
                        <Tag>Level {p.tier}</Tag>
                        {p.isStaffPick && <Tag><Star aria-hidden="true" className="size-3.5" />Staff pick</Tag>}
                        {p.exceptional && <Tag><Sparkles aria-hidden="true" className="size-3.5" />Exceptional</Tag>}
                        {p.isArchived && <Tag><Archive aria-hidden="true" className="size-3.5" />Archived{p.archivedAt && ` ${formatDay(p.archivedAt)}`}</Tag>}
                    </div>
                    <EntityTitle id="project-title">{p.title}</EntityTitle>
                    <p className="text-(--text)/85">
                        By{" "}
                        <Link to={`/admin/users/${p.ownerUserId}`} className={`font-medium text-(--text) underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-colors duration-300 ease hover:decoration-(--accent) ${FOCUS}`}>
                            {p.ownerUsername || "unknown owner"}
                        </Link>
                        {" · "}started {formatDay(p.createdAt)}
                    </p>
                    {p.description && <p className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{p.description}</p>}
                </div>

                <ul className="flex flex-wrap gap-3">
                    <li>
                        <Link to={`/projects/${p.id}`} className={BTN_OUTLINE}>
                            Public page
                            <ArrowUpRight aria-hidden="true" className="size-4 opacity-80" />
                        </Link>
                    </li>
                    {links.map(({ key, label, icon: Icon }) => (
                        <li key={key}>
                            <a href={p[key]} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
                                <Icon aria-hidden="true" className="size-4.5" />
                                {label}
                                <ArrowUpRight aria-hidden="true" className="size-4 opacity-80" />
                                <span className="sr-only">(opens in a new tab)</span>
                            </a>
                        </li>
                    ))}
                </ul>

                {p.aiUse && (
                    <div className="flex flex-col gap-1 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 sm:px-5">
                        <p className="flex items-center gap-2 text-sm font-bold"><Sparkles aria-hidden="true" className="size-4" />How AI was used</p>
                        <p className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{p.aiUse}</p>
                    </div>
                )}

                <Facts
                    items={[
                        ["Hours tracked", hours(p.totalHours)],
                        ["Hours approved", hours(p.totalHoursApproved)],
                        ["Design / build hours", `${hours(p.trackedDesignHours)} / ${hours(p.trackedBuildHours)}`],
                        ["Volts granted", p.voltsGranted.toLocaleString()],
                        ["Grant", GRANT[p.grantStatus] ?? p.grantStatus],
                        ["Journal entries", p.journalCount],
                        ["Streak", `${p.streak} / ${p.maxStreak} days`],
                        ["Last streak day", p.lastStreakDate ? formatDay(p.lastStreakDate) : null],
                        ["Uses streak freezes", p.streakFreezesPaused ? "No (paused)" : "Yes"],
                        ["Hackatime projects", p.hackatimeProjectNames?.length ? p.hackatimeProjectNames.join(", ") : null],
                        p.claimedByReviewer !== EMPTY_GUID && ["Claimed by", <><Link to={`/admin/users/${p.claimedByReviewer}`} className={`underline decoration-(--accent)/55 decoration-2 underline-offset-4 hover:decoration-(--accent) ${FOCUS}`}>{p.claimedByUsername || "a reviewer"}</Link>{isSet(p.claimedAt) && <span className="font-normal text-(--text)/75"> · {formatWhen(p.claimedAt)}</span>}</>],
                        ["Project id", <CopyId value={p.id} />],
                    ]}
                />
            </div>
        </article>
    );
}

function Overrides({ project: p, onSaved }) {
    const level = useAction();
    const pick = useAction();
    const exceptional = useAction();
    const archive = useAction();
    const [confirmingArchive, setConfirmingArchive] = useState(false);
    const inReview = ["Unreviewed", "Claimed", "Fraud_Pending"].includes(p.status);

    return (
        <Panel id="overrides" title="Overrides">
            <Rows>
                <div role="group" aria-labelledby="level-label" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <p id="level-label" className="font-semibold">Level</p>
                        <p className="max-w-[60ch] text-sm leading-relaxed text-(--text)/85">
                            Sets the Volts rate. Owners can't change it after a final approval; you can.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4].map((tier) => (
                            <button
                                key={tier}
                                type="button"
                                aria-pressed={p.tier === tier}
                                disabled={level.busy}
                                onClick={() => p.tier !== tier && level.run(async () => onSaved(await updateAdminProject(p.id, { tier })))}
                                className={`inline-flex min-h-11 min-w-24 items-center justify-center rounded-(--radius) border-2 px-5 font-bold transition-all duration-300 ease disabled:cursor-wait ${FOCUS} ${
                                    p.tier === tier
                                        ? "border-(--accent) bg-(--accent) text-(--btn-text)"
                                        : "border-(--accent)/55 text-(--text) hover:border-(--accent) hover:bg-(--accent)/15"
                                }`}
                            >
                                Level {tier}
                            </button>
                        ))}
                    </div>
                    <FormError>{level.error}</FormError>
                </div>
                <SwitchRow
                    id="staff-pick"
                    label="Staff pick"
                    hint="Featured on everyone's dashboard."
                    on={p.isStaffPick}
                    busy={pick.busy}
                    onToggle={() => pick.run(async () => {
                        await setStaffPick(p.id, !p.isStaffPick);
                        onSaved({ ...p, isStaffPick: !p.isStaffPick });
                    })}
                    error={pick.error}
                />
                <SwitchRow
                    id="exceptional"
                    label="Exceptional"
                    hint="Marks a standout build, shown as a chip on the project."
                    on={p.exceptional}
                    busy={exceptional.busy}
                    onToggle={() => exceptional.run(async () => onSaved(await updateAdminProject(p.id, { exceptional: !p.exceptional })))}
                    error={exceptional.error}
                />
                <div className="flex flex-col gap-3">
                    <SwitchRow
                        id="archived"
                        label="Archived"
                        hint={inReview && !p.isArchived
                            ? "Can't archive while it's in review."
                            : "Hidden from search and locked: no edits, journal entries or ships."}
                        on={p.isArchived}
                        busy={archive.busy || (inReview && !p.isArchived)}
                        onToggle={() => (p.isArchived
                            ? archive.run(async () => onSaved(await updateAdminProject(p.id, { isArchived: false })))
                            : setConfirmingArchive((c) => !c))}
                        error={archive.error}
                    />
                    {confirmingArchive && !p.isArchived && (
                        <ConfirmBox
                            id="archive-confirm"
                            title={`Archive ${p.title}?`}
                            confirmLabel="Archive it"
                            busyLabel="Archiving…"
                            icon={Archive}
                            busy={archive.busy}
                            onConfirm={async () => { if (await archive.run(async () => onSaved(await updateAdminProject(p.id, { isArchived: true })))) setConfirmingArchive(false); }}
                            onCancel={() => setConfirmingArchive(false)}
                        >
                            {p.streak > 0 ? `Its ${p.streak}-day streak resets to 0, and that can't be undone.` : "The owner can unarchive it themselves."}
                        </ConfirmBox>
                    )}
                </div>
            </Rows>
        </Panel>
    );
}

function ProjectShips({ projectId }) {
    const fetchShips = useCallback(() => searchAdminShips({ projectId }), [projectId]);
    const ships = useApi(fetchShips);
    return (
        <Panel id="ships" title="Ships">
            <ResultList flat api={ships} label="this project's ships" empty={{ title: "Not shipped yet", text: "Its ships will show up here, newest first." }}>
                {(s) => <ShipRow key={s.id} ship={s} showProject={false} />}
            </ResultList>
        </Panel>
    );
}

// Lapse is a slow outside call, so it only runs when asked.
function Timelapses({ projectId, linked }) {
    const [state, setState] = useState({ status: "idle", items: [], error: null });

    async function load() {
        setState({ status: "loading", items: [], error: null });
        try {
            const { timelapses } = await getProjectTimelapses(projectId);
            setState({ status: "done", items: timelapses, error: null });
        } catch (err) {
            setState({ status: "error", items: [], error: err });
        }
    }

    return (
        <Panel
            id="timelapses"
            title="Timelapses"
            action={state.status !== "loading" && (
                <button type="button" onClick={load} className={BTN_OUTLINE}>
                    <Clapperboard aria-hidden="true" className="size-4.5" />
                    {state.status === "idle" ? "Load from Lapse" : "Reload"}
                </button>
            )}
        >
            {state.status === "idle" ? (
                <p className="max-w-[65ch] leading-relaxed text-(--text)/85">
                    {linked
                        ? "The owner's Lapse recordings for this project's linked Hackatime projects."
                        : "This project has no Hackatime projects linked, so Lapse has nothing to match."}
                </p>
            ) : state.status === "loading" ? (
                <div aria-busy="true" aria-label="Loading timelapses" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => <div key={i} className="aspect-video rounded-xl bg-white/10 motion-safe:animate-pulse" />)}
                </div>
            ) : state.status === "error" ? (
                <InlineError what="timelapses from Lapse" onRetry={load} />
            ) : state.items.length === 0 ? (
                <p className="text-(--text)/85">No timelapses found for this project.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 sm:grid-cols-3">
                    {state.items.map((t) => (
                        <li key={t.id}>
                            <a
                                href={t.playbackUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`group flex flex-col gap-2 rounded-xl text-(--text) ${FOCUS}`}
                            >
                                {t.thumbnailUrl ? (
                                    <img src={t.thumbnailUrl} alt="" className="aspect-video w-full rounded-xl border-2 border-white/15 object-cover transition-all duration-300 ease group-hover:-translate-y-0.5 group-hover:border-(--accent) motion-reduce:group-hover:translate-y-0" />
                                ) : (
                                    <span aria-hidden="true" className="t-plate aspect-video w-full rounded-xl border-2 border-dashed border-white/20" />
                                )}
                                <span className="truncate text-sm font-medium">{t.name || "Untitled"}</span>
                                <span className="-mt-1.5 text-sm text-(--text)/75 tabular-nums">
                                    {[t.duration && `${Math.round(t.duration / 60)} min`, t.hackatimeProject].filter(Boolean).join(" · ")}
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
