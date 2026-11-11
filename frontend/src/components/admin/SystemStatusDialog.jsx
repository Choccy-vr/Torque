import { useEffect, useId, useRef } from "react";
import { CircleAlert, CircleCheck, CircleMinus, CircleX, RotateCw, X } from "lucide-react";
import { RetryButton } from "../PageParts.jsx";
import { Tag } from "./AdminParts.jsx";
import { BTN_GHOST, FOCUS } from "../Form.jsx";
import { getModuleStatus } from "../../lib/endpoints.js";
import { formatWhen } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

// How each status draws. One hue only (the One Needle Rule): what needs eyes
// takes coral, healthy stays chalk, and switched-off modules step back.
// `rank` sorts the list so whatever the headline is about comes first.
const STATUS = {
    down: { label: "Down", icon: CircleX, attention: true, rank: 0 },
    degraded: { label: "Degraded", icon: CircleAlert, attention: true, rank: 1 },
    healthy: { label: "Healthy", icon: CircleCheck, attention: false, rank: 2 },
    disabled: { label: "Off", icon: CircleMinus, attention: false, rank: 3 },
};
const rankOf = (m) => (STATUS[m.status] ?? STATUS.down).rank;

// Every backend integration checked live (GET api/admin/modules), in a native
// modal: is each one configured, and does a real call to it work? The checks
// hit outside services, so they only run while this is open.
export default function SystemStatusDialog({ onClose }) {
    const id = useId();
    const ref = useRef(null);
    const pressedBackdrop = useRef(false);
    const status = useApi(getModuleStatus);

    useEffect(() => {
        if (!ref.current.open) ref.current.showModal();
    }, []);
    const close = () => ref.current?.close();

    // Array sort is stable, so modules keep the backend's order within a status.
    const modules = [...(status.data?.modules ?? [])].sort((a, b) => rankOf(a) - rankOf(b));
    // With nothing to show, the error box carries the retry instead of the header.
    const failed = status.error && modules.length === 0;
    const rechecking = status.loading && modules.length > 0;

    return (
        <dialog
            ref={ref}
            aria-labelledby={`${id}-title`}
            aria-describedby={failed ? undefined : `${id}-summary`}
            onClose={onClose}
            onPointerDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && close()}
            className="t-card t-scroll m-auto max-h-[min(90vh,56rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-0 text-(--text)! backdrop:bg-black/60"
        >
            {/* Stays in view while the list scrolls: title, where things stand, recheck, close. */}
            <header className="sticky top-0 z-10 flex flex-col gap-4 border-b-2 border-white/10 bg-(--card) px-5 pt-5 pb-4 sm:px-8 sm:pt-6">
                <div className="flex items-start justify-between gap-4">
                    <h2 id={`${id}-title`} className="flex items-baseline gap-3 pt-1.5">
                        <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-(--accent)" />
                        <span className="[font-family:var(--heading-font)] text-2xl leading-tight font-bold">System status</span>
                    </h2>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close"
                        className={`-mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius) text-(--text) transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                    >
                        <X aria-hidden="true" className="size-5" />
                    </button>
                </div>
                {!failed && (
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <Summary id={`${id}-summary`} status={status} modules={modules} />
                        <button
                            type="button"
                            onClick={status.reload}
                            disabled={status.loading}
                            className={`${BTN_GHOST} -mx-3 px-3 sm:mx-0`}
                        >
                            <RotateCw aria-hidden="true" className={`size-4 ${status.loading ? "motion-safe:animate-spin" : ""}`} />
                            {status.loading ? "Checking…" : "Check again"}
                        </button>
                    </div>
                )}
            </header>

            <div className="px-5 pt-2 pb-6 sm:px-8 sm:pb-8">
                {failed ? (
                    <div role="status" className="mt-4 flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-white/20 px-5 py-6">
                        <p className="leading-relaxed text-(--text)/90">
                            {status.error.status === 403
                                ? "Only admins can see the system status."
                                : "Couldn't run the checks. The backend may be down, or your connection dropped."}
                        </p>
                        {status.error.status !== 403 && <RetryButton onClick={status.reload} />}
                    </div>
                ) : modules.length === 0 ? (
                    <Skeleton />
                ) : (
                    <ul
                        aria-label="Modules"
                        aria-busy={rechecking}
                        className={`flex flex-col divide-y-2 divide-white/10 transition-opacity duration-300 ease ${rechecking ? "opacity-60" : ""}`}
                    >
                        {modules.map((m) => <ModuleRow key={m.key} id={`${id}-${m.key}`} module={m} />)}
                    </ul>
                )}
            </div>
        </dialog>
    );
}

// One sentence on where things stand, then the counts and when it was checked.
function Summary({ id, status, modules }) {
    if (modules.length === 0) {
        return (
            <p id={id} role="status" className="text-(--text)/85">Checking every module…</p>
        );
    }

    const count = (s) => modules.filter((m) => m.status === s).length;
    const down = count("down");
    const degraded = count("degraded");
    const off = count("disabled");
    const healthy = count("healthy");

    const headline = down > 0
        ? `${down} ${down === 1 ? "module is" : "modules are"} down`
        : degraded > 0
            ? `${degraded} ${degraded === 1 ? "module needs" : "modules need"} attention`
            : "Everything that's on is healthy";
    const tally = [
        `${healthy} healthy`,
        degraded > 0 && `${degraded} degraded`,
        down > 0 && `${down} down`,
        off > 0 && `${off} off`,
    ].filter(Boolean).join(" · ");

    return (
        <div id={id} role="status" className="flex min-w-0 flex-col gap-0.5">
            <p className="flex items-center gap-2 text-lg font-bold">
                {(down > 0 || degraded > 0) && <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-(--accent)" />}
                {headline}
            </p>
            <p className="text-sm text-(--text)/80 tabular-nums">
                {tally}
                {status.data?.checkedAt && <> · checked {formatTime(status.data.checkedAt)}</>}
            </p>
        </div>
    );
}

function ModuleRow({ id, module: m }) {
    const s = STATUS[m.status] ?? STATUS.down;
    const Icon = s.icon;
    const off = m.status === "disabled";

    return (
        <li aria-labelledby={`${id}-name`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 py-5 last:pb-0">
            <Icon
                aria-hidden="true"
                className={`mt-0.5 size-5.5 ${s.attention ? "text-(--accent)" : off ? "text-(--text)/60" : "text-(--text)/85"}`}
            />
            <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 id={`${id}-name`} className={`text-lg leading-snug font-semibold ${off ? "text-(--text)/80" : ""}`}>
                            {m.name}
                            {m.required && <span className="ml-2 text-sm font-normal text-(--text)/75">Required</span>}
                        </h3>
                        <span className="flex items-center gap-3">
                            {m.latencyMs != null && (
                                <span className="text-sm text-(--text)/75 tabular-nums">{m.latencyMs.toLocaleString()} ms</span>
                            )}
                            <Tag accent={s.attention}>{s.label}</Tag>
                        </span>
                    </div>
                    <p className="max-w-[60ch] text-sm leading-relaxed text-(--text)/75">{m.description}</p>
                </div>
                <p className={`max-w-[60ch] leading-relaxed ${s.attention ? "text-(--text)" : "text-(--text)/90"}`}>{m.detail}</p>

                {m.missing.length > 0 && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-(--text)/85">
                        <span>{off ? "To switch it on, set" : "Set"}</span>
                        {m.missing.map((name) => (
                            <code key={name} className="rounded-md border border-white/15 bg-(--bg)/60 px-1.5 py-0.5 font-mono text-[0.8125rem] text-(--text) select-all">
                                {name}
                            </code>
                        ))}
                        <span>in the backend's env.</span>
                    </p>
                )}

                {m.facts.length > 0 && (
                    <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                        {m.facts.map((f) => (
                            <div key={f.label} className="flex min-w-0 gap-1.5">
                                <dt className="text-(--text)/75">{f.label}</dt>
                                <dd className="font-medium break-words text-(--text) tabular-nums">{factValue(f.value)}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </li>
    );
}

// The final layout's shapes, pulsing only when motion is welcome.
function Skeleton() {
    return (
        <div aria-busy="true" aria-label="Checking modules" className="flex flex-col divide-y-2 divide-white/10">
            {["w-32", "w-40", "w-28", "w-36"].map((w) => (
                <div key={w} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 py-5">
                    <div className="size-5.5 rounded-full bg-white/10 motion-safe:animate-pulse" />
                    <div className="flex flex-col gap-2.5">
                        <div className="flex justify-between gap-4">
                            <div className={`h-5 ${w} rounded bg-white/10 motion-safe:animate-pulse`} />
                            <div className="h-5 w-16 rounded-full bg-white/10 motion-safe:animate-pulse" />
                        </div>
                        <div className="h-4 w-full max-w-md rounded bg-white/10 motion-safe:animate-pulse" />
                        <div className="h-4 w-3/4 max-w-sm rounded bg-white/10 motion-safe:animate-pulse" />
                    </div>
                </div>
            ))}
        </div>
    );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

// Facts are plain strings; timestamps come as ISO 8601 and read as local time.
const factValue = (value) => (ISO_DATE.test(value) ? formatWhen(value) : value);

const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
