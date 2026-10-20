import { Clock, LoaderCircle } from "lucide-react";
import { useConnectHackatime } from "../lib/hackatime.js";
import { BTN_OUTLINE, FieldError } from "./Form.jsx";

// "Connect Hackatime": opens Hackatime to approve access, and calls
// `onConnected` once the account is linked. Failures show right under it.
// `center` lines it up under centered copy (the dashboard's empty state).
export default function ConnectHackatime({ onConnected, center = false }) {
    const { connect, waiting, error } = useConnectHackatime(onConnected);

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
