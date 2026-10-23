import { useState } from "react";
import { Hand, LogOut } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY } from "../components/Form.jsx";
import SlackIcon from "../components/SlackIcon.jsx";
import { StatusFrame, StatusMessage } from "../components/StatusScreen.jsx";
import { useAuth } from "../lib/useAuth.js";

// Who a banned builder should talk to. A red Hackatime account is Hack Club's
// Fraud Squad's call (they only take appeals by DM, per fraud.hackclub.com);
// anything else is Torque's own.
const FRAUD_SQUAD_DM = "https://hackclub.slack.com/team/U091HC53CE8";
const GINOBEANO_DM = "https://hackclub.slack.com/team/U08U12MNF97";

const COPY = {
    hackatime: {
        what: "Your linked Hackatime account got flagged, so your Torque account is banned too.",
        who: <>Hackatime bans are the Fraud Squad's call, not ours. Think they got it wrong? DM them on Slack.</>,
        contact: { href: FRAUD_SQUAD_DM, label: "DM the Fraud Squad" },
    },
    other: {
        what: "Your Torque account has been banned.",
        who: <>Think we got it wrong? DM @Ginobeano on Slack and we'll take a look.</>,
        contact: { href: GINOBEANO_DM, label: "DM @Ginobeano" },
    },
};

// Shown instead of the app to a signed-in user whose account is banned (see
// RequireOnboarding). Playful, but still says what happened, what it means,
// and who can lift it. `reason` comes from api/user/me/banned. The docs stay
// readable.
export default function Banned({ reason }) {
    const { signOut } = useAuth();
    const [leaving, setLeaving] = useState(false);
    const copy = COPY[reason] ?? COPY.other;

    async function logOut() {
        setLeaving(true);
        await signOut();
        window.location.assign("/");
    }

    return (
        <StatusFrame title="Account banned">
            <StatusMessage
                icon={Hand}
                iconMotion="t-wag"
                title="Naughty, naughty."
                actions={
                    <>
                        <a href={copy.contact.href} target="_blank" rel="noreferrer" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                            <SlackIcon className="size-4.5" />
                            {copy.contact.label}
                            <span className="sr-only"> (opens Slack in a new tab)</span>
                        </a>
                        <button type="button" onClick={logOut} disabled={leaving} className={`${BTN_GHOST} w-full sm:w-auto`}>
                            <LogOut aria-hidden="true" className="size-5" />
                            {leaving ? "Logging out…" : "Log out"}
                        </button>
                    </>
                }
            >
                <p>
                    {copy.what} No journaling, shipping or shop orders for now.
                </p>
                <p>{copy.who}</p>
            </StatusMessage>
        </StatusFrame>
    );
}
