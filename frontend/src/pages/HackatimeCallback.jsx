import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { BTN_OUTLINE, BTN_PRIMARY } from "../components/Form.jsx";
import { finishHackatime } from "../lib/endpoints.js";
import { CHANNEL, DENIED_MESSAGE as DENIED, describeHackatimeError } from "../lib/hackatime.js";
import { clearPending, readPending } from "../lib/hackatimePending.js";
import { useAuth } from "../lib/useAuth.js";

const EXPIRED = "This connection link expired or was opened in another browser. Start again from Torque.";

// Where Hackatime sends people back after they approve (or decline) access.
// In the popup, it hands the code to the Torque tab that opened it, which
// finishes the link. Without a popup, it finishes here and returns to `returnTo`.
// What Hackatime sent back, and the connection this browser has in flight.
// Read on the first render: AuthProvider strips ?code= from the URL once the
// Supabase session loads.
function readArrival() {
    const params = new URLSearchParams(window.location.search);
    return {
        code: params.get("code"),
        state: params.get("state"),
        denied: Boolean(params.get("error")),
        pending: readPending(),
    };
}

// Failures that are clear before anything is sent (the popup leaves these to
// the tab that opened it).
function earlyFailure({ code, state, denied, pending }) {
    if (pending?.mode === "popup") return null;
    if (!pending || !state) return { name: "failed", message: EXPIRED };
    if (denied || !code) return { name: "failed", message: DENIED, returnTo: pending.returnTo };
    return null;
}

export default function HackatimeCallback() {
    const { session, loading } = useAuth();
    const navigate = useNavigate();
    const [arrival] = useState(readArrival);
    const [phase, setPhase] = useState(() => earlyFailure(arrival) ?? { name: "working" });
    const ran = useRef(false);
    const inPopup = arrival.pending?.mode === "popup";
    const signedOut = !inPopup && !loading && !session && phase.name === "working";

    useEffect(() => {
        if (ran.current) return;
        if (phase.name !== "working") {
            ran.current = true;
            if (!inPopup) clearPending();
            return;
        }
        const { code, state, denied, pending } = arrival;
        if (inPopup) {
            // Not torn down on cleanup: the answer has to reach this page even
            // when a dev re-render runs the effect twice.
            ran.current = true;
            handOff({ code, state, denied }, setPhase);
            return;
        }
        if (loading || !session) return;
        ran.current = true;
        clearPending();
        finishHackatime(code, state, pending.state).then(
            () => navigate(pending.returnTo || "/home", { replace: true }),
            (error) => setPhase({ name: "failed", message: describeHackatimeError(error), returnTo: pending.returnTo }),
        );
    }, [arrival, phase.name, inPopup, loading, session, navigate]);

    const shown = signedOut ? { name: "failed", message: "Log in to Torque, then connect Hackatime again." } : phase;

    return (
        <div className="t-shell grid min-h-screen place-items-center bg-(--bg) px-4 py-10">
            <title>Torque - Connecting Hackatime</title>
            <div className="t-bg fixed inset-0 z-0" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-(--overlay)" />

            <main className="t-card relative z-10 flex w-full max-w-md flex-col items-start gap-4 px-6 py-8 text-(--text)! sm:px-8">
                <Status phase={shown} />
            </main>
        </div>
    );
}

function Status({ phase }) {
    if (phase.name === "working") {
        return (
            <div role="status" className="flex flex-col items-start gap-4">
                <LoaderCircle aria-hidden="true" className="size-8 text-(--accent) motion-safe:animate-spin" />
                <h1 className="[font-family:var(--heading-font)] text-3xl font-bold">Connecting Hackatime</h1>
                <p className="leading-relaxed text-(--text)/85">Finishing up, this only takes a moment.</p>
            </div>
        );
    }

    if (phase.name === "connected") {
        return (
            <div role="status" className="flex flex-col items-start gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-(--accent) text-(--btn-text)">
                    <Check aria-hidden="true" className="size-6" strokeWidth={3} />
                </span>
                <h1 className="[font-family:var(--heading-font)] text-3xl font-bold">Hackatime connected</h1>
                <p className="leading-relaxed text-(--text)/85">You can close this window and carry on in Torque.</p>
                <button type="button" onClick={() => window.close()} className={`${BTN_PRIMARY} mt-2`}>Close window</button>
            </div>
        );
    }

    return (
        <div role="alert" className="flex flex-col items-start gap-4">
            <CircleAlert aria-hidden="true" className="size-8 text-(--accent)" />
            <h1 className="[font-family:var(--heading-font)] text-3xl font-bold">Hackatime isn't connected</h1>
            <p className="leading-relaxed text-(--text)/85">{phase.message}</p>
            {phase.inPopup ? (
                <button type="button" onClick={() => window.close()} className={`${BTN_OUTLINE} mt-2`}>Close window</button>
            ) : (
                <Link to={phase.returnTo || "/home"} replace className={`${BTN_PRIMARY} mt-2`}>Back to Torque</Link>
            )}
        </div>
    );
}

// Popup: pass what Hackatime sent to the opening tab and wait for its answer.
// Closes itself on success; stays open to explain anything else.
function handOff(message, setPhase) {
    const channel = new BroadcastChannel(CHANNEL);
    const timeout = setTimeout(() => {
        channel.close();
        setPhase({ name: "failed", inPopup: true, message: "Couldn't reach the Torque tab that opened this window. Keep it open, then connect Hackatime again from there." });
    }, 15000);

    channel.onmessage = ({ data }) => {
        if (data?.type !== "done") return;
        clearTimeout(timeout);
        channel.close();
        if (data.ok) {
            setPhase({ name: "connected" });
            window.close();
        } else {
            setPhase({ name: "failed", inPopup: true, message: data.message || DENIED });
        }
    };
    channel.postMessage({ type: "callback", ...message });
}
