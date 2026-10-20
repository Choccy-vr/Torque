import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LoaderCircle } from "lucide-react";
import { connectHackatime, describeHackatimeError, useHackatimeResult } from "../lib/hackatime.js";
import { BTN_OUTLINE, FieldError } from "./Form.jsx";

// "Connect Hackatime": opens Hackatime to approve access, and calls
// `onConnected` once the account is linked. Failures show right under it.
// `center` lines it up under centered copy (the dashboard's empty state).
export default function ConnectHackatime({ onConnected, center = false }) {
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState(null);
    const watchRef = useRef(null);

    const stopWatching = () => clearInterval(watchRef.current);
    useEffect(() => stopWatching, []);

    useHackatimeResult(useCallback((result) => {
        stopWatching();
        setWaiting(false);
        if (result.ok) onConnected?.();
        else setError(result.message);
    }, [onConnected]));

    async function connect() {
        if (waiting) return;
        setError(null);
        setWaiting(true);
        try {
            const popup = await connectHackatime();
            // Closing the popup without finishing just puts the button back.
            watchRef.current = setInterval(() => {
                if (popup.closed) { stopWatching(); setWaiting(false); }
            }, 500);
        } catch (e) {
            setWaiting(false);
            setError(describeHackatimeError(e));
        }
    }

    return (
        <div className={`flex flex-col gap-2 ${center ? "items-center text-left" : "items-start"}`}>
            <button type="button" onClick={connect} aria-disabled={waiting || undefined} className={`${BTN_OUTLINE} aria-disabled:cursor-wait`}>
                {waiting
                    ? <LoaderCircle aria-hidden="true" className="size-5 shrink-0 motion-safe:animate-spin" />
                    : <Clock aria-hidden="true" className="size-5 shrink-0" />}
                {waiting ? "Waiting for Hackatime…" : "Connect Hackatime"}
            </button>
            <div aria-live="polite" className={center ? "max-w-xs" : undefined}>
                <FieldError>{error}</FieldError>
            </div>
        </div>
    );
}
