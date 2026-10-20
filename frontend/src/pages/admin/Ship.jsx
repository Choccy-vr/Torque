import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Hammer, PencilRuler, Sparkles } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { BackLink, CopyId, EntityTitle, Facts, NotFoundNote, Panel, Tag } from "../../components/admin/AdminParts.jsx";
import { InlineError } from "../../components/PageParts.jsx";
import { FOCUS } from "../../components/Form.jsx";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import { getAdminShip } from "../../lib/endpoints.js";
import { ADMIN_SHIP_STATUS, formatDay, formatWhen, isSet } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

const LINK = `font-medium text-(--text) underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-colors duration-300 ease hover:decoration-(--accent) ${FOCUS}`;
const hours = (h) => `${Number((h ?? 0).toFixed(2))}h`;

// ShipmentReviewStatus -> label. "returned" isn't used yet but may come back.
const REVIEW_STATUS = {
    approved: { label: "Approved" },
    rejected: { label: "Rejected" },
    perm_rejected: { label: "Perm rejected" },
    returned: { label: "Returned" },
    changes_needed: { label: "Changes needed" },
};

// /admin/ships/:id — one ship: what was shipped, what it paid, where it is
// in the Airtable pipeline, the shipper's answers and every review.
export default function AdminShip() {
    const { id } = useParams();
    return (
        <AdminShell title="Ship">
            <ShipDetail key={id} id={id} />
        </AdminShell>
    );
}

