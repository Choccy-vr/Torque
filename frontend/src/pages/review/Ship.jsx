import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowDown, ArrowUpRight, BookOpen, CircleAlert, FileText, FolderGit2, Gauge, Globe, Hammer, Lock, PencilRuler,
    RefreshCw, Sparkles, Star, UserCheck,
} from "lucide-react";
import ReviewShell from "../../components/review/ReviewShell.jsx";
import { BackLink, ConfirmBox, EntityTitle, Facts, NotFoundNote, Panel, Tag } from "../../components/admin/AdminParts.jsx";
import { Empty, InlineError, Section } from "../../components/PageParts.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, Field, FOCUS, FormError, INPUT } from "../../components/Form.jsx";
import { JournalEntry, JournalSkeleton, PagedTimeline } from "../../components/Journal.jsx";
import ImageDrop from "../../components/ImageDrop.jsx";
import Switch from "../../components/Switch.jsx";
import Cover from "../../components/project/Cover.jsx";
import { Avatar } from "../../components/EmptyImage.jsx";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import SlackIcon from "../../components/SlackIcon.jsx";
import { Review } from "../admin/Ship.jsx";
import { Timelapses } from "../admin/Project.jsx";
import {
    claimReviewShip, getDevlogs, getReviewHackatime, getReviewShip, setReviewMarkers, submitReview, unclaimReviewShip,
} from "../../lib/endpoints.js";
import { useAction } from "../../lib/admin.js";
import { ADMIN_PROJECT_STATUS, ADMIN_SHIP_STATUS, LEVELS, formatDay, formatWhen } from "../../lib/projects.js";
import { DECISIONS, formatClock, hoursLabel } from "../../lib/review.js";
import { useApi } from "../../lib/useApi.js";

const LINK = `font-medium text-(--text) underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-colors duration-300 ease hover:decoration-(--accent) ${FOCUS}`;
// A compact outline pill for the project's outside links.
const LINK_BTN = `inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-(--accent)/55 px-4 font-semibold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15 ${FOCUS}`;
// The newest journals a review page loads (api/devlog/batch's limit).
const JOURNAL_BATCH = 30;
const FORBIDDEN = "Only reviewers can do that.";

// /review/:id: one ship and everything needed to judge it on a single page.
// The project (links, hours, Hackatime, journals, timelapses, history, the
// builder's other projects) scrolls on the left; the review panel (claim,
// markers, decision) stays put on the right. Phones stack them, panel last.
export default function ReviewShip() {
    const { id } = useParams();
    return (
        <ReviewShell title="Ship">
            <ReviewWorkspace key={id} id={id} />
        </ReviewShell>
    );
}

