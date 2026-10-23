import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    Archive, ArchiveRestore, ArrowUpRight, ChevronDown, CircleAlert, CirclePause, Clock, FileText, Flame, FolderGit2,
    Globe, NotebookPen, Pencil, Plus, Ship, Sparkles, Star, Zap,
} from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import ProjectStatusBadge from "../components/ProjectStatusBadge.jsx";
import { ExpandableText, JournalEntry, JournalSkeleton, PagedTimeline, TimelineItem } from "../components/Journal.jsx";
import { Empty, InlineError, Notice, PauseNotices, RetryButton, Section } from "../components/PageParts.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, FOCUS, FormError } from "../components/Form.jsx";
import { errorText } from "../lib/forms.js";
import ProjectEditForm from "../components/project/ProjectEditForm.jsx";
import Cover from "../components/project/Cover.jsx";
import CoverPicker from "../components/project/CoverPicker.jsx";
import ShipForm from "../components/project/ShipForm.jsx";
import JournalComposer from "../components/project/JournalComposer.jsx";
import Switch from "../components/Switch.jsx";
import {
    getDevlogs, getMyProfile, getMyProjects, getMyShips, getProject, getUserProfile, setProjectArchived, setStreakFreezesPaused, updateProject,
} from "../lib/endpoints.js";
import { SHIP_STATUS, formatDay } from "../lib/projects.js";
import { useApi } from "../lib/useApi.js";
import { useAuth } from "../lib/useAuth.js";
import { PAUSE, pausedMessage, useSettings } from "../lib/settings.js";
import { Avatar } from "../components/EmptyImage.jsx";

// /projects/:id — one project, for anyone. Its owner also gets their private
// numbers (Volts, streak freezes, Hackatime links), their ships,
// and the tools to edit, ship, journal and archive it in place.
export default function Project() {
    const { id } = useParams();
    return <ProjectView key={id} projectId={id} />;
}

const IN_REVIEW = ["Unreviewed", "Claimed", "Fraud_Pending"];
// The devlog batch endpoint takes at most 30 ids.
const JOURNAL_BATCH = 30;

const formatNumber = (n) => (Number.isInteger(n) ? n : Number(n.toFixed(1))).toLocaleString();
const roundHours = (h) => Math.round((h ?? 0) * 10) / 10;

function ProjectView({ projectId }) {
    const { session } = useAuth();
    const signedIn = Boolean(session);

    const fetchProject = useCallback(() => getProject(projectId), [projectId]);
    // Only to tell whether you own this project; a failure just means "visitor".
    const fetchMe = useCallback(() => (signedIn ? getMyProfile().catch(() => null) : Promise.resolve(null)), [signedIn]);

    const project = useApi(fetchProject);
    const me = useApi(fetchMe);

    if (project.error) return <ProjectError error={project.error} onRetry={project.reload} />;
    if (!project.data || me.loading) return <ProjectSkeleton />;

    const isOwner = Boolean(me.data) && me.data.id === project.data.ownerUserId;
    return <ProjectPage projectApi={project} isOwner={isOwner} />;
}

