import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CirclePause, Pencil } from "lucide-react";
import AppShell, { PageHeader } from "../components/AppShell.jsx";
import { Empty, InlineError } from "../components/PageParts.jsx";
import { BTN_GHOST, BTN_PRIMARY, FOCUS, FormError, INPUT } from "../components/Form.jsx";
import Switch from "../components/Switch.jsx";
import { getAdminSettings, getMyProfile, updateSetting } from "../lib/endpoints.js";
import { errorText } from "../lib/forms.js";
import { isAdmin, loadSettings } from "../lib/settings.js";
import { useApi } from "../lib/useApi.js";

// Mirrors AdminSettingsController's limit.
const MAX_MESSAGE = 500;

const formatWhen = (iso) =>
    new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const TEXT_ACTION = `-my-2 -ml-3 inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`;

// /admin/settings — the global switches (api/admin/settings): pause ships,
// resubmissions, new projects, journaling or streaks for everyone, and
// what builders are told while they're paused.
export default function AdminSettings() {
    const me = useApi(getMyProfile);
    const admin = isAdmin(me.data);
    const fetchSettings = useCallback(() => (admin ? getAdminSettings() : Promise.resolve(null)), [admin]);
    const settings = useApi(fetchSettings);

    return (
        <AppShell title="Global settings">
            <PageHeader
                title="Global settings"
                lede="Global switches for everyone on Torque. Each one applies the moment you flip it, and builders see its message wherever it blocks them."
            />

            <div className="mt-8">
                {/* No data and no error yet also covers the render where `admin` has just
                    turned true and the settings fetch hasn't started. */}
                {me.loading || (admin && !settings.data && !settings.error) ? (
                    <SettingsSkeleton />
                ) : me.error ? (
                    <InlineError what="your profile" onRetry={me.reload} />
                ) : !admin || settings.error?.status === 403 ? (
                    <Empty
                        title="Admins only"
                        action={<Link to="/home" className={BTN_PRIMARY}>Back to the dashboard</Link>}
                    >
                        These switches pause parts of Torque for everyone, so only admins can see them.
                    </Empty>
                ) : settings.error ? (
                    <InlineError what="the settings" onRetry={settings.reload} />
                ) : (
                    <SettingsList initial={settings.data} />
                )}
            </div>
        </AppShell>
    );
}

// Rows keep their own copy of each setting, replaced by whatever the server
// sends back, so a save never refetches the whole list.
function SettingsList({ initial }) {
    const [rows, setRows] = useState(initial);
    const replace = (next) => setRows((all) => all.map((row) => (row.key === next.key ? next : row)));
    const pausedCount = rows.filter((row) => row.paused).length;

    return (
        <section aria-labelledby="switches" className="t-card px-5 py-2 text-(--text) sm:px-8">
            <h2 id="switches" className="sr-only">
                Switches ({pausedCount === 0 ? "nothing paused" : `${pausedCount} paused`})
            </h2>
            <ul className="divide-y-2 divide-white/10">
                {rows.map((row) => <SettingRow key={row.key} setting={row} onSaved={replace} />)}
            </ul>
        </section>
    );
}

function SettingRow({ setting, onSaved }) {
    const id = useId();
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState(null);
    const editRef = useRef(null);
    const switchRef = useRef(null);

    async function save(changes) {
        setBusy(true);
        setError(null);
        try {
            onSaved(await updateSetting(setting.key, changes));
            // This tab's own notices and blocked buttons catch up too.
            loadSettings({ force: true });
            return true;
        } catch (err) {
            setError(err?.status === 403 ? "Only admins can change settings." : errorText(err));
            return false;
        } finally {
            setBusy(false);
        }
    }

    const closeEditor = () => {
        setEditing(false);
        requestAnimationFrame(() => editRef.current?.focus());
    };

    // Pausing reaches every builder at once, so it's confirmed first;
    // switching back on is safe to do straight away.
    const closeConfirm = () => {
        setConfirming(false);
        requestAnimationFrame(() => switchRef.current?.focus());
    };
    function toggle() {
        if (setting.paused) return save({ paused: false });
        setEditing(false);
        setConfirming((c) => !c);
    }

    return (
        <li className="flex flex-col gap-4 py-6">
            <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <p id={`${id}-label`} className="text-lg font-semibold text-(--text)">{setting.label}</p>
                        {setting.paused && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--accent) bg-(--accent)/15 px-2.5 py-0.5 text-[0.8125rem] font-medium text-(--text)">
                                <CirclePause aria-hidden="true" className="size-3.5" />
                                Paused now
                            </span>
                        )}
                    </div>
                    <p id={`${id}-hint`} className="max-w-[65ch] text-sm leading-relaxed text-(--text)/85">{setting.description}</p>
                </div>
                <Switch
                    ref={switchRef}
                    on={setting.paused}
                    busy={busy}
                    onToggle={toggle}
                    aria-labelledby={`${id}-label`}
                    aria-describedby={`${id}-hint`}
                    aria-expanded={setting.paused ? undefined : confirming}
                    aria-controls={confirming ? `${id}-confirm` : undefined}
                />
            </div>

            {confirming && !setting.paused ? (
                <PauseConfirm
                    id={`${id}-confirm`}
                    setting={setting}
                    busy={busy}
                    onConfirm={async () => { if (await save({ paused: true })) closeConfirm(); }}
                    onCancel={closeConfirm}
                />
            ) : editing ? (
                <MessageEditor
                    setting={setting}
                    busy={busy}
                    onSave={async (message) => { if (await save({ message })) closeEditor(); }}
                    onCancel={closeEditor}
                />
            ) : (
                <div className="flex flex-col gap-2 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 sm:px-5">
                    <p className="text-sm font-bold text-(--text)">
                        {setting.paused ? "Builders see" : "Builders will see"}
                        <span className="font-normal text-(--text)/75">{setting.customMessage ? " (your message)" : " (default message)"}</span>
                    </p>
                    <p className="max-w-[70ch] leading-relaxed break-words text-(--text)/90">{setting.message}</p>
                    <button ref={editRef} type="button" onClick={() => setEditing(true)} className={`${TEXT_ACTION} mt-1`}>
                        <Pencil aria-hidden="true" className="size-4" />
                        Edit message
                    </button>
                </div>
            )}

            <FormError>{error}</FormError>

            {setting.updatedAt && (
                <p className="text-sm text-(--text)/75 tabular-nums">
                    Last changed <time dateTime={setting.updatedAt}>{formatWhen(setting.updatedAt)}</time>
                </p>
            )}
        </li>
    );
}