function ReviewWorkspace({ id }) {
    const fetchShip = useCallback(() => getReviewShip(id), [id]);
    const api = useApi(fetchShip);
    const s = api.data;

    if (api.error) {
        return (
            <div className="flex flex-col gap-4">
                <BackLink to="/review">Queue</BackLink>
                {api.error.status === 404
                    ? <NotFoundNote>No ship with this id. It may have been deleted.</NotFoundNote>
                    : <InlineError what="this ship" onRetry={api.reload} />}
            </div>
        );
    }
    if (!s) {
        return (
            <div aria-busy="true" aria-label="Loading ship" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
                <div className="t-card h-[32rem] motion-safe:animate-pulse text-(--text)!" />
                <div className="t-card h-96 motion-safe:animate-pulse text-(--text)!" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <BackLink to="/review">Queue</BackLink>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start">
                <div className="flex min-w-0 flex-col gap-6">
                    <Header ship={s} />
                    <Hours ship={s} />
                    <Details ship={s} />
                    <Journals ship={s} />
                    <Timelapses projectId={s.projectId} linked={s.projectSnapshot.hackatimeProjectNames?.length > 0} />
                    <History ship={s} />
                    <OtherProjects ship={s} />
                </div>
                <ReviewPanel ship={s} onChanged={api.reload} />
            </div>
        </div>
    );
}

// --- Project column ---------------------------------------------------------

function Header({ ship: s }) {
    const p = s.projectSnapshot;
    const Kind = s.isBuildComplete ? Hammer : PencilRuler;
    const kind = s.isBuildComplete ? "Build ship" : "Design ship";
    const links = [
        [p.repoUrl, "Repository", FolderGit2],
        [p.demoUrl, "Demo", Globe],
        [p.readmeUrl, "README", FileText],
    ].filter(([url]) => url);

    return (
        <section aria-labelledby="ship-title" className="t-card flex flex-col overflow-hidden text-(--text)!">
            <Cover project={{ ...p, title: s.projectTitle }} />
            <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Tag><Kind aria-hidden="true" className="size-3.5" />{kind}</Tag>
                        {s.tierSnapshot > 0 && <Tag>Level {s.tierSnapshot}</Tag>}
                        {s.status !== "unreviewed" && <ProjectStatusBadge status={s.status} statuses={ADMIN_SHIP_STATUS} />}
                        {s.isStaffPick && <Tag><Star aria-hidden="true" className="size-3.5" />Staff pick</Tag>}
                        {s.exceptional && <Tag><Sparkles aria-hidden="true" className="size-3.5" />Exceptional</Tag>}
                    </div>
                    <EntityTitle id="ship-title" kind={kind}>{s.projectTitle || "Untitled project"}</EntityTitle>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link to={`/profile/${s.owner.id}`} className={`-m-1 flex items-center gap-3 rounded-xl p-1 transition-colors duration-300 ease hover:bg-white/10 ${FOCUS}`}>
                        <Avatar src={s.owner.profilePictureUrl} className="size-10 rounded-[0.625rem] border-(--accent)/55" />
                        <span className="flex flex-col leading-snug">
                            <span className="font-semibold">{s.owner.username || "Unknown builder"}</span>
                            <span className="text-sm text-(--text)/80">Joined {formatDay(s.owner.createdAt)} · shipped {formatWhen(s.createdAt)}</span>
                        </span>
                    </Link>
                    {s.owner.slackUserID && (
                        <a
                            href={`https://hackclub.slack.com/team/${encodeURIComponent(s.owner.slackUserID)}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-3 ${LINK}`}
                        >
                            <SlackIcon className="size-4" />
                            Slack
                            <span className="sr-only">(opens in a new tab)</span>
                        </a>
                    )}
                </div>

                {p.description
                    ? <p className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{p.description}</p>
                    : <p className="text-(--text)/75">No description.</p>}

                <div className="flex flex-wrap items-center gap-2">
                    {links.map(([url, label, Icon]) => (
                        <a key={label} href={url} target="_blank" rel="noreferrer" className={LINK_BTN}>
                            <Icon aria-hidden="true" className="size-4.5" />
                            {label}
                            <ArrowUpRight aria-hidden="true" className="size-4 text-(--text)/70" />
                            <span className="sr-only">(opens in a new tab)</span>
                        </a>
                    ))}
                    {links.length === 0 && (
                        <p className="flex items-center gap-2 rounded-2xl border-2 border-(--accent) bg-(--accent)/15 px-4 py-2 text-(--text)">
                            <CircleAlert aria-hidden="true" className="size-4.5 shrink-0" />
                            No repository, demo or README linked.
                        </p>
                    )}
                    <Link to="/docs/shipping/shipping-guidelines" target="_blank" className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-3 ${LINK}`}>
                        <BookOpen aria-hidden="true" className="size-4.5" />
                        Shipping guidelines
                        <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                    <a href="#review" className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-3 xl:hidden ${LINK}`}>
                        <ArrowDown aria-hidden="true" className="size-4.5" />
                        Jump to the review
                    </a>
                </div>
            </div>
        </section>
    );
}

function Hours({ ship: s }) {
    const p = s.projectSnapshot;
    return (
        <Panel id="hours" title="Hours">
            <Facts
                items={[
                    ["Hours in this ship", hoursLabel(s.hourSnapshot)],
                    ["Approved on earlier ships", hoursLabel(s.totalHoursApproved)],
                    ["Journaled in total", hoursLabel(p.totalHoursRaw)],
                    ["Journals", (p.devlogIds?.length ?? 0).toLocaleString()],
                    !s.isBuildComplete && ["Grant asked for", s.requestedFunding > 0 ? `$${s.requestedFunding.toLocaleString()}` : null],
                    ["Level at ship", s.tierSnapshot > 0 ? `Level ${s.tierSnapshot}` : null],
                ]}
            />
            <HackatimeCheck shipId={s.id} journaled={p.totalHoursRaw} linked={p.hackatimeProjectNames?.length > 0} />
        </Panel>
    );
}

// Trust level wording; "red" and "yellow" get the coral edge.
const TRUST = {
    blue: { label: "Blue · trusted" },
    green: { label: "Green · trusted" },
    yellow: { label: "Yellow · warned", attention: true },
    red: { label: "Red · banned on Hackatime", attention: true },
};

