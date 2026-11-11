import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowUpRight, Check, Clapperboard, FileText, FolderGit2, Globe, RotateCcw, Send, Sparkles, Star, Trash2, TrendingDown, TrendingUp,
} from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import {
    BackLink, ConfirmBox, CopyId, EntityTitle, Facts, NotFoundNote, Panel, ResultList, Rows, SwitchRow, Tag,
} from "../../components/admin/AdminParts.jsx";
import { useAction } from "../../lib/admin.js";
import { InlineError } from "../../components/PageParts.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, FieldError, FOCUS, FormError, INPUT } from "../../components/Form.jsx";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import Cover from "../../components/project/Cover.jsx";
import {
    getAdminProject, getProjectTimelapses, searchAdminShips, setProjectFundingRate, setStaffPick, updateAdminProject,
} from "../../lib/endpoints.js";
import {
    ADMIN_PROJECT_STATUS, formatDay, formatHours, formatRate, formatWhen, GRANT_RATE_DEFAULT, GRANT_RATE_MAX, isSet,
} from "../../lib/projects.js";
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
                        {p.isArchived && <Tag><Trash2 aria-hidden="true" className="size-3.5" />Deleted{p.archivedAt && ` ${formatDay(p.archivedAt)}`}</Tag>}
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
    const remove = useAction();
    const [confirmingDelete, setConfirmingDelete] = useState(false);
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
                <FundingRate project={p} onSaved={onSaved} />
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
                        id="deleted"
                        label="Deleted"
                        hint={inReview && !p.isArchived
                            ? "Can't delete while it's in review."
                            : p.isArchived
                                ? "Off the owner's dashboard and profile, and locked. Switch off to restore it."
                                : "Takes it off the owner's dashboard, projects and profile, and locks it: no edits, journal entries or ships."}
                        on={p.isArchived}
                        busy={remove.busy || (inReview && !p.isArchived)}
                        onToggle={() => (p.isArchived
                            ? remove.run(async () => onSaved(await updateAdminProject(p.id, { isArchived: false })))
                            : setConfirmingDelete((c) => !c))}
                        error={remove.error}
                    />
                    {confirmingDelete && !p.isArchived && (
                        <ConfirmBox
                            id="delete-confirm"
                            title={`Delete ${p.title}?`}
                            confirmLabel="Delete it"
                            busyLabel="Deleting…"
                            icon={Trash2}
                            busy={remove.busy}
                            onConfirm={async () => { if (await remove.run(async () => onSaved(await updateAdminProject(p.id, { isArchived: true })))) setConfirmingDelete(false); }}
                            onCancel={() => setConfirmingDelete(false)}
                        >
                            {p.streak > 0 ? `Its ${p.streak}-day streak resets to 0, and that can't be undone. ` : ""}Only an admin can restore it; the owner can't.
                        </ConfirmBox>
                    )}
                </div>
            </Rows>
        </Panel>
    );
}