function PauseConfirm({ id, setting, busy, onConfirm, onCancel }) {
    const confirmRef = useRef(null);
    useEffect(() => { confirmRef.current?.focus(); }, []);

    return (
        <div
            id={id}
            role="group"
            aria-labelledby={`${id}-title`}
            className="flex flex-col gap-4 rounded-2xl border-2 border-(--accent) bg-(--bg)/45 px-4 py-4 sm:px-5"
        >
            <div className="flex flex-col gap-2">
                <p id={`${id}-title`} className="font-bold text-(--text)">{setting.label} for everyone?</p>
                <p className="text-sm text-(--text)/85">Builders will see:</p>
                <p className="max-w-[70ch] leading-relaxed break-words text-(--text)/90">{setting.message}</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm} className={BTN_PRIMARY}>
                    <CirclePause aria-hidden="true" className="size-4.5" />
                    {busy ? "Pausing…" : setting.label}
                </button>
                <button type="button" disabled={busy} onClick={onCancel} className={BTN_GHOST}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

// The message builders see while the switch is on. Empty means the default.
function MessageEditor({ setting, busy, onSave, onCancel }) {
    const id = useId();
    const [text, setText] = useState(setting.customMessage ?? "");
    const trimmed = text.trim();
    const unchanged = trimmed === (setting.customMessage ?? "");

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); onSave(trimmed); }}
            className="flex flex-col gap-3 rounded-2xl border-2 border-(--accent)/55 bg-(--bg)/45 px-4 py-4 sm:px-5"
        >
            <div className="flex flex-col gap-2">
                <label htmlFor={id} className="font-semibold text-(--text)">Message builders see</label>
                <textarea
                    id={id}
                    autoFocus
                    rows={3}
                    maxLength={MAX_MESSAGE}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={setting.defaultMessage}
                    aria-describedby={`${id}-hint`}
                    className={`${INPUT} resize-y leading-relaxed`}
                />
                <p id={`${id}-hint`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm leading-relaxed text-(--text)/80">
                    <span>Leave it empty to use the default (shown as the placeholder).</span>
                    <span className="tabular-nums">{text.length}/{MAX_MESSAGE}</span>
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busy || unchanged} className={BTN_PRIMARY}>
                    {busy ? "Saving…" : !trimmed && setting.customMessage ? "Use the default" : "Save message"}
                </button>
                <button type="button" disabled={busy} onClick={onCancel} className={BTN_GHOST}>
                    Cancel
                </button>
            </div>
        </form>
    );
}

function SettingsSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading settings" className="t-card flex flex-col divide-y-2 divide-white/10 px-5 py-2 sm:px-8">
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-4 py-6">
                    <div className="flex items-start justify-between gap-5">
                        <div className="flex flex-1 flex-col gap-2">
                            <div className="h-6 w-40 rounded bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-4 w-full max-w-md rounded bg-white/10 motion-safe:animate-pulse" />
                        </div>
                        <div className="h-8 w-14 rounded-full bg-white/10 motion-safe:animate-pulse" />
                    </div>
                    <div className="h-24 rounded-2xl bg-white/5 motion-safe:animate-pulse" />
                </div>
            ))}
        </div>
    );
}