// Hackatime is a slow outside call, so it only runs when asked.
function HackatimeCheck({ shipId, journaled, linked }) {
    const [state, setState] = useState({ status: "idle", data: null });

    async function load() {
        setState((s) => ({ ...s, status: "loading" }));
        try {
            setState({ status: "done", data: await getReviewHackatime(shipId) });
        } catch {
            setState({ status: "error", data: null });
        }
    }

    const d = state.data;
    const trust = d?.trustLevel ? TRUST[d.trustLevel] ?? { label: d.trustLevel } : null;

    return (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-white/10 bg-(--bg)/30 px-4 py-4 sm:px-5" aria-busy={state.status === "loading"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-semibold">Hackatime</p>
                    <p className="text-sm text-(--text)/80">Live trust level and counted hours on the linked projects, from Oct 1.</p>
                </div>
                {linked && state.status !== "loading" && (
                    <button type="button" onClick={load} className={BTN_OUTLINE}>
                        {state.status === "idle" ? <Gauge aria-hidden="true" className="size-4.5" /> : <RefreshCw aria-hidden="true" className="size-4.5" />}
                        {state.status === "idle" ? "Check Hackatime" : "Check again"}
                    </button>
                )}
            </div>

            {!linked ? (
                <p className="flex items-start gap-2 text-(--text)">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-(--accent)" />
                    No Hackatime projects are linked to this project.
                </p>
            ) : state.status === "loading" ? (
                <div className="flex flex-col gap-2" aria-label="Asking Hackatime">
                    <div className="h-5 w-40 rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-5 w-64 max-w-full rounded bg-white/10 motion-safe:animate-pulse" />
                </div>
            ) : state.status === "error" ? (
                <p className="text-(--text)/90">Couldn't load Hackatime. Try again in a moment.</p>
            ) : d && !d.connected ? (
                <p className="flex items-start gap-2 text-(--text)">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-(--accent)" />
                    The builder's Hackatime account isn't connected any more.
                </p>
            ) : d && !d.reachable ? (
                <p className="text-(--text)/90">Hackatime didn't answer. Try again in a moment.</p>
            ) : d ? (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <p className="flex items-center gap-2">
                            <span className="text-sm text-(--text)/80">Trust</span>
                            {trust ? <Tag accent={trust.attention}>{trust.label}</Tag> : <span className="text-(--text)/75">Unknown</span>}
                        </p>
                        <p className="tabular-nums">
                            <span className="text-sm text-(--text)/80">Counted </span>
                            <b className="font-bold">{hoursLabel(d.totalHours)}</b>
                            <span className="text-sm text-(--text)/80"> vs {hoursLabel(journaled)} journaled</span>
                        </p>
                    </div>
                    <ul className="flex flex-col divide-y-2 divide-white/10 rounded-xl border-2 border-white/10">
                        {d.perProject.map((row) => (
                            <li key={row.name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <code className="min-w-0 truncate font-mono text-[0.875rem] text-(--text)/90">{row.name}</code>
                                <span className="shrink-0 font-semibold tabular-nums">{hoursLabel(row.hours)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function Details({ ship: s }) {
    const p = s.projectSnapshot;
    const rows = [
        ["Linked Hackatime projects", p.hackatimeProjectNames?.length ? p.hackatimeProjectNames.join(", ") : null],
        ["AI use", p.aiUse],
        ["How did you hear about Torque?", s.howDidYouHear],
        ["What are we doing well?", s.whatAreWeDoingWell],
        ["How can we improve?", s.howCanWeImprove],
    ];
    return (
        <Panel id="details" title="Details">
            <dl className="flex flex-col divide-y-2 divide-white/10">
                {rows.map(([q, a]) => (
                    <div key={q} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                        <dt className="text-sm font-bold">{q}</dt>
                        <dd className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">
                            {a || <span className="text-(--text)/60">Not given</span>}
                        </dd>
                    </div>
                ))}
            </dl>
        </Panel>
    );
}

function Journals({ ship: s }) {
    const ids = s.projectSnapshot.devlogIds ?? [];
    // devlogIds are oldest first; the newest batch is the end of the list.
    const idsKey = ids.slice(-JOURNAL_BATCH).join(",");
    const fetchDevlogs = useCallback(() => (idsKey ? getDevlogs(idsKey.split(",")) : Promise.resolve([])), [idsKey]);
    const devlogs = useApi(fetchDevlogs);
    const entries = [...(devlogs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Journals newer than the last approved ship are the ones this ship covers.
    const lastApproved = s.previousShips.find((x) => x.status === "approved" && x.createdAt < s.createdAt);
    const fresh = lastApproved ? entries.filter((e) => e.createdAt > lastApproved.createdAt) : null;
    const freshHours = fresh?.reduce((sum, e) => sum + (e.trackedHours ?? 0), 0) ?? 0;

    return (
        // A Section, not a Panel: journal entries are cards themselves.
        <Section id="journals" title="Journals" count={ids.length}>
            {devlogs.loading && !devlogs.data ? (
                <JournalSkeleton />
            ) : devlogs.error ? (
                <InlineError what="the journals" onRetry={devlogs.reload} />
            ) : entries.length === 0 ? (
                <Empty title="No journals">This project has no journal entries, so there's nothing backing its hours.</Empty>
            ) : (
                <div className="flex flex-col gap-5">
                    {fresh && (
                        <p className="text-(--text)/90">
                            <b className="font-bold text-(--text) tabular-nums">{fresh.length} {fresh.length === 1 ? "entry" : "entries"}</b>
                            {" "}({hoursLabel(freshHours)}) since the last approved ship on {formatDay(lastApproved.createdAt)}.
                        </p>
                    )}
                    <PagedTimeline
                        items={entries}
                        renderItem={(entry) => <JournalEntry key={entry.id} entry={entry} hours />}
                        footer={ids.length > entries.length && (
                            <p className="text-sm text-(--text)/75">Showing the latest {entries.length} of {ids.length} entries.</p>
                        )}
                    />
                </div>
            )}
        </Section>
    );
}

function History({ ship: s }) {
    if (s.previousShips.length === 0 && s.previousReviews.length === 0) {
        return (
            <Panel id="history" title="History">
                <p className="text-(--text)/85">This is the project's first ship.</p>
            </Panel>
        );
    }
    return (
        <Panel id="history" title="History">
            {s.previousShips.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold">Earlier ships</h3>
                    <ul className="flex flex-col divide-y-2 divide-white/10 rounded-2xl border-2 border-white/10 bg-(--bg)/30">
                        {s.previousShips.map((x) => (
                            <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                                <span className="font-semibold">{x.isBuildComplete ? "Build ship" : "Design ship"}</span>
                                <ProjectStatusBadge status={x.status} statuses={ADMIN_SHIP_STATUS} />
                                <span className="text-sm text-(--text)/80 tabular-nums">
                                    {formatDay(x.createdAt)} · {hoursLabel(x.hourSnapshot)} shipped
                                    {x.finalApprovedAt && ` · ${hoursLabel(x.approvedHours)} approved`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {s.previousReviews.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold">Reviews ({s.previousReviews.length})</h3>
                    <ol className="flex flex-col gap-4">
                        {s.previousReviews.map((r) => <Review key={r.id} review={r} />)}
                    </ol>
                </div>
            )}
        </Panel>
    );
}

function OtherProjects({ ship: s }) {
    const name = s.owner.username || "this builder";
    return (
        <Panel id="other-projects" title={`Other projects by ${name}`}>
            {s.otherProjects.length === 0 ? (
                <p className="text-(--text)/85">This is their only project.</p>
            ) : (
                <ul className="flex flex-col divide-y-2 divide-white/10 overflow-hidden rounded-2xl border-2 border-white/10 bg-(--bg)/30">
                    {s.otherProjects.map((p) => (
                        <li key={p.id}>
                            <Link to={`/projects/${p.id}`} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-300 ease hover:bg-white/5 focus-visible:-outline-offset-2 sm:px-5 ${FOCUS}`}>
                                <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                                <span className="flex flex-wrap items-center gap-2 text-sm text-(--text)/80 tabular-nums">
                                    {p.isArchived && <Tag>Deleted</Tag>}
                                    <ProjectStatusBadge status={p.status} statuses={ADMIN_PROJECT_STATUS} quiet />
                                    {p.tier > 0 && <span>Level {p.tier}</span>}
                                    <span>{hoursLabel(p.totalHoursApproved)} approved</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

// --- Review panel -----------------------------------------------------------

function ReviewPanel({ ship: s, onChanged }) {
    const open = s.status === "unreviewed";
    // Whether the form holds anything, so releasing the claim (which closes it) can warn first.
    const [dirty, setDirty] = useState(false);
    return (
        <aside
            id="review"
            aria-labelledby="review-title"
            className="t-card t-scroll flex scroll-mt-6 flex-col gap-6 px-5 py-6 text-(--text)! sm:px-6 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto"
        >
            <h2 id="review-title" className="[font-family:var(--heading-font)] text-2xl font-bold text-(--text)">Review</h2>
            {open ? (
                <Claim ship={s} dirty={dirty} onChanged={onChanged} />
            ) : (
                <p className="flex flex-wrap items-center gap-2 leading-relaxed text-(--text)/90">
                    Already reviewed: <ProjectStatusBadge status={s.status} statuses={ADMIN_SHIP_STATUS} />
                </p>
            )}
            <Markers ship={s} />
            {open && s.claimedByMe && <ReviewForm ship={s} onDirtyChange={setDirty} />}
        </aside>
    );
}

// Who's on this ship. A claim lasts an hour and can be extended; "Claim anyway"
// takes over someone else's, and releasing over a draft asks first.
function Claim({ ship: s, dirty, onChanged }) {
    const action = useAction({ forbidden: FORBIDDEN });
    const [confirming, setConfirming] = useState(false);
    const [confirmingRelease, setConfirmingRelease] = useState(false);

    const claim = (force) => action.run(async () => {
        await claimReviewShip(s.id, force);
        setConfirming(false);
        onChanged();
    });
    const release = () => action.run(async () => {
        await unclaimReviewShip(s.id);
        setConfirmingRelease(false);
        onChanged();
    });

    return (
        <div role="group" aria-labelledby="claim-label" className="flex flex-col gap-3">
            <p id="claim-label" className="sr-only">Claim</p>
            {s.claimedByMe ? (
                confirmingRelease ? (
                    <ConfirmBox
                        id="release-claim"
                        title="Release and lose your draft?"
                        confirmLabel="Release"
                        busyLabel="Releasing…"
                        busy={action.busy}
                        onConfirm={release}
                        onCancel={() => setConfirmingRelease(false)}
                    >
                        Releasing closes the form, and what you've written so far isn't saved.
                    </ConfirmBox>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="flex flex-col items-start gap-1">
                            <Tag accent><UserCheck aria-hidden="true" className="size-3.5" />Claimed by you</Tag>
                            <span className="text-sm text-(--text)/80 tabular-nums">Until {formatClock(s.claimExpiresAt)}</span>
                        </p>
                        <div className="flex gap-1">
                            <button type="button" disabled={action.busy} onClick={() => claim(false)} className={`${BTN_GHOST} px-4`}>Extend</button>
                            <button type="button" disabled={action.busy} onClick={() => (dirty ? setConfirmingRelease(true) : release())} className={`${BTN_GHOST} px-4`}>Release</button>
                        </div>
                    </div>
                )
            ) : s.claimedBy ? (
                confirming ? (
                    <ConfirmBox
                        id="claim-anyway"
                        title={`Take over from ${s.claimedByUsername || "the other reviewer"}?`}
                        confirmLabel="Claim anyway"
                        busyLabel="Claiming…"
                        icon={Lock}
                        busy={action.busy}
                        onConfirm={() => claim(true)}
                        onCancel={() => setConfirming(false)}
                    >
                        They may be halfway through it. Check with them on Slack first if you can.
                    </ConfirmBox>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="flex items-start gap-2 leading-relaxed text-(--text)/90">
                            <Lock aria-hidden="true" className="mt-1 size-4 shrink-0 text-(--accent)" />
                            <span>
                                <b className="font-bold text-(--text)">{s.claimedByUsername || "Another reviewer"}</b> is on this one until{" "}
                                <span className="tabular-nums">{formatClock(s.claimExpiresAt)}</span>.
                            </span>
                        </p>
                        <button type="button" onClick={() => setConfirming(true)} className={`${BTN_OUTLINE} self-start`}>Claim anyway</button>
                    </div>
                )
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="leading-relaxed text-(--text)/90">Nobody's on this one. Claim it so other reviewers skip it; the claim holds for an hour.</p>
                    <button type="button" disabled={action.busy} onClick={() => claim(false)} className={`${BTN_PRIMARY} self-start`}>
                        {action.busy ? "Claiming…" : "Start review"}
                    </button>
                </div>
            )}
            <FormError>{action.error}</FormError>
        </div>
    );
}

// Staff pick and Exceptional, saved the moment they're pressed.
function Markers({ ship: s }) {
    const [markers, setMarkers] = useState({ isStaffPick: s.isStaffPick, exceptional: s.exceptional });
    const action = useAction({ forbidden: FORBIDDEN });
    const [pending, setPending] = useState(null);

    const toggle = (key) => {
        setPending(key);
        action.run(async () => {
            const next = await setReviewMarkers(s.projectId, { [key]: !markers[key] });
            setMarkers(next);
        }).finally(() => setPending(null));
    };

    const items = [
        { key: "isStaffPick", label: "Staff pick", hint: "Featured on Explore", icon: Star },
        { key: "exceptional", label: "Exceptional", hint: "Unlocks the black market", icon: Sparkles },
    ];

    return (
        <div role="group" aria-labelledby="markers-label" className="flex flex-col gap-3">
            <p id="markers-label" className="text-sm font-bold">Markers</p>
            <div className="grid grid-cols-2 gap-2">
                {items.map(({ key, label, hint, icon: Icon }) => {
                    const on = markers[key];
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={on}
                            disabled={action.busy}
                            onClick={() => toggle(key)}
                            className={`flex min-h-11 flex-col items-start gap-0.5 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-all duration-300 ease disabled:cursor-wait ${FOCUS} ${
                                on ? "border-(--accent) bg-(--accent)/15" : "border-white/15 hover:border-white/30 hover:bg-white/10"
                            }`}
                        >
                            <span className="flex items-center gap-1.5 font-bold text-(--text)">
                                <Icon aria-hidden="true" className={`size-4 ${on ? "fill-(--accent) text-(--accent)" : "text-(--text)/80"}`} />
                                {label}
                            </span>
                            <span className="text-[0.8125rem] leading-snug text-(--text)/80">
                                {pending === key ? "Saving…" : hint}
                            </span>
                        </button>
                    );
                })}
            </div>
            <FormError>{action.error}</FormError>
        </div>
    );
}

const round1 = (n) => Math.round(n * 10) / 10;
const blank = (v) => !v || !v.trim();

function ReviewForm({ ship: s, onDirtyChange }) {
    const navigate = useNavigate();
    const action = useAction({ forbidden: FORBIDDEN });
    const [f, setF] = useState({
        status: "",
        feedback: "",
        internalNote: "",
        screenshotUrl: "",
        technicalFeatures: "",
        overrideTier: "",
        overrideHours: "",
        overrideJustification: "",
        deflationJustification: "",
        additionalJustification: "",
        hideReviewerName: false,
    });
    const [tried, setTried] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const dirty = Object.values(f).some((v) => typeof v === "string" && v.trim() !== "");
    useEffect(() => {
        onDirtyChange(dirty);
        return () => onDirtyChange(false);
    }, [dirty, onDirtyChange]);

    const set = (key) => (e) => setF((x) => ({ ...x, [key]: e.target.value }));
    const approving = f.status === "approved";
    const decision = DECISIONS.find((d) => d.value === f.status);
    const levelOk = f.overrideTier !== "" || (s.projectSnapshot.tier >= 1 && s.projectSnapshot.tier <= 4);
    const hours = f.overrideHours === "" ? null : Number(f.overrideHours);

    const errors = {
        status: !f.status && "Pick a decision.",
        feedback: !approving && f.status && blank(f.feedback) && "Tell the builder what to fix or why.",
        screenshotUrl: approving && !f.screenshotUrl && "Add a screenshot of the project.",
        technicalFeatures: approving && blank(f.technicalFeatures) && "List what's technically impressive. Airtable needs it.",
        overrideTier: approving && !levelOk && "The project has no level. Pick one to approve.",
        overrideHours: hours !== null && (!Number.isFinite(hours) || hours < 0) && "Hours can't be negative.",
        overrideJustification: hours !== null && blank(f.overrideJustification) && "Say why the hours changed.",
    };
    const shown = (key) => (tried ? errors[key] || null : null);

    // Halve / third / quarter / ±1 from the current figure (the shipped hours until one's set).
    const nudge = (fn) => setF((x) => {
        const base = x.overrideHours === "" ? s.hourSnapshot : Number(x.overrideHours) || 0;
        return { ...x, overrideHours: String(Math.max(0, round1(fn(base)))) };
    });

    function submit(e) {
        e.preventDefault();
        setTried(true);
        if (Object.values(errors).some(Boolean) || uploading) return;
        if (f.status === "perm_rejected" && !confirming) return setConfirming(true);
        send();
    }

    async function send() {
        const body = {
            shipmentId: s.id,
            status: f.status,
            feedback: f.feedback.trim() || null,
            internalNote: f.internalNote.trim() || null,
            hideReviewerName: f.hideReviewerName,
            ...(approving && {
                screenshotUrl: f.screenshotUrl,
                technicalFeatures: f.technicalFeatures.trim(),
                overrideTier: f.overrideTier === "" ? null : Number(f.overrideTier),
                overrideHours: hours,
                overrideJustification: f.overrideJustification.trim() || null,
                deflationJustification: f.deflationJustification.trim() || null,
                additionalJustification: f.additionalJustification.trim() || null,
            }),
        };
        const ok = await action.run(async () => {
            try {
                await submitReview(body);
            } catch (err) {
                if (err?.status === 409) err.message = "Someone else claimed or reviewed this ship. Reload to see where it stands.";
                throw err;
            }
        });
        setConfirming(false);
        if (ok) navigate("/review", { state: { reviewed: s.projectTitle || "the ship" } });
    }

    return (
        <form onSubmit={submit} noValidate aria-labelledby="decision-label" className="flex flex-col gap-6 border-t-2 border-white/10 pt-6">
            <fieldset className="flex flex-col gap-2" aria-describedby={shown("status") ? "decision-error" : undefined}>
                <legend id="decision-label" className="mb-2 font-semibold text-(--text)">Decision</legend>
                <div className="flex flex-col gap-2">
                    {DECISIONS.map((d) => (
                        <label
                            key={d.value}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-white/15 px-4 py-3 transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                        >
                            <input
                                type="radio"
                                name="decision"
                                value={d.value}
                                checked={f.status === d.value}
                                onChange={(e) => { set("status")(e); setConfirming(false); }}
                                className="mt-1 size-4.5 shrink-0 accent-(--accent)"
                            />
                            <span className="flex flex-col">
                                <span className="font-bold text-(--text)">{d.label}</span>
                                <span className="text-sm leading-relaxed text-(--text)/85">{d.about}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {shown("status") && (
                    <p id="decision-error" className="flex items-start gap-2 text-sm font-medium text-(--text)">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
                        {errors.status}
                    </p>
                )}
            </fieldset>

            {approving && (
                <>
                    <div className="flex flex-col gap-2">
                        <p id="screenshot-label" className="font-semibold text-(--text)">Screenshot</p>
                        {f.screenshotUrl ? (
                            <div className="flex flex-col gap-2">
                                <img src={f.screenshotUrl} alt="Review screenshot" className="aspect-video w-full rounded-2xl border-2 border-white/15 bg-(--bg) object-cover" />
                                <button type="button" onClick={() => setF((x) => ({ ...x, screenshotUrl: "" }))} className={`${BTN_GHOST} self-start`}>
                                    Replace screenshot
                                </button>
                            </div>
                        ) : (
                            <ImageDrop
                                purpose="review"
                                onUploaded={(url) => setF((x) => ({ ...x, screenshotUrl: url }))}
                                onBusyChange={setUploading}
                                title="Drop a screenshot of the project"
                                className="min-h-32 rounded-2xl border-2"
                            />
                        )}
                        {shown("screenshotUrl") && (
                            <p className="flex items-start gap-2 text-sm font-medium text-(--text)">
                                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
                                {errors.screenshotUrl}
                            </p>
                        )}
                        <p className="text-sm leading-relaxed text-(--text)/80">Goes to Airtable with the approval.</p>
                    </div>

                    <Field label="Technical features" error={shown("technicalFeatures")} hint="What makes it hard or interesting: custom PCB, FOC, closed-loop control…">
                        {(props) => <textarea {...props} rows={3} value={f.technicalFeatures} onChange={set("technicalFeatures")} className={`${INPUT} resize-y`} />}
                    </Field>

                    <Field
                        label="Level"
                        error={shown("overrideTier")}
                        hint={s.projectSnapshot.tier > 0 ? `The builder picked Level ${s.projectSnapshot.tier}. Changing it sets the project's level.` : "The builder hasn't picked a level."}
                    >
                        {(props) => (
                            <select {...props} value={f.overrideTier} onChange={set("overrideTier")} className={`${INPUT} cursor-pointer [&>option]:bg-(--card)`}>
                                <option value="">{s.projectSnapshot.tier > 0 ? `Keep Level ${s.projectSnapshot.tier}` : "Pick a level"}</option>
                                {LEVELS.map((l) => <option key={l.level} value={l.level}>Level {l.level} · {l.name}</option>)}
                            </select>
                        )}
                    </Field>

                    <div className="flex flex-col gap-3">
                        <Field label="Hours to approve" optional error={shown("overrideHours")} hint={`Leave blank to approve the ${hoursLabel(s.hourSnapshot)} shipped.`}>
                            {(props) => (
                                <input
                                    {...props}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.1"
                                    placeholder={String(round1(s.hourSnapshot))}
                                    value={f.overrideHours}
                                    onChange={set("overrideHours")}
                                    className={`${INPUT} tabular-nums`}
                                />
                            )}
                        </Field>
                        <div role="group" aria-label="Adjust hours" className="flex flex-wrap gap-1.5">
                            {[
                                ["Halve", (h) => h / 2],
                                ["Third", (h) => h / 3],
                                ["Quarter", (h) => h / 4],
                                ["−1", (h) => h - 1],
                                ["+1", (h) => h + 1],
                            ].map(([label, fn]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => nudge(fn)}
                                    aria-label={label === "−1" ? "Minus one hour" : label === "+1" ? "Plus one hour" : label}
                                    className={`inline-flex min-h-10 items-center rounded-(--radius) border-2 border-white/15 px-3.5 text-sm font-semibold text-(--text) tabular-nums transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 ${FOCUS}`}
                                >
                                    {label}
                                </button>
                            ))}
                            {f.overrideHours !== "" && (
                                <button type="button" onClick={() => setF((x) => ({ ...x, overrideHours: "" }))} className={`inline-flex min-h-10 items-center rounded-(--radius) px-3 text-sm ${LINK}`}>
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {hours !== null && (
                        <Field label="Why the hours changed" error={shown("overrideJustification")}>
                            {(props) => <textarea {...props} rows={3} value={f.overrideJustification} onChange={set("overrideJustification")} className={`${INPUT} resize-y`} />}
                        </Field>
                    )}

                    <Field label="Deflation justification" optional hint="If the hours look inflated: what you checked and what you found.">
                        {(props) => <textarea {...props} rows={2} value={f.deflationJustification} onChange={set("deflationJustification")} className={`${INPUT} resize-y`} />}
                    </Field>
                    <Field label="Anything else for the fraud check" optional>
                        {(props) => <textarea {...props} rows={2} value={f.additionalJustification} onChange={set("additionalJustification")} className={`${INPUT} resize-y`} />}
                    </Field>
                </>
            )}

            <Field
                label="Feedback to the builder"
                optional={approving || !f.status}
                error={shown("feedback")}
                hint={approving ? "Shown on their ship." : "Sent to them in a Slack DM and shown on their ship."}
            >
                {(props) => <textarea {...props} rows={4} value={f.feedback} onChange={set("feedback")} className={`${INPUT} resize-y`} />}
            </Field>

            <Field label="Internal note" optional hint="Reviewers and admins only. The builder never sees it.">
                {(props) => <textarea {...props} rows={2} value={f.internalNote} onChange={set("internalNote")} className={`${INPUT} resize-y`} />}
            </Field>

            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <p id="hide-name-label" className="font-semibold text-(--text)">Hide my name</p>
                    <p id="hide-name-hint" className="text-sm leading-relaxed text-(--text)/85">Your username is left off the review the builder sees.</p>
                </div>
                <Switch
                    on={f.hideReviewerName}
                    onToggle={() => setF((x) => ({ ...x, hideReviewerName: !x.hideReviewerName }))}
                    aria-labelledby="hide-name-label"
                    aria-describedby="hide-name-hint"
                />
            </div>

            <FormError>{action.error}</FormError>

            {confirming ? (
                <ConfirmBox
                    id="perm-reject"
                    title="Permanently reject this project?"
                    confirmLabel="Permanently reject"
                    busyLabel="Rejecting…"
                    busy={action.busy}
                    onConfirm={send}
                    onCancel={() => setConfirming(false)}
                >
                    {s.owner.username || "The builder"} will never be able to ship this project again. They can still ship other projects.
                </ConfirmBox>
            ) : (
                <button type="submit" disabled={action.busy || uploading} className={`${BTN_PRIMARY} self-stretch`}>
                    {action.busy ? "Sending…" : uploading ? "Waiting for the upload…" : decision?.submit ?? "Send review"}
                </button>
            )}
        </form>
    );
}
