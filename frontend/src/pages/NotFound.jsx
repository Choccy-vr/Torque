import { Link, useLocation } from "react-router-dom";
import { BTN_PRIMARY } from "../components/Form.jsx";
import { Path, StatusFrame, StatusMessage } from "../components/StatusScreen.jsx";
import { useAuth } from "../lib/useAuth.js";
import droveOff from "../assets/status/drove-off.webp";

// Any path no route claims. Standalone like the other status pages: no app
// navigation, just one way back (home, or the dashboard when signed in).
export default function NotFound() {
    const { pathname } = useLocation();
    const { session } = useAuth();

    return (
        <StatusFrame title="Page not found">
            <StatusMessage
                art={{ src: droveOff, alt: "Orpheus the dinosaur driving a little motorized car away with a remote control", width: 760, height: 369, drive: true }}
                title="This page drove off"
                actions={
                    <Link to={session ? "/home" : "/"} className={BTN_PRIMARY}>
                        {session ? "Back to your dashboard" : "Go to the homepage"}
                    </Link>
                }
            >
                <p>
                    There's nothing at <Path>{pathname}</Path>. The link might have a typo, or the page has moved.
                </p>
            </StatusMessage>
        </StatusFrame>
    );
}