function ProjectPage({ projectApi, isOwner }) {
    const pub = projectApi.data;

    const fetchMine = useCallback(() => (isOwner ? getMyProjects() : Promise.resolve(null)), [isOwner]);
    const fetchShips = useCallback(() => (isOwner ? getMyShips() : Promise.resolve(null)), [isOwner]);
    const fetchOwner = useCallback(() => getUserProfile(pub.ownerUserId), [pub.ownerUserId]);
    // devlogIds are oldest first; the newest batch is the end of the list.
    const idsKey = (pub.devlogIds ?? []).slice(-JOURNAL_BATCH).join(",");
    const fetchDevlogs = useCallback(() => (idsKey ? getDevlogs(idsKey.split(",")) : Promise.resolve([])), [idsKey]);

    const mine = useApi(fetchMine);
    const ships = useApi(fetchShips);
    const settings = useSettings();
    const owner = useApi(fetchOwner);
    const devlogs = useApi(fetchDevlogs);

    const [panel, setPanel] = useState(null); // null | "edit" | "ship" | "journal"

    // The public view is the base; the owner's private copy adds its fields.
    // (Picked by name: the private DTO doesn't carry staff pick / exceptional.)
    const priv = mine.data?.find((p) => p.id === pub.id);
    const project = {
        ...pub,
        ...(priv && {
            totalHoursApproved: priv.totalHoursApproved,
            voltsGranted: priv.voltsGranted,
            hackatimeProjectNames: priv.hackatimeProjectNames,
            streakFreezesPaused: priv.streakFreezesPaused,
        }),
    };
    const projectShips = (ships.data ?? []).filter((s) => s.projectId === pub.id);

    // Data reloads keep whatever panel is open, so a toggle doesn't eat a draft.
    const reloadData = () => {
        projectApi.reload();
        mine.reload();
        ships.reload();
    };
    const closeAndRefresh = () => {
        setPanel(null);
        reloadData();
    };
    // Cancel hands focus back to the button that opened the panel.
    const closePanel = () => {
        const opened = panel;
        setPanel(null);
        requestAnimationFrame(() => document.querySelector(`[data-opens="${opened}"]`)?.focus());
    };

    const archived = project.isArchived;
    const inReview = IN_REVIEW.includes(project.status);
    const designApproved = projectShips.some((s) => !s.isBuildComplete && s.status === "approved");
    // A ship needs an hour of journaled time no approved ship has credited yet
    // (the server has the exact figure; this mirrors it).
    const unpaidHours = Math.max(0, roundHours((project.totalHours ?? 0) - (project.totalHoursApproved ?? 0)));
    const hoursNeeded = Math.ceil((1 - unpaidHours) * 10) / 10;
    // Admin switches (lib/settings.js). Resubmitting after "changes needed"
    // can be paused on its own while first ships keep going.
    const shipPauseKey = pausedMessage(settings, PAUSE.ships) || project.status !== "Changes_Needed" ? PAUSE.ships : PAUSE.resubmissions;
    const shipPaused = pausedMessage(settings, shipPauseKey);
    const journalPaused = pausedMessage(settings, PAUSE.journaling);
    const shippable = !archived && !inReview && project.status !== "Perm_Rejected";
    const blocked = {
        ship: archived ? "Unarchive this project to ship it."
            : inReview ? "In review. You can ship again once a reviewer has looked at it."
            : project.status === "Perm_Rejected" ? "Permanently rejected, so it can't be shipped again."
            : shipPaused ? shipPaused
            : !priv ? "Checking your hours…"
            : unpaidHours < 1 ? `Journal ${hoursNeeded}h more to ship.`
            : null,
        edit: archived ? "Unarchive to edit." : inReview ? "Can't edit while it's in review." : null,
        archive: inReview ? "Can't archive while it's in review." : null,
        journal: archived ? "Unarchive this project to journal on it." : journalPaused,
    };
    // Paused switches the owner would otherwise run into on this project.
    const pauseKeys = isOwner && !archived ? [...(shippable ? [shipPauseKey] : []), PAUSE.journaling] : [];
    // The grant a design ship asked for lands on that ship: the newest
    // final-approved design ship that requested funding.
    const grantShipId = project.grantStatus !== "None"
        ? projectShips.find((s) => !s.isBuildComplete && s.requestedFunding > 0 && s.finalApprovedAt)?.id
        : null;

    const [archiveError, setArchiveError] = useState(null);
    async function setArchived(next) {
        setArchiveError(null);
        try {
            await setProjectArchived(project.id, next);
            closeAndRefresh();
        } catch (err) {
            setArchiveError(errorText(err));
        }
    }

    // The cover is set from the band at the top of the card, not the edit form.
    async function setCover(coverImageUrl) {
        await updateProject(project.id, { coverImageUrl });
        reloadData();
    }

    return (
        <AppShell title={project.title}>
            <div className="mx-auto flex max-w-4xl flex-col gap-12">
                <div className="flex flex-col gap-6">
                    {panel === "edit" ? (
                        <ProjectEditForm project={project} onSaved={closeAndRefresh} onCancel={closePanel} />
                    ) : (
                        <ProjectCard
                            project={project}
                            owner={owner.data}
                            isOwner={isOwner}
                            blocked={blocked}
                            panel={panel}
                            onPanel={setPanel}
                            onArchive={setArchived}
                            archiveError={archiveError}
                            onStreakChanged={reloadData}
                            onCoverChange={setCover}
                        />
                    )}

                    {panel === "ship" && (
                        <ShipForm
                            project={project}
                            designApproved={designApproved}
                            onEdit={() => setPanel("edit")}
                            onShipped={closeAndRefresh}
                            onCancel={closePanel}
                        />
                    )}

                    {/* Hidden while a form is open, so its action doesn't compete with the form's. */}
                    {(panel === null || panel === "journal") && (
                        <div className="flex flex-col gap-3 empty:hidden">
                            <StatusNotice
                                project={project}
                                isOwner={isOwner}
                                owner={owner.data}
                                latestShip={projectShips[0]}
                                canJournal={!blocked.journal}
                                onCompose={() => setPanel("journal")}
                                onUnarchive={() => setArchived(false)}
                                hoursNeeded={priv && unpaidHours < 1 ? hoursNeeded : 0}
                            />
                            <PauseNotices keys={pauseKeys} />
                        </div>
                    )}
                </div>

                <TimelineSection
                    project={project}
                    owner={owner.data}
                    isOwner={isOwner}
                    devlogs={devlogs}
                    ships={projectShips}
                    grantShipId={grantShipId}
                    composing={panel === "journal"}
                    journalBlocked={blocked.journal}
                    onCompose={() => setPanel("journal")}
                    onPosted={() => {
                        closeAndRefresh();
                        requestAnimationFrame(() => document.querySelector('[data-opens="journal"]')?.focus());
                    }}
                    onCancel={closePanel}
                    onEdit={blocked.edit ? null : () => setPanel("edit")}
                />
            </div>
        </AppShell>
    );
}

