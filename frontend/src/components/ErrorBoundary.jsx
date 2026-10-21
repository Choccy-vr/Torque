import { Component } from "react";
import { RotateCw } from "lucide-react";
import { BTN_OUTLINE, BTN_PRIMARY } from "./Form.jsx";
import { StatusFrame, StatusMessage } from "./StatusScreen.jsx";
import fixing from "../assets/status/fixing.webp";

// Catches a page that throws while rendering (a bug, or a code chunk that
// went missing after a deploy) and shows a way out instead of a blank screen.
// Give it a `resetKey` (the path) so moving to another page tries again.
export default class ErrorBoundary extends Component {
    state = { error: null, resetKey: this.props.resetKey };

    static getDerivedStateFromError(error) {
        return { error };
    }

    static getDerivedStateFromProps(props, state) {
        return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
    }

    componentDidCatch(error, info) {
        console.error(error, info.componentStack);
    }

    render() {
        return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
    }
}

// Plain links rather than the router's: whatever broke may be in there too.
function CrashScreen({ error }) {
    return (
        <StatusFrame title="Something broke">
            <StatusMessage
                art={{ src: fixing, alt: "Orpheus the dinosaur fixing a small motor with a screwdriver", width: 560, height: 540 }}
                title="Something came loose"
                actions={
                    <>
                        <button type="button" onClick={() => window.location.reload()} className={BTN_PRIMARY}>
                            <RotateCw aria-hidden="true" className="size-5" />
                            Reload the page
                        </button>
                        <a href="/" className={BTN_OUTLINE}>Back to Torque</a>
                    </>
                }
                details={error?.message && (
                    <details className="group mt-2 w-full text-sm text-(--text)/80">
                        <summary className="-ml-2 inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-base font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 marker:content-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text)">
                            Error details
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-2xl border-2 border-white/10 bg-(--bg)/70 p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{error.message}</pre>
                    </details>
                )}
            >
                <p>This page hit a bug and stopped. Reloading usually fixes it.</p>
                <p>
                    If it keeps happening, post in{" "}
                    <a
                        href="https://hackclub.enterprise.slack.com/archives/C0BHGT33JHH"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-colors duration-300 ease hover:bg-white/10"
                    >
                        #torque on Slack
                    </a>{" "}
                    with what you were doing and the error details below.
                </p>
            </StatusMessage>
        </StatusFrame>
    );
}