// The project's grant rate: the most a design ship can ask for per hour.
// Boosting opens an inline form; raising the rate DMs the owner (the backend
// sends it), lowering or resetting doesn't. Reset asks first.
function FundingRate({ project: p, onSaved }) {
    const inputId = useId();
    const [open, setOpen] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [value, setValue] = useState("");
    const save = useAction();
    const reset = useAction();
    // What the last save did, so the admin knows whether a DM went out.
    const [done, setDone] = useState(null);
    // Closing the form or the reset box unmounts whatever had focus; hand it back
    // to the Boost button so keyboard users keep their place.
    const triggerRef = useRef(null);
    const refocus = useRef(false);
    useEffect(() => {
        if (!open && !confirmingReset && refocus.current) {
            refocus.current = false;
            triggerRef.current?.focus();
        }
    }, [open, confirmingReset]);
    const current = p.grantDollarsPerHour ?? GRANT_RATE_DEFAULT;
    const owner = p.ownerUsername || "the owner";
    const Owner = p.ownerUsername || "The owner"; // at the start of a sentence

    const n = Number(value);
    const problem = value === "" ? null
        : !Number.isFinite(n) || n <= GRANT_RATE_DEFAULT ? `It has to be more than ${formatRate(GRANT_RATE_DEFAULT)}/hr.`
            : n > GRANT_RATE_MAX ? `${formatRate(GRANT_RATE_MAX)}/hr is the most it can go.`
                : Math.abs(Math.round(n * 100) - n * 100) > 1e-6 ? "Use whole cents at most."
                    : n === current ? "That's already its rate."
                        : null;
    const valid = value !== "" && !problem;
    const raising = valid && n > current;
    // Same estimate the ship form uses: journaled hours no approved ship has credited.
    const unpaid = Math.max(0, (p.totalHours ?? 0) - (p.totalHoursApproved ?? 0));

    function close() {
        refocus.current = true;
        setOpen(false);
        setValue("");
        save.setError(null);
    }

    async function submit(e) {
        e.preventDefault();
        if (!valid) return;
        if (await save.run(async () => onSaved(await setProjectFundingRate(p.id, n)))) {
            close();
            setDone(raising
                ? `Boosted to ${formatRate(n)}/hr. A Slack DM is on its way to ${owner}.`
                : `Lowered to ${formatRate(n)}/hr. ${Owner} wasn't DMed.`);
        }
    }

    return (
        <div role="group" aria-labelledby="funding-label" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <p id="funding-label" className="flex flex-wrap items-center gap-2 font-semibold">
                        Grant rate
                        {p.fundingBoosted && <Tag accent><TrendingUp aria-hidden="true" className="size-3.5" />Boosted</Tag>}
                    </p>
                    <p className="max-w-[60ch] text-sm leading-relaxed text-(--text)/85">
                        <b className="font-bold text-(--text) tabular-nums">{formatRate(current)} per design hour</b>
                        {p.fundingBoosted ? `, up from the usual ${formatRate(GRANT_RATE_DEFAULT)}.` : ", the default."}
                        {" "}Caps what a design ship can ask for.
                    </p>
                </div>
                {!open && !confirmingReset && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            ref={triggerRef}
                            type="button"
                            disabled={p.isArchived}
                            onClick={() => { setOpen(true); setDone(null); }}
                            aria-describedby={p.isArchived ? "funding-archived" : undefined}
                            className={BTN_OUTLINE}
                        >
                            <TrendingUp aria-hidden="true" className="size-4.5" />
                            {p.fundingBoosted ? "Change rate" : "Boost funding"}
                        </button>
                        {p.fundingBoosted && (
                            <button type="button" disabled={p.isArchived} onClick={() => { setConfirmingReset(true); setDone(null); }} className={BTN_GHOST}>
                                <RotateCcw aria-hidden="true" className="size-4.5" />
                                Reset to {formatRate(GRANT_RATE_DEFAULT)}
                            </button>
                        )}
                    </div>
                )}
            </div>
            {p.isArchived && <p id="funding-archived" className="text-sm text-(--text)/80">Restore the project to change its rate.</p>}
            {/* Always mounted so screen readers catch the update; takes no gap while empty. */}
            <div role="status" className="empty:-mt-3">
                {done && (
                    <p className="flex items-start gap-2 text-sm leading-relaxed font-medium text-(--text)">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
                        {done}
                    </p>
                )}
            </div>

            {open && (
                // noValidate: the browser's step maths would flag valid cents; validation is ours.
                <form
                    noValidate
                    onSubmit={submit}
                    onKeyDown={(e) => { if (e.key === "Escape" && !save.busy) close(); }}
                    aria-label="Boost funding"
                    className="flex flex-col gap-3 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-4 sm:px-5"
                >
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={inputId} className="text-sm text-(--text)/85">New rate per design hour</label>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-40">
                                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-(--text)/85">$</span>
                                <input
                                    id={inputId}
                                    autoFocus
                                    type="number"
                                    inputMode="decimal"
                                    min={GRANT_RATE_DEFAULT}
                                    max={GRANT_RATE_MAX}
                                    step={1}
                                    placeholder="10"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    aria-invalid={problem ? true : undefined}
                                    aria-describedby={`${inputId}-note`}
                                    className={`${INPUT} pr-12 pl-8 tabular-nums`}
                                />
                                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-(--text)/75">/hr</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="submit" disabled={save.busy || !valid} className={BTN_PRIMARY}>
                                    {valid && !raising
                                        ? <TrendingDown aria-hidden="true" className="size-4.5" />
                                        : <TrendingUp aria-hidden="true" className="size-4.5" />}
                                    {save.busy ? "Saving…" : valid ? `${raising ? "Boost" : "Lower"} to ${formatRate(n)}/hr` : "Boost"}
                                </button>
                                <button type="button" disabled={save.busy} onClick={close} className={BTN_GHOST}>Cancel</button>
                            </div>
                        </div>
                    </div>
                    <div id={`${inputId}-note`}>
                        {problem ? (
                            <FieldError>{problem}</FieldError>
                        ) : (
                            <p className="flex items-start gap-2 text-sm leading-relaxed text-(--text)/85">
                                <Send aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
                                <span>
                                    {valid && !raising
                                        ? `Lowering it doesn't DM ${owner}.`
                                        : `${Owner} gets a Slack DM saying their funding was boosted.`}
                                    {valid && unpaid >= 1 && (
                                        <> The {formatHours(Math.round(unpaid * 10) / 10)} not paid for yet could ask for up to{" "}
                                            <b className="font-bold text-(--text) tabular-nums">${Math.floor(unpaid * n).toLocaleString()}</b>.</>
                                    )}
                                </span>
                            </p>
                        )}
                    </div>
                    <FormError>{save.error}</FormError>
                </form>
            )}

            {confirmingReset && (
                <ConfirmBox
                    id="funding-reset-confirm"
                    title={`Reset ${p.title} to ${formatRate(GRANT_RATE_DEFAULT)}/hr?`}
                    confirmLabel="Reset it"
                    busyLabel="Resetting…"
                    icon={RotateCcw}
                    busy={reset.busy}
                    onConfirm={async () => {
                        if (await reset.run(async () => onSaved(await setProjectFundingRate(p.id, null)))) {
                            refocus.current = true;
                            setConfirmingReset(false);
                            setDone(`Reset to ${formatRate(GRANT_RATE_DEFAULT)}/hr.`);
                        }
                    }}
                    onCancel={() => { refocus.current = true; setConfirmingReset(false); reset.setError(null); }}
                >
                    Design ships approved from now on, including one already in review, are capped at {formatRate(GRANT_RATE_DEFAULT)} per hour again. {Owner} won't get a DM.
                </ConfirmBox>
            )}
            <FormError>{reset.error}</FormError>
        </div>
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
export function Timelapses({ projectId, linked }) {
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