// ---------------------------------------------------------------- the card

function ProjectCard({ project, owner, isOwner, blocked, panel, onPanel, onArchive, archiveError, onStreakChanged, onCoverChange }) {
    const [confirmingArchive, setConfirmingArchive] = useState(false);

    return (
        <article aria-labelledby="project-title" className="t-card overflow-hidden text-(--text)">
            {isOwner && !blocked.edit
                ? <CoverPicker value={project.coverImageUrl ?? ""} onChange={onCoverChange} title={project.title} emptyText="No cover image" />
                : <Cover project={project} />}

            <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Chips project={project} />
                        {isOwner && (
                            <OwnerTools
                                project={project}
                                blocked={blocked}
                                panel={panel}
                                onPanel={onPanel}
                                confirmingArchive={confirmingArchive}
                                onArchive={() => setConfirmingArchive((c) => !c)}
                                onUnarchive={() => onArchive(false)}
                            />
                        )}
                    </div>
                    {confirmingArchive && !project.isArchived && (
                        <ArchiveConfirm
                            project={project}
                            onConfirm={() => onArchive(true)}
                            onCancel={() => {
                                setConfirmingArchive(false);
                                requestAnimationFrame(() => document.querySelector('[data-opens="archive"]')?.focus());
                            }}
                        />
                    )}
                    <h1
                        id="project-title"
                        className="[font-family:var(--heading-font)] text-3xl leading-tight font-bold text-balance break-words text-(--text) after:mt-3 after:block after:h-1 after:w-14 after:rounded-full after:bg-(--accent) after:content-[''] sm:text-4xl"
                    >
                        {project.title}
                    </h1>
                    {project.description ? (
                        <div className="flex flex-col gap-1">
                            <ExpandableText id="project-description" text={project.description} className="text-lg" />
                        </div>
                    ) : (
                        <p className="text-(--text)/80">{isOwner ? "No description yet. Add one with the edit button." : "No description yet."}</p>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <Byline project={project} owner={owner} />
                    <Stats project={project} isOwner={isOwner} onStreakChanged={onStreakChanged} />
                </div>

                <ProjectLinks project={project} isOwner={isOwner} onAdd={isOwner && !blocked.edit ? () => onPanel("edit") : null} />

                {project.aiUse && (
                    <div className="flex flex-col gap-1 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 sm:px-5">
                        <p className="flex items-center gap-2 text-sm font-bold text-(--text)">
                            <Sparkles aria-hidden="true" className="size-4 shrink-0" />
                            How AI was used
                        </p>
                        <p className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{project.aiUse}</p>
                    </div>
                )}

                <FormError>{archiveError}</FormError>
            </div>
        </article>
    );
}

// Ship, then edit and archive as icon buttons, at the top right of the card.
// A blocked control stays focusable and says why in its tooltip.
function OwnerTools({ project, blocked, panel, confirmingArchive, onPanel, onArchive, onUnarchive }) {
    const shipOpen = panel === "ship";

    return (
        <div className="flex items-center gap-2">
            <Tip text={blocked.ship} align="start">
                {(tip) => (
                    <button
                        type="button"
                        data-opens="ship"
                        aria-disabled={blocked.ship ? true : undefined}
                        aria-describedby={tip}
                        aria-expanded={shipOpen}
                        aria-controls={shipOpen ? "ship-form" : undefined}
                        onClick={blocked.ship ? undefined : () => onPanel(shipOpen ? null : "ship")}
                        className={`${BTN_PRIMARY} px-5 aria-disabled:cursor-not-allowed aria-disabled:border-white/15 aria-disabled:bg-white/10 aria-disabled:text-(--text)/75`}
                    >
                        <Ship aria-hidden="true" className="size-4.5" />
                        Ship
                    </button>
                )}
            </Tip>
            <IconButton icon={Pencil} label="Edit project" reason={blocked.edit} data-opens="edit" onClick={() => onPanel("edit")} />
            {project.isArchived ? (
                <IconButton icon={ArchiveRestore} label="Unarchive project" onClick={onUnarchive} />
            ) : (
                <IconButton
                    icon={Archive}
                    label="Archive project"
                    reason={blocked.archive}
                    data-opens="archive"
                    aria-expanded={confirmingArchive}
                    aria-controls={confirmingArchive ? "archive-confirm-panel" : undefined}
                    onClick={onArchive}
                />
            )}
        </div>
    );
}

// A small label that shows under its control on hover or keyboard focus.
// `children` gets the tooltip's id (or undefined when there's no text).
function Tip({ text, align = "end", children }) {
    const id = useId();
    if (!text) return children(undefined);
    return (
        <span className="group/tip relative inline-flex">
            {children(id)}
            <span
                id={id}
                role="tooltip"
                className={`pointer-events-none absolute top-full z-20 mt-2 w-max max-w-60 rounded-xl border-2 border-(--accent)/55 bg-(--card) px-3 py-1.5 text-sm leading-snug text-(--text) opacity-0 transition-opacity duration-200 ease group-hover/tip:opacity-100 group-has-focus-visible/tip:opacity-100 ${
                    align === "start" ? "left-0 sm:right-0 sm:left-auto" : "right-0"
                }`}
            >
                {text}
            </span>
        </span>
    );
}

// A 44px round icon button with its name as a tooltip; `reason` blocks it
// (still focusable) and the tooltip says why instead.
function IconButton({ icon: Icon, label, reason, onClick, ...rest }) {
    return (
        <Tip text={reason ?? label}>
            {(tip) => (
                <button
                    type="button"
                    aria-label={label}
                    aria-disabled={reason ? true : undefined}
                    aria-describedby={reason ? tip : undefined}
                    onClick={reason ? undefined : onClick}
                    className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-(--accent)/55 text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15 aria-disabled:cursor-not-allowed aria-disabled:border-white/15 aria-disabled:text-(--text)/75 aria-disabled:hover:bg-transparent aria-expanded:border-(--accent) aria-expanded:bg-(--accent)/15 ${FOCUS}`}
                    {...rest}
                >
                    <Icon aria-hidden="true" className="size-4.5" />
                </button>
            )}
        </Tip>
    );
}

function ArchiveConfirm({ project, onConfirm, onCancel }) {
    const [busy, setBusy] = useState(false);
    const confirmRef = useRef(null);
    const streakDays = project.streak ?? 0;

    useEffect(() => { confirmRef.current?.focus(); }, []);

    return (
        <div
            id="archive-confirm-panel"
            role="group"
            aria-labelledby="archive-confirm"
            className="flex flex-col gap-4 rounded-2xl border-2 border-(--accent)/55 bg-(--bg)/45 px-4 py-4 sm:px-5"
        >
            <p id="archive-confirm" className="max-w-[65ch] leading-relaxed text-(--text)">
                <strong className="font-bold">Archive {project.title}?</strong>{" "}
                It'll be hidden from search and locked (no edits, journal entries or ships) until you unarchive it.
                {streakDays > 0 && ` Its ${streakDays}-day streak resets to 0.`}
            </p>
            <div className="flex flex-wrap gap-3">
                <button
                    ref={confirmRef}
                    type="button"
                    disabled={busy}
                    onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
                    className={BTN_OUTLINE}
                >
                    <Archive aria-hidden="true" className="size-4.5" />
                    {busy ? "Archiving…" : "Archive project"}
                </button>
                <button type="button" disabled={busy} onClick={onCancel} className={BTN_GHOST}>
                    Keep it
                </button>
            </div>
        </div>
    );
}

function Chip({ icon: Icon, accent = false, children }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap text-(--text)/85">
            {Icon && <Icon aria-hidden="true" className={`size-3.5 ${accent ? "text-(--accent)" : ""}`} />}
            {children}
        </span>
    );
}

const GRANT_LABEL = { Pending: "on its way", Fulfilled: "sent" };

// Level and honours. Review status and grants live on the ship cards.
function Chips({ project }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Chip>Level {project.tier}</Chip>
            {project.isStaffPick && <Chip icon={Star} accent>Staff pick</Chip>}
            {project.exceptional && <Chip icon={Sparkles} accent>Exceptional</Chip>}
            {project.isArchived && <Chip icon={Archive}>Archived</Chip>}
        </div>
    );
}

function Byline({ project, owner }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-(--text)/85">
            {owner ? (
                <Link
                    to={`/profile/${project.ownerUserId}`}
                    className={`group inline-flex min-h-11 items-center gap-2.5 rounded-xl pr-2 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    <Avatar src={owner.profilePictureUrl} className="size-9 rounded-[0.625rem] border-(--accent)" />
                    <span className="underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-colors duration-300 ease group-hover:decoration-(--accent)">
                        {owner.username}
                    </span>
                </Link>
            ) : (
                <span aria-hidden="true" className="h-9 w-36 rounded-xl bg-white/10 motion-safe:animate-pulse" />
            )}
            <span aria-hidden="true" className="text-(--text)/50">·</span>
            <span className="text-sm tabular-nums">
                Started <time dateTime={project.createdAt}>{formatDay(project.createdAt)}</time>
            </span>
            {project.isArchived && project.archivedAt && (
                <>
                    <span aria-hidden="true" className="text-(--text)/50">·</span>
                    <span className="text-sm tabular-nums">
                        Archived <time dateTime={project.archivedAt}>{formatDay(project.archivedAt)}</time>
                    </span>
                </>
            )}
        </div>
    );
}

// The project's numbers as one line under the byline, the way a drawing's
// title block reads. Owners also see their Volts, and their streak opens to
// its multiplier and freeze setting.
// Why missed days aren't counting right now, if an admin paused streaks
// (journaling being paused pauses them too). Null otherwise.
function useStreakPause() {
    const settings = useSettings();
    return pausedMessage(settings, PAUSE.streaks)
        ?? (pausedMessage(settings, PAUSE.journaling) && "Streaks are paused while journaling is, so a missed day won't break your streak.");
}

function Stats({ project, isOwner, onStreakChanged }) {
    const [streakOpen, setStreakOpen] = useState(false);
    const streakPaused = Boolean(useStreakPause());
    const hours = roundHours(project.totalHours);
    const journals = project.devlogIds?.length ?? 0;
    const days = project.streak ?? 0;

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-(--text)/85 tabular-nums sm:gap-x-5">
                <StatItem icon={Clock}>
                    <b className="font-bold text-(--text)">{formatNumber(hours)}</b> {hours === 1 ? "hour" : "hours"}
                </StatItem>
                <StatItem icon={NotebookPen}>
                    <b className="font-bold text-(--text)">{journals}</b> {journals === 1 ? "journal entry" : "journal entries"}
                </StatItem>
                {isOwner ? (
                    <li>
                        <button
                            type="button"
                            aria-expanded={streakOpen}
                            aria-controls="streak-details"
                            onClick={() => setStreakOpen((o) => !o)}
                            className={`-mx-2 -my-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                        >
                            <Flame aria-hidden="true" className="size-4.5 shrink-0" />
                            {days > 0
                                ? <span><b className="font-bold text-(--text)">{days}-day</b> streak</span>
                                : <span>No streak yet</span>}
                            {streakPaused && <span className="text-(--text)/75">· paused</span>}
                            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform duration-300 ease ${streakOpen ? "rotate-180" : ""}`} />
                        </button>
                    </li>
                ) : days > 0 && (
                    <StatItem icon={Flame}>
                        <b className="font-bold text-(--text)">{days}-day</b> streak
                    </StatItem>
                )}
                {isOwner && project.voltsGranted > 0 && (
                    <StatItem icon={Zap} accent title="Only you can see this">
                        <b className="font-bold text-(--text)">{project.voltsGranted.toLocaleString()}</b> Volts earned
                        <span className="sr-only"> (only you can see this)</span>
                    </StatItem>
                )}
            </ul>
            {isOwner && streakOpen && <StreakDetails id="streak-details" project={project} onChanged={onStreakChanged} />}
        </div>
    );
}

function StatItem({ icon: Icon, accent = false, title, children }) {
    return (
        <li title={title} className="flex items-center gap-1.5">
            <Icon aria-hidden="true" className={`size-4.5 shrink-0 ${accent ? "text-(--accent)" : ""}`} />
            <span>{children}</span>
        </li>
    );
}

// What the streak is worth, and whether a missed day spends one of the
// owner's freezes here. Saves on toggle, and works even while in review.
function StreakDetails({ id, project, onChanged }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const on = !project.streakFreezesPaused;
    const multiplier = (1 + 0.01 * (project.streak ?? 0)).toFixed(2);
    const paused = useStreakPause();

    async function toggle() {
        setSaving(true);
        setError(null);
        try {
            await setStreakFreezesPaused(project.id, on);
            onChanged();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div id={id} className="flex flex-col gap-4 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-4 sm:px-5">
            {paused && (
                <div className="border-b-2 border-white/10 pb-4">
                    <p className="flex max-w-[65ch] items-start gap-2.5 leading-relaxed text-(--text)">
                        <CirclePause aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--text)/85" />
                        {paused}
                    </p>
                </div>
            )}
            <p className="max-w-[65ch] leading-relaxed text-(--text)/90">
                <b className="font-bold text-(--text) tabular-nums">×{multiplier}</b> Volts multiplier. Each day with an hour or more
                journaled adds 0.01×, up to {project.maxStreak} days at Level {project.tier}.
            </p>
            <div className="flex items-start justify-between gap-5 border-t-2 border-white/10 pt-4">
                <div className="flex flex-col gap-1">
                    <p id="freeze-label" className="font-semibold text-(--text)">Use streak freezes on this project</p>
                    <p id="freeze-hint" className="max-w-[60ch] text-sm leading-relaxed text-(--text)/85">
                        {on
                            ? "A missed day spends one of your freezes instead of resetting this streak."
                            : "A missed day resets this streak, saving your freezes for your other projects."}
                    </p>
                </div>
                <Switch on={on} busy={saving} onToggle={toggle} aria-labelledby="freeze-label" aria-describedby="freeze-hint" />
            </div>
            <FormError>{error}</FormError>
        </div>
    );
}

const LINKS = [
    { key: "repoUrl", label: "Repository", icon: FolderGit2 },
    { key: "demoUrl", label: "Demo", icon: Globe },
    { key: "readmeUrl", label: "Readme", icon: FileText },
];

// Repo, demo, readme as auto-width pills. For visitors the repo is the
// page's one coral action and missing links aren't shown; the owner (whose
// coral action is Ship) gets one dashed "Add" for whatever's missing.
function ProjectLinks({ project, isOwner, onAdd }) {
    const present = LINKS.filter(({ key }) => project[key]);
    const missing = isOwner && onAdd ? LINKS.filter(({ key }) => !project[key]) : [];
    if (present.length === 0 && missing.length === 0) return null;

    const names = missing.map(({ label }) => label.toLowerCase());
    const addLabel = `Add ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)} links` : `a ${names[0]} link`}`;

    return (
        <ul className="flex flex-wrap gap-3">
            {present.map(({ key, label, icon: Icon }) => (
                <li key={key}>
                    <a
                        href={project[key]}
                        target="_blank"
                        rel="noreferrer"
                        className={!isOwner && key === "repoUrl" ? BTN_PRIMARY : BTN_OUTLINE}
                    >
                        <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                        {label}
                        <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-80" />
                        <span className="sr-only">(opens in a new tab)</span>
                    </a>
                </li>
            ))}
            {missing.length > 0 && (
                <li>
                    <button
                        type="button"
                        onClick={onAdd}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-dashed border-white/25 px-5 font-medium text-(--text)/85 transition-all duration-300 ease hover:border-white/45 hover:bg-white/10 hover:text-(--text) ${FOCUS}`}
                    >
                        <Plus aria-hidden="true" className="size-4.5 shrink-0" />
                        {addLabel}
                    </button>
                </li>
            )}
        </ul>
    );
}

