import { useState } from "react";
import { BookOpen, LogOut, ShieldBan } from "lucide-react";
import { BTN_GHOST, BTN_OUTLINE } from "../components/Form.jsx";
import { StatusFrame, StatusMessage } from "../components/StatusScreen.jsx";
import { useAuth } from "../lib/useAuth.js";

// Where's the team? The #torque channel, same link as the docs.
const SLACK_CHANNEL = "https://hackclub.enterprise.slack.com/archives/C0BHGT33JHH";

// Shown instead of the app to a signed-in user whose account is banned (see
// RequireOnboarding). Plain and calm: say what happened, what it means, and
// who to talk to. The docs stay readable.
export default function Banned() {
    const { user, signOut } = useAuth();
    const who = [user?.name, user?.email].filter(Boolean).join(" · ");
    const [leaving, setLeaving] = useState(false);

    async function logOut() {
        setLeaving(true);
        await signOut();
        window.location.assign("/");
    }

    return (
        <StatusFrame title="Account banned">
            <StatusMessage
                icon={ShieldBan}
                title="Your account is banned"
                actions={
                    <>
                        <button type="button" onClick={logOut} disabled={leaving} className={BTN_OUTLINE}>
                            <LogOut aria-hidden="true" className="size-5" />
                            {leaving ? "Logging out…" : "Log out"}
                        </button>
                        <a href="/docs/projects/project-guidelines" className={BTN_GHOST}>
                            <BookOpen aria-hidden="true" className="size-5" />
                            Project guidelines
                        </a>
                    </>
                }
            >
                <p>
                    While your account is banned, you can't use Torque: no journaling, shipping or editing projects.
                </p>
                <p>
                    If you think this is a mistake, message the Torque team in{" "}
                    <a
                        href={SLACK_CHANNEL}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-colors duration-300 ease hover:bg-white/10"
                    >
                        #torque on Slack
                    </a>{" "}
                    and include the account below.
                </p>
                {who && (
                    <p className="w-fit rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-2 text-base break-all text-(--text)">
                        <span className="text-(--text)/75">Signed in as </span>{who}
                    </p>
                )}
            </StatusMessage>
        </StatusFrame>
    );
}
