import { useCallback, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Ban, ShieldCheck, Zap } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import {
    BackLink, ConfirmBox, CopyId, EntityTitle, Facts, NotFoundNote, Panel, ResultList, Rows, SwitchRow, Tag,
} from "../../components/admin/AdminParts.jsx";
import { useAction } from "../../lib/admin.js";
import { InlineError } from "../../components/PageParts.jsx";
import { BTN_OUTLINE, BTN_PRIMARY, FOCUS, FormError, INPUT } from "../../components/Form.jsx";
import SlackIcon from "../../components/SlackIcon.jsx";
import {
    adjustUserVolts, getAdminUser, getMyProfile, getUserVoltsHistory, searchAdminProjects, searchAdminShips,
    setUserBanned, setUserRoles, setUserTimeZone, updateAdminUser,
} from "../../lib/endpoints.js";
import { formatDay, formatWhen } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";
import { Avatar } from "./Users.jsx";
import { ProjectRow } from "./Projects.jsx";
import { ShipRow } from "./Ships.jsx";

// Mirror AdminUserController's limits.
const MAX_NOTE = 5000;
const MAX_REASON = 500;
const MAX_FREEZES = 100;
// Adjustments this big (either way) ask first, so a stray zero isn't credited to a teen's balance.
const CONFIRM_VOLTS = 500;

const yesNo = (b) => (b ? "Yes" : "No");

// /admin/users/:id — one person: who they are, moderation, their Volts,
// projects and ships.
export default function AdminUser() {
    const { id } = useParams();
    return (
        <AdminShell title="User">
            <UserDetail key={id} id={id} />
        </AdminShell>
    );
}

function UserDetail({ id }) {
    const fetchUser = useCallback(() => getAdminUser(id), [id]);
    const api = useApi(fetchUser);
    // Saves hand back the updated user; it replaces the fetched copy.
    const [saved, setSaved] = useState(null);
    const user = saved ?? api.data;

    if (api.error) {
        return (
            <div className="flex flex-col gap-4">
                <BackLink to="/admin/users">Users</BackLink>
                {api.error.status === 404
                    ? <NotFoundNote>No user with this id. They may have been removed.</NotFoundNote>
                    : <InlineError what="this user" onRetry={api.reload} />}
            </div>
        );
    }
    if (!user) return <div aria-busy="true" aria-label="Loading user" className="t-card h-80 motion-safe:animate-pulse text-(--text)!" />;

    return (
        <div className="flex flex-col gap-6">
            <BackLink to="/admin/users">Users</BackLink>
            <Identity user={user} />
            <Moderation user={user} onSaved={setSaved} />
            <Note user={user} onSaved={setSaved} />
            <Streaks user={user} onSaved={setSaved} />
            <Volts user={user} onBalance={(volts) => setSaved({ ...user, volts })} />
            <OwnedProjects userId={user.id} />
            <OwnedShips userId={user.id} />
        </div>
    );
}