// ---------------------------------------------------------------- notices

const TEXT_ACTION = `-my-2 inline-flex min-h-11 shrink-0 items-center rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`;

// One slim line about where the project stands, when that's worth saying:
// archived (for everyone), and for the owner the state of their latest ship.
// The reviewer's feedback itself lives on the ship card in the timeline.
function StatusNotice({ project, isOwner, owner, latestShip, canJournal, onCompose, onUnarchive, hoursNeeded }) {
    if (project.isArchived) {
        return (
            <Notice
                icon={Archive}
                action={isOwner && <button type="button" onClick={onUnarchive} className={TEXT_ACTION}>Unarchive</button>}
            >
                <b className="font-bold text-(--text)">Archived.</b>{" "}
                {isOwner
                    ? "Hidden from search and locked until you unarchive it."
                    : `${owner?.username ?? "Its builder"} archived it${project.archivedAt ? ` on ${formatDay(project.archivedAt)}` : ""}.`}
            </Notice>
        );
    }
    if (!isOwner) return null;

    if (project.status === "Changes_Needed") {
        return (
            <Notice
                icon={CircleAlert}
                attention
                action={canJournal && <button type="button" onClick={onCompose} className={TEXT_ACTION}>Journal your fixes</button>}
            >
                <b className="font-bold text-(--text)">Changes needed.</b> The reviewer's feedback is on your ship below.
                {hoursNeeded > 0 && <> Journal <b className="font-bold text-(--text) tabular-nums">{hoursNeeded}h</b> more to ship again.</>}
            </Notice>
        );
    }
    if (IN_REVIEW.includes(project.status)) {
        return (
            <Notice icon={Ship}>
                <b className="font-bold text-(--text)">In review</b>
                {latestShip && <> since {formatDay(latestShip.createdAt)}</>}. You can keep journaling while you wait.
            </Notice>
        );
    }
    if (project.status === "Perm_Rejected") {
        return (
            <Notice icon={CircleAlert}>
                <b className="font-bold text-(--text)">Permanently rejected.</b> The reviewer's feedback is on your ship below.
            </Notice>
        );
    }
    if (hoursNeeded > 0) {
        return (
            <Notice
                icon={Clock}
                action={canJournal && <button type="button" onClick={onCompose} className={TEXT_ACTION}>New entry</button>}
            >
                Journal <b className="font-bold text-(--text) tabular-nums">{hoursNeeded}h</b> more to ship. Ships need an hour of time no approved ship has covered yet.
            </Notice>
        );
    }
    return null;
}