function ShipDetail({ id }) {
    const fetchShip = useCallback(() => getAdminShip(id), [id]);
    const api = useApi(fetchShip);
    const s = api.data;

    if (api.error) {
        return (
            <div className="flex flex-col gap-4">
                <BackLink to="/admin/ships">Ships</BackLink>
                {api.error.status === 404
                    ? <NotFoundNote>No ship with this id.</NotFoundNote>
                    : <InlineError what="this ship" onRetry={api.reload} />}
            </div>
        );
    }
    if (!s) return <div aria-busy="true" aria-label="Loading ship" className="t-card h-96 motion-safe:animate-pulse text-(--text)!" />;

    const Kind = s.isBuildComplete ? Hammer : PencilRuler;
    const answers = [
        ["How did you hear about Torque?", s.howDidYouHear],
        ["What are we doing well?", s.whatAreWeDoingWell],
        ["How can we improve?", s.howCanWeImprove],
    ];

    return (
        <div className="flex flex-col gap-6">
            <BackLink to="/admin/ships">Ships</BackLink>

            <section aria-labelledby="ship-title" className="t-card flex flex-col gap-6 px-5 py-6 text-(--text)! sm:px-8 sm:py-8">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <ProjectStatusBadge status={s.status} statuses={ADMIN_SHIP_STATUS} />
                        <Tag><Kind aria-hidden="true" className="size-3.5" />{s.isBuildComplete ? "Build ship" : "Design ship"}</Tag>
                        {s.finalApprovedAt && <Tag>Final approved</Tag>}
                    </div>
                    <EntityTitle id="ship-title" kind={s.isBuildComplete ? "Build ship" : "Design ship"}>{s.projectTitle || "Untitled project"}</EntityTitle>
                    <p className="text-(--text)/85">
                        <Link to={`/admin/projects/${s.projectId}`} className={LINK}>Project</Link>
                        {" · shipped by "}
                        <Link to={`/admin/users/${s.userId}`} className={LINK}>{s.username || "unknown"}</Link> on {formatWhen(s.createdAt)}
                    </p>
                </div>

                <Facts
                    items={[
                        ["Hours shipped", hours(s.hourSnapshot)],
                        s.overrideHours > 0 && ["Reviewer's hours", hours(s.overrideHours)],
                        ["Hours credited", s.finalApprovedAt ? hours(s.approvedHours) : null],
                        s.isBuildComplete && ["Hours paid as Volts", s.finalApprovedAt ? hours(s.paidHours) : null],
                        s.isBuildComplete && ["Volts / hour", s.voltsPerHour > 0 ? Number(s.voltsPerHour).toFixed(2) : null],
                        ["Volts paid", s.voltsGranted.toLocaleString()],
                        !s.isBuildComplete && ["Grant asked for", s.requestedFunding > 0 ? `$${s.requestedFunding.toLocaleString()}` : null],
                        ["Level at ship", s.overrideTier > 0 ? `${s.tierSnapshot} → ${s.overrideTier} (reviewer)` : s.tierSnapshot],
                        ["Reviewed", isSet(s.reviewedAt) ? formatWhen(s.reviewedAt) : null],
                        ["Pushed to Airtable", s.airtablePushedAt ? formatWhen(s.airtablePushedAt) : null],
                        ["Airtable record", s.airtableRecordId ? <CopyId value={s.airtableRecordId} /> : null],
                        ["Final approval", s.finalApprovedAt ? formatWhen(s.finalApprovedAt) : null],
                        ["Ship id", <CopyId value={s.id} />],
                    ]}
                />

                {/* The latest review already shows its feedback; only repeat it when there's no review. */}
                {((s.feedback && s.reviews.length === 0) || s.reviewerNote) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {s.feedback && s.reviews.length === 0 && <Quote title="Feedback to the builder">{s.feedback}</Quote>}
                        {s.reviewerNote && <Quote title="Reviewer note (staff only)">{s.reviewerNote}</Quote>}
                    </div>
                )}
            </section>

            <Panel id="answers" title="Shipper's answers">
                <dl className="flex flex-col divide-y-2 divide-white/10">
                    {answers.map(([q, a]) => (
                        <div key={q} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                            <dt className="text-sm font-bold">{q}</dt>
                            <dd className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">
                                {a || <span className="text-(--text)/60">No answer</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Panel>

            <Panel id="reviews" title={`Reviews${s.reviews.length ? ` (${s.reviews.length})` : ""}`}>
                {s.reviews.length === 0 ? (
                    <p className="text-(--text)/85">Nobody has reviewed this ship yet.</p>
                ) : (
                    <ol className="flex flex-col gap-4">
                        {s.reviews.map((r) => <Review key={r.id} review={r} />)}
                    </ol>
                )}
            </Panel>
        </div>
    );
}

function Review({ review: r }) {
    const fields = [
        ["Feedback to the builder", r.feedback],
        ["Internal note", r.internalNote],
        ["Technical features", r.technicalFeatures],
        ["Why the hours changed", r.overrideJustification],
        ["Deflation justification", r.deflationJustification],
        ["Anything else", r.additionalJustification],
    ].filter(([, v]) => v);

    return (
        <li className="flex flex-col gap-4 rounded-2xl border-2 border-white/10 bg-(--bg)/30 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ProjectStatusBadge status={r.status} statuses={REVIEW_STATUS} />
                {r.exceptional && <Tag><Sparkles aria-hidden="true" className="size-3.5" />Exceptional</Tag>}
                <span className="text-sm text-(--text)/85">
                    by <Link to={`/admin/users/${r.reviewerId}`} className={LINK}>{r.reviewerUsername || "a reviewer"}</Link>
                    {r.hideReviewerName && " (name hidden from the builder)"} · {formatDay(r.createdAt)}
                </span>
            </div>
            {fields.length > 0 && (
                <dl className="flex flex-col gap-3">
                    {fields.map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-0.5">
                            <dt className="text-sm font-bold">{label}</dt>
                            <dd className="max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {r.screenshotUrl && (
                <a href={r.screenshotUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 self-start ${LINK}`}>
                    Screenshot
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                    <span className="sr-only">(opens in a new tab)</span>
                </a>
            )}
        </li>
    );
}

function Quote({ title, children }) {
    return (
        <div className="flex flex-col gap-1 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 sm:px-5">
            <p className="text-sm font-bold">{title}</p>
            <p className="leading-relaxed whitespace-pre-line break-words text-(--text)/90">{children}</p>
        </div>
    );
}