// The title block: avatar, names, flags, outside links and the fact ledger.
function Identity({ user }) {
    const roles = (user.role ?? []).filter((r) => r !== "banned");
    return (
        <section aria-labelledby="user-name" className="t-card flex flex-col gap-6 px-5 py-6 text-(--text)! sm:px-8 sm:py-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <Avatar src={user.profilePictureUrl} className="size-20 rounded-[1.25rem] border-(--accent) sm:size-24" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {user.banned && <Tag accent><Ban aria-hidden="true" className="size-3.5" />Banned</Tag>}
                        {user.watchlisted && <Tag accent>Watchlist</Tag>}
                        {roles.map((r) => <Tag key={r}><ShieldCheck aria-hidden="true" className="size-3.5" />{r[0].toUpperCase() + r.slice(1)}</Tag>)}
                    </div>
                    <EntityTitle id="user-name">{user.username || user.name || "No username yet"}</EntityTitle>
                    <p className="break-words text-(--text)/85">{[user.name, user.email].filter(Boolean).join(" · ")}</p>
                    {user.bio && <p className="max-w-[65ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{user.bio}</p>}
                    <div className="mt-1 flex flex-wrap gap-3">
                        <Link to={`/profile/${user.id}`} className={BTN_OUTLINE}>
                            Public profile
                            <ArrowUpRight aria-hidden="true" className="size-4 opacity-80" />
                        </Link>
                        {user.slackUserID && (
                            <a href={`https://hackclub.slack.com/team/${encodeURIComponent(user.slackUserID)}`} target="_blank" rel="noreferrer" className={BTN_OUTLINE}>
                                <SlackIcon className="size-4" />
                                Slack
                                <ArrowUpRight aria-hidden="true" className="size-4 opacity-80" />
                                <span className="sr-only">(opens in a new tab)</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>
            <Facts
                items={[
                    ["Volts", <span className="inline-flex items-center gap-1"><Zap aria-hidden="true" className="size-4 text-(--accent)" />{user.volts.toLocaleString()}</span>],
                    ["Joined", formatDay(user.createdAt)],
                    ["Setup finished", yesNo(user.completedFirstTimeSetup)],
                    ["Identity verified", yesNo(user.verificationStatus)],
                    ["YSWS eligible", yesNo(user.yswsEligible)],
                    ["Hackatime linked", yesNo(user.hackatimeLinked)],
                    ["Country", user.country || null],
                    ["Timezone", user.timeZone || null],
                    ["Streak freezes", user.streakFreezes],
                    ["User id", <CopyId value={user.id} />],
                    ["Slack id", user.slackUserID ? <CopyId value={user.slackUserID} /> : null],
                    ["Hack Club id", user.hcUserID ? <CopyId value={user.hcUserID} /> : null],
                ]}
            />
        </section>
    );
}

function Moderation({ user, onSaved }) {
    const me = useApi(getMyProfile);
    const isMe = me.data?.id === user.id;
    const ban = useAction();
    const roles = useAction();
    const watch = useAction();
    const [confirmingBan, setConfirmingBan] = useState(false);
    const [confirmingAdmin, setConfirmingAdmin] = useState(false);
    const staffRoles = (user.role ?? []).filter((r) => r !== "banned");
    const name = user.username || user.name;

    const toggleRole = (role) => {
        const next = staffRoles.includes(role) ? staffRoles.filter((r) => r !== role) : [...staffRoles, role];
        return roles.run(async () => onSaved(await setUserRoles(user.id, next)));
    };

    return (
        <Panel id="moderation" title="Moderation">
            <Rows>
                <div className="flex flex-col gap-3">
                    <SwitchRow
                        id="ban"
                        label="Banned"
                        hint={isMe
                            ? "You can't ban yourself."
                            : user.banned
                                ? "Every request they make gets a 403 until you lift it."
                                : "Locks them out of everything: no journaling, shipping or editing. They can still see that they're banned."}
                        on={user.banned}
                        busy={ban.busy || isMe}
                        onToggle={() => (user.banned
                            ? ban.run(async () => onSaved(await setUserBanned(user.id, false)))
                            : setConfirmingBan((c) => !c))}
                        error={ban.error}
                    />
                    {confirmingBan && !user.banned && (
                        <ConfirmBox
                            id="ban-confirm"
                            title={`Ban ${name}?`}
                            confirmLabel="Ban them"
                            busyLabel="Banning…"
                            icon={Ban}
                            busy={ban.busy}
                            onConfirm={async () => { if (await ban.run(async () => onSaved(await setUserBanned(user.id, true)))) setConfirmingBan(false); }}
                            onCancel={() => setConfirmingBan(false)}
                        >
                            They're locked out straight away. You can unban them here at any time.
                        </ConfirmBox>
                    )}
                </div>
                <div role="group" aria-labelledby="roles-label" className="flex flex-col gap-5">
                    <p id="roles-label" className="text-sm font-bold text-(--text)/85">Staff roles</p>
                    <SwitchRow
                        id="role-admin"
                        label="Admin"
                        hint={isMe ? "You can't remove your own admin role." : "Full access to this admin area: every user, project, ship and setting."}
                        on={staffRoles.includes("admin")}
                        busy={roles.busy || (isMe && staffRoles.includes("admin"))}
                        onToggle={() => (staffRoles.includes("admin") ? toggleRole("admin") : setConfirmingAdmin((c) => !c))}
                    />
                    {confirmingAdmin && !staffRoles.includes("admin") && (
                        <ConfirmBox
                            id="admin-confirm"
                            title={`Make ${name} an admin?`}
                            confirmLabel="Make them an admin"
                            busyLabel="Saving…"
                            icon={ShieldCheck}
                            busy={roles.busy}
                            onConfirm={async () => { if (await toggleRole("admin")) setConfirmingAdmin(false); }}
                            onCancel={() => setConfirmingAdmin(false)}
                        >
                            They'll see every user's email and private details, and can ban people, move Volts and pause Torque for everyone.
                        </ConfirmBox>
                    )}
                    <SwitchRow
                        id="role-reviewer"
                        label="Reviewer"
                        hint="Can review ships and see the evidence (Hackatime, Lapse)."
                        on={staffRoles.includes("reviewer")}
                        busy={roles.busy}
                        onToggle={() => toggleRole("reviewer")}
                        error={roles.error}
                    />
                </div>
                <SwitchRow
                    id="watchlist"
                    label="Watchlist"
                    hint="A flag for staff to look closer at this person's ships. They never see it."
                    on={user.watchlisted}
                    busy={watch.busy}
                    onToggle={() => watch.run(async () => onSaved(await updateAdminUser(user.id, { watchlisted: !user.watchlisted })))}
                    error={watch.error}
                />
            </Rows>
        </Panel>
    );
}

function Note({ user, onSaved }) {
    const id = useId();
    const [text, setText] = useState(user.internalNote ?? "");
    const save = useAction();
    const unchanged = text.trim() === (user.internalNote ?? "");

    return (
        <Panel id="note" title="Internal note">
            <form
                onSubmit={(e) => { e.preventDefault(); save.run(async () => onSaved(await updateAdminUser(user.id, { internalNote: text.trim() }))); }}
                className="flex flex-col gap-3"
            >
                <label htmlFor={id} className="sr-only">Internal note</label>
                <textarea
                    id={id}
                    rows={4}
                    maxLength={MAX_NOTE}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Only staff see this. What should the next admin know?"
                    className={`${INPUT} resize-y leading-relaxed`}
                />
                <FormError>{save.error}</FormError>
                <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={save.busy || unchanged} className={BTN_PRIMARY}>
                        {save.busy ? "Saving…" : "Save note"}
                    </button>
                    <span className="text-sm text-(--text)/75 tabular-nums">{text.length}/{MAX_NOTE}</span>
                </div>
            </form>
        </Panel>
    );
}

function Streaks({ user, onSaved }) {
    const freezesId = useId();
    const tzId = useId();
    const [freezes, setFreezes] = useState(String(user.streakFreezes));
    const [timeZone, setTimeZone] = useState(user.timeZone ?? "");
    const saveFreezes = useAction();
    const saveTz = useAction();
    const zones = useMemo(() => (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : []), []);
    const freezesNumber = Number(freezes);
    const freezesValid = freezes !== "" && Number.isInteger(freezesNumber) && freezesNumber >= 0 && freezesNumber <= MAX_FREEZES;

    return (
        <Panel id="streaks" title="Streaks">
            <div className="grid gap-6 sm:grid-cols-2">
                <form
                    onSubmit={(e) => { e.preventDefault(); saveFreezes.run(async () => onSaved(await updateAdminUser(user.id, { streakFreezes: freezesNumber }))); }}
                    className="flex flex-col gap-2"
                >
                    <label htmlFor={freezesId} className="font-semibold">Streak freezes</label>
                    <div className="flex gap-3">
                        <input
                            id={freezesId}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_FREEZES}
                            value={freezes}
                            onChange={(e) => setFreezes(e.target.value)}
                            aria-invalid={!freezesValid || undefined}
                            className={`${INPUT} w-28 tabular-nums`}
                        />
                        <button type="submit" disabled={saveFreezes.busy || !freezesValid || freezesNumber === user.streakFreezes} className={BTN_OUTLINE}>
                            {saveFreezes.busy ? "Saving…" : "Save"}
                        </button>
                    </div>
                    <p className="text-sm leading-relaxed text-(--text)/80">Shared by all their projects. Everyone starts with 3.</p>
                    <FormError>{saveFreezes.error}</FormError>
                </form>
                <form
                    onSubmit={(e) => { e.preventDefault(); saveTz.run(async () => { await setUserTimeZone(user.id, timeZone.trim()); onSaved({ ...user, timeZone: timeZone.trim() }); }); }}
                    className="flex flex-col gap-2"
                >
                    <label htmlFor={tzId} className="font-semibold">Timezone</label>
                    <div className="flex gap-3">
                        <input
                            id={tzId}
                            list={`${tzId}-zones`}
                            value={timeZone}
                            onChange={(e) => setTimeZone(e.target.value)}
                            placeholder="America/New_York"
                            spellCheck={false}
                            className={`${INPUT} min-w-0 flex-1`}
                        />
                        <datalist id={`${tzId}-zones`}>
                            {zones.map((z) => <option key={z} value={z} />)}
                        </datalist>
                        <button type="submit" disabled={saveTz.busy || !timeZone.trim() || timeZone.trim() === user.timeZone} className={BTN_OUTLINE}>
                            {saveTz.busy ? "Saving…" : "Save"}
                        </button>
                    </div>
                    <p className="text-sm leading-relaxed text-(--text)/80">Their streak days run midnight to midnight here. They can only set it once themselves.</p>
                    <FormError>{saveTz.error}</FormError>
                </form>
            </div>
        </Panel>
    );
}

const KIND_LABEL = { ship_payout: "Ship payout", admin_adjustment: "Admin adjustment" };

function Volts({ user, onBalance }) {
    const amountId = useId();
    const reasonId = useId();
    const fetchHistory = useCallback(() => getUserVoltsHistory(user.id), [user.id]);
    const history = useApi(fetchHistory);
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const adjust = useAction();
    const [confirming, setConfirming] = useState(false);
    const n = Number(amount);
    const valid = amount !== "" && Number.isInteger(n) && n !== 0 && reason.trim() !== "";
    const after = user.volts + (valid ? n : 0);

    async function submit(e) {
        e.preventDefault();
        if (Math.abs(n) >= CONFIRM_VOLTS && !confirming) return setConfirming(true);
        await apply();
    }

    async function apply() {
        const ok = await adjust.run(async () => {
            const { volts } = await adjustUserVolts(user.id, n, reason.trim());
            onBalance(volts);
        });
        if (ok) {
            setAmount("");
            setReason("");
            setConfirming(false);
            history.reload();
        }
    }

    return (
        <Panel
            id="volts"
            title="Volts"
            action={
                <p className="inline-flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                    <Zap aria-hidden="true" className="size-5 text-(--accent)" />
                    {user.volts.toLocaleString()}
                    <span className="sr-only">Volts balance</span>
                </p>
            }
        >
            <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-4 sm:px-5">
                <p className="font-semibold">Credit or debit</p>
                <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={amountId} className="text-sm text-(--text)/85">Amount</label>
                        <input id={amountId} type="number" inputMode="numeric" step={1} value={amount} onChange={(e) => { setAmount(e.target.value); setConfirming(false); }} placeholder="-50 or 100" className={`${INPUT} tabular-nums`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={reasonId} className="text-sm text-(--text)/85">Reason (they can see it)</label>
                        <input id={reasonId} maxLength={MAX_REASON} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Prize for the build-off" className={INPUT} />
                    </div>
                    <button type="submit" disabled={adjust.busy || !valid} className={BTN_PRIMARY}>
                        {adjust.busy ? "Saving…" : n < 0 ? `Debit ${Math.abs(n).toLocaleString()}` : n > 0 ? `Credit ${n.toLocaleString()}` : "Apply"}
                    </button>
                </div>
                {valid && (
                    <p className={`text-sm tabular-nums ${after < 0 ? "font-medium text-(--text)" : "text-(--text)/80"}`}>
                        Balance {user.volts.toLocaleString()} → <b className="font-bold text-(--text)">{after.toLocaleString()}</b>
                        {after < 0 && " (below 0, so it'll be refused)"}
                    </p>
                )}
                {confirming && valid && (
                    <ConfirmBox
                        id="volts-confirm"
                        title={`${n > 0 ? "Credit" : "Debit"} ${Math.abs(n).toLocaleString()} Volts?`}
                        confirmLabel={`Yes, ${n > 0 ? "credit" : "debit"} ${Math.abs(n).toLocaleString()}`}
                        busyLabel="Saving…"
                        icon={Zap}
                        busy={adjust.busy}
                        onConfirm={apply}
                        onCancel={() => setConfirming(false)}
                    >
                        That's a big one. Their balance goes from {user.volts.toLocaleString()} to {after.toLocaleString()}, and the reason shows in their history.
                    </ConfirmBox>
                )}
                <FormError>{adjust.error}</FormError>
            </form>

            {history.loading && !history.data ? (
                <div aria-busy="true" aria-label="Loading history" className="h-24 rounded-2xl bg-white/5 motion-safe:animate-pulse" />
            ) : history.error ? (
                <InlineError what="their Volts history" onRetry={history.reload} />
            ) : history.data.entries.length === 0 ? (
                <p className="text-(--text)/80">No Volts yet: nothing paid out or adjusted.</p>
            ) : (
                <ol aria-label="Volts history" className="flex flex-col divide-y-2 divide-white/10 rounded-2xl border-2 border-white/10">
                    {history.data.entries.map((e) => (
                        <li key={e.id} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="break-words">{e.reason}</span>
                                <span className="text-sm text-(--text)/75">
                                    {KIND_LABEL[e.kind] ?? e.kind} · {formatWhen(e.createdAt)}
                                    {e.shipmentId && <> · <Link to={`/admin/ships/${e.shipmentId}`} className={`underline decoration-(--accent)/55 decoration-2 underline-offset-4 hover:decoration-(--accent) ${FOCUS}`}>ship</Link></>}
                                </span>
                            </div>
                            <span className="shrink-0 font-bold tabular-nums">{e.amount > 0 ? "+" : "−"}{Math.abs(e.amount).toLocaleString()}</span>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    );
}

function OwnedProjects({ userId }) {
    const fetchProjects = useCallback(() => searchAdminProjects({ ownerId: userId }), [userId]);
    const projects = useApi(fetchProjects);
    return (
        <Panel id="projects" title="Projects">
            <ResultList flat api={projects} label="their projects" empty={{ title: "No projects", text: "They haven't started one yet." }}>
                {(p) => <ProjectRow key={p.id} project={p} showOwner={false} />}
            </ResultList>
        </Panel>
    );
}

function OwnedShips({ userId }) {
    const fetchShips = useCallback(() => searchAdminShips({ userId }), [userId]);
    const ships = useApi(fetchShips);
    return (
        <Panel id="ships" title="Ships">
            <ResultList flat api={ships} label="their ships" empty={{ title: "No ships", text: "They haven't shipped anything yet." }}>
                {(s) => <ShipRow key={s.id} ship={s} showUser={false} />}
            </ResultList>
        </Panel>
    );
}