// ---------------------------------------------------------------- timeline

function TimelineSection({ project, owner, isOwner, devlogs, ships, grantShipId, composing, journalBlocked, onCompose, onPosted, onCancel, onEdit }) {
    const total = project.devlogIds?.length ?? 0;
    const entries = [...(devlogs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = [
        ...entries.map((entry) => ({ kind: "entry", at: entry.createdAt, entry })),
        ...ships.map((ship) => ({ kind: "ship", at: ship.createdAt, ship })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const capped = total > entries.length && !devlogs.loading;

    const action = isOwner && !composing && (
        <Tip text={journalBlocked}>
            {(tip) => (
                <button
                    type="button"
                    data-opens="journal"
                    aria-disabled={journalBlocked ? true : undefined}
                    aria-describedby={tip}
                    onClick={journalBlocked ? undefined : onCompose}
                    className={`${BTN_OUTLINE} aria-disabled:cursor-not-allowed aria-disabled:border-white/15 aria-disabled:bg-transparent aria-disabled:text-(--text)/75 aria-disabled:hover:border-white/15 aria-disabled:hover:bg-transparent`}
                >
                    <NotebookPen aria-hidden="true" className="size-4.5" />
                    New entry
                </button>
            )}
        </Tip>
    );

    return (
        <Section id="timeline" title="Timeline" count={total + ships.length} action={action}>
            {composing && <JournalComposer project={project} onPosted={onPosted} onCancel={onCancel} onEdit={onEdit} />}

            {devlogs.loading && !devlogs.data ? (
                <JournalSkeleton />
            ) : devlogs.error ? (
                <InlineError what="the journal" onRetry={devlogs.reload} />
            ) : items.length === 0 ? (
                composing ? null : (
                    <Empty
                        title="No journal entries yet"
                        action={isOwner && !journalBlocked && (
                            <button type="button" onClick={onCompose} className={BTN_PRIMARY}>
                                <NotebookPen aria-hidden="true" className="size-4.5" />
                                Write the first entry
                            </button>
                        )}
                    >
                        {isOwner
                            ? "Journal each work session: what you did, what broke, photos of the real thing. It's how reviewers verify your hours."
                            : `${owner?.username ?? "The builder"}'s journal entries will show up here, newest first.`}
                    </Empty>
                )
            ) : (
                <PagedTimeline
                    items={items}
                    renderItem={(item) =>
                        item.kind === "entry"
                            ? <JournalEntry key={item.entry.id} entry={item.entry} hours />
                            : <ShipEvent key={item.ship.id} ship={item.ship} grantStatus={item.ship.id === grantShipId ? project.grantStatus : null} />
                    }
                    origin={
                        <TimelineItem date={project.createdAt} hollow>
                            <p className="text-(--text)/85">
                                {owner?.username ?? "The builder"} started <span className="font-semibold text-(--text)">{project.title}</span>.
                            </p>
                        </TimelineItem>
                    }
                    footer={capped && (
                        <p className="text-sm text-(--text)/75">
                            Showing the latest {entries.length} of {total} entries.
                        </p>
                    )}
                />
            )}
        </Section>
    );
}

// A ship on the timeline (owner only: shipments aren't public).
function ShipEvent({ ship, grantStatus }) {
    const final = Boolean(ship.finalApprovedAt);
    const feedback = ship.feedback?.trim();
    const facts = [
        !ship.isBuildComplete && ship.requestedFunding > 0 && (GRANT_LABEL[grantStatus]
            ? ["Grant", <>${ship.requestedFunding.toLocaleString()} <span className="text-sm font-medium text-(--text)/85">{GRANT_LABEL[grantStatus]}</span></>]
            : ["Grant asked for", `$${ship.requestedFunding.toLocaleString()}`]),
        ["Hours shipped", formatNumber(roundHours(ship.hourSnapshot))],
        final && ship.voltsGranted > 0 && ["Volts paid", ship.voltsGranted.toLocaleString()],
    ].filter(Boolean);

    return (
        <TimelineItem date={ship.createdAt} label="Shipped">
            <article className="t-card flex flex-col gap-4 border-(--accent) px-5 py-5 text-(--text) sm:px-7 sm:py-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Ship aria-hidden="true" className="size-5 shrink-0 text-(--accent)" />
                    <h3 className="text-xl font-semibold text-(--text)">{ship.isBuildComplete ? "Build ship" : "Design ship"}</h3>
                    <ProjectStatusBadge status={ship.status} statuses={SHIP_STATUS} />
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                    {facts.map(([label, value]) => (
                        <div key={label} className="flex flex-col-reverse gap-0.5">
                            <dt className="text-sm text-(--text)/75">{label}</dt>
                            <dd className="text-lg font-bold text-(--text) tabular-nums">{value}</dd>
                        </div>
                    ))}
                </dl>
                {feedback && (
                    <div className="flex flex-col gap-1 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 sm:px-5">
                        <p className="text-sm font-bold text-(--text)">Reviewer feedback</p>
                        <p className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{feedback}</p>
                    </div>
                )}
            </article>
        </TimelineItem>
    );
}

// ---------------------------------------------------------------- page states

function ProjectError({ error, onRetry }) {
    const missing = error?.status === 404;

    return (
        <AppShell title="Project">
            <section role="status" className="t-card mx-auto flex max-w-4xl flex-col items-start gap-3 px-5 py-8 text-(--text) sm:px-8 lg:px-12">
                <h1 className="[font-family:var(--heading-font)] text-3xl font-bold text-(--text)">
                    {missing ? "No project here" : "Couldn't load this project"}
                </h1>
                <p className="max-w-[60ch] leading-relaxed text-(--text)/85">
                    {missing
                        ? "This project doesn't exist. The link might be mistyped, or it was removed."
                        : "Something went wrong talking to the server. Check your connection and try again."}
                </p>
                <div className="mt-2">
                    {missing ? (
                        <Link to="/explore" className={`${BTN_PRIMARY}`}>
                            Explore projects
                        </Link>
                    ) : (
                        <RetryButton onClick={onRetry} />
                    )}
                </div>
            </section>
        </AppShell>
    );
}

function ProjectSkeleton() {
    return (
        <AppShell title="Project">
            <div aria-busy="true" aria-label="Loading project" className="mx-auto flex max-w-4xl flex-col gap-12">
                <div className="t-card overflow-hidden">
                    <div className="h-36 bg-white/5 motion-safe:animate-pulse sm:h-44" />
                    <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8">
                        <div className="flex gap-2">
                            <div className="h-6 w-24 rounded-full bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-6 w-16 rounded-full bg-white/10 motion-safe:animate-pulse" />
                        </div>
                        <div className="h-10 w-2/3 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                        <div className="h-5 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                        <div className="h-5 w-4/5 rounded bg-white/10 motion-safe:animate-pulse" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-full bg-white/10 motion-safe:animate-pulse" />)}
                        </div>
                    </div>
                </div>
                <JournalSkeleton />
            </div>
        </AppShell>
    );
}
