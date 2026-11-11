import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleCheck, Hammer, Lock, PencilRuler, UserCheck } from "lucide-react";
import ReviewShell from "../../components/review/ReviewShell.jsx";
import { ResultList, ResultRow, Tag } from "../../components/admin/AdminParts.jsx";
import { Notice } from "../../components/PageParts.jsx";
import { getReviewQueue } from "../../lib/endpoints.js";
import { formatDay } from "../../lib/projects.js";
import { formatClock, hoursLabel, waitingFor } from "../../lib/review.js";
import { useApi } from "../../lib/useApi.js";

// /review: every ship waiting for its first-pass review, oldest first, with
// who's already on it.
export default function ReviewQueue() {
    // Set by the review page after a review goes through.
    const { state } = useLocation();
    return (
        <ReviewShell title="Queue" lede="Ships waiting for a first-pass review, oldest first. Claim one to start; a claim holds for an hour.">
            <div className="flex flex-col gap-6">
                {state?.reviewed && (
                    <Notice icon={CircleCheck}>
                        Review sent for <b className="font-bold text-(--text)">{state.reviewed}</b>. Next one's below.
                    </Notice>
                )}
                <Queue />
            </div>
        </ReviewShell>
    );
}

function Queue() {
    const queue = useApi(getReviewQueue);
    // "Waiting 2 days" is worked out from when the page opened.
    const [now] = useState(() => Date.now());

    return (
        <ResultList
            api={queue}
            label="ships to review"
            cap={Infinity}
            empty={{ title: "Queue's clear", text: "No ships are waiting for review. New ones show up here the moment a builder ships." }}
        >
            {(s) => {
                const Kind = s.isBuildComplete ? Hammer : PencilRuler;
                return (
                    <ResultRow
                        key={s.id}
                        to={`/review/${s.id}`}
                        lead={
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] border-2 border-white/15 bg-(--bg)/45">
                                <Kind aria-hidden="true" className="size-4.5 text-(--text)/85" />
                            </span>
                        }
                        title={`${s.isBuildComplete ? "Build" : "Design"} ship · ${s.projectTitle || "Untitled project"}`}
                        meta={[s.username || "unknown builder", `Shipped ${formatDay(s.createdAt)}`, hoursLabel(s.hourSnapshot), s.tierSnapshot > 0 && `Level ${s.tierSnapshot}`].filter(Boolean).join(" · ")}
                        trail={
                            <>
                                {s.claimedByMe ? (
                                    <Tag accent><UserCheck aria-hidden="true" className="size-3.5" />You're reviewing</Tag>
                                ) : s.claimedBy ? (
                                    <Tag><Lock aria-hidden="true" className="size-3.5" />{s.claimedByUsername || "Claimed"} until {formatClock(s.claimExpiresAt)}</Tag>
                                ) : null}
                                {!s.isBuildComplete && s.requestedFunding > 0 && <span>${s.requestedFunding.toLocaleString()} asked</span>}
                                <span>Waiting {waitingFor(s.createdAt, now)}</span>
                            </>
                        }
                    />
                );
            }}
        </ResultList>
    );
}
