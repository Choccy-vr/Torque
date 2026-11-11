import { Link } from "react-router-dom";
import AppShell, { PageHeader } from "../AppShell.jsx";
import { Empty, InlineError } from "../PageParts.jsx";
import { BTN_PRIMARY } from "../Form.jsx";
import { getMyProfile } from "../../lib/endpoints.js";
import { isReviewer } from "../../lib/settings.js";
import { useApi } from "../../lib/useApi.js";

// Frame for every /review page: the "Review" title and the reviewers-only
// gate. `children` only mounts for reviewers, so its requests never run (and
// 403) for anyone else. Admins need the reviewer role too: the review
// endpoints only check for it.
export default function ReviewShell({ title, lede, children }) {
    const me = useApi(getMyProfile);

    return (
        <AppShell title={`Review · ${title}`}>
            <PageHeader title="Review" lede={lede} />

            <div className="mt-8">
                {me.loading ? (
                    <div aria-busy="true" aria-label="Loading" className="t-card h-64 motion-safe:animate-pulse text-(--text)!" />
                ) : me.error ? (
                    <InlineError what="your profile" onRetry={me.reload} />
                ) : !isReviewer(me.data) ? (
                    <Empty title="Reviewers only" action={<Link to="/home" className={BTN_PRIMARY}>Back to the dashboard</Link>}>
                        Reviewing ships needs the reviewer role. Ask an admin to add it to your account.
                    </Empty>
                ) : (
                    children
                )}
            </div>
        </AppShell>
    );
}
