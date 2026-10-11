import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, Ship } from "lucide-react";
import { createShip } from "../../lib/endpoints.js";
import { formatHours } from "../../lib/projects.js";
import { BTN_GHOST, BTN_PRIMARY, Field, FOCUS, FormError, INPUT } from "../Form.jsx";
import { errorText, useRevealOnMount } from "../../lib/forms.js";

const KINDS = [
    { build: false, title: "Design ship", body: "Design's done. Ask for a parts grant." },
    { build: true, title: "Build ship", body: "It's built and it moves. Hours become Volts." },
];

const TEXT_LINK = `rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 hover:bg-white/10 ${FOCUS}`;

// Ship (submit for review), opened from the project card. Design vs build is
// always the builder's call. The page only opens this once there's an hour of
// uncredited journal time to ship.
export default function ShipForm({ project, designApproved, onEdit, onShipped, onCancel }) {
    const headingRef = useRevealOnMount();
    const [build, setBuild] = useState(designApproved);
    const [funding, setFunding] = useState("");
    const [answers, setAnswers] = useState({ howDidYouHear: "", whatAreWeDoingWell: "", howCanWeImprove: "" });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    // The journaled hours no approved ship has credited yet; the server has the
    // exact figure, this is close enough to size a grant by.
    const unpaid = Math.max(0, Math.round(((project.totalHours ?? 0) - (project.totalHoursApproved ?? 0)) * 10) / 10);
    const grantCap = Math.floor(unpaid * 5);
    const overCap = !build && Number(funding) > grantCap;

    const answer = (key) => (e) => setAnswers((a) => ({ ...a, [key]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        const requestedFunding = build ? 0 : Number(funding || 0);
        if (!Number.isInteger(requestedFunding) || requestedFunding < 0) {
            return setError("Requested funding needs to be a whole number of dollars.");
        }
        setSending(true);
        setError(null);
        try {
            await createShip({
                projectId: project.id,
                isBuildComplete: build,
                requestedFunding,
                howDidYouHear: answers.howDidYouHear.trim(),
                whatAreWeDoingWell: answers.whatAreWeDoingWell.trim(),
                howCanWeImprove: answers.howCanWeImprove.trim(),
            });
            onShipped();
        } catch (err) {
            setError(errorText(err));
            setSending(false);
        }
    }

    return (
        <form
            id="ship-form"
            onSubmit={submit}
            aria-labelledby="ship-title"
            className="t-card flex flex-col gap-6 px-5 py-6 text-(--text) sm:px-8 sm:py-7"
        >
            <div className="flex flex-col gap-1.5">
                <h2 id="ship-title" ref={headingRef} tabIndex={-1} className="scroll-mt-14 [font-family:var(--heading-font)] text-3xl font-bold text-(--text) outline-none">
                    Ship it
                </h2>
                <p className="max-w-[65ch] leading-relaxed text-(--text)/85">
                    You're shipping <b className="font-bold text-(--text) tabular-nums">{formatHours(unpaid)}</b> of journaled time.{" "}
                    <Link to="/docs/shipping/shipping-guidelines" className={TEXT_LINK}>Shipping guidelines</Link>
                </p>
            </div>

            {!project.repoUrl && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 border-(--accent) bg-(--accent)/15 px-4 py-2 leading-relaxed text-(--text)">
                    <span className="flex items-start gap-2">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                        No repository linked yet. Reviewers need a public repo.
                    </span>
                    <button type="button" onClick={onEdit} className={`-my-1 inline-flex min-h-11 items-center rounded-(--radius) px-3 ${TEXT_LINK}`}>
                        Add one
                    </button>
                </p>
            )}

            <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">What are you shipping?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                    {KINDS.map((kind) => (
                        <label
                            key={kind.title}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-white/15 px-4 py-3 transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                        >
                            <input
                                type="radio"
                                name="ship-kind"
                                checked={build === kind.build}
                                onChange={() => setBuild(kind.build)}
                                className="mt-1 size-4.5 shrink-0 accent-(--accent)"
                            />
                            <span className="flex flex-col">
                                <span className="font-bold text-(--text)">{kind.title}</span>
                                <span className="text-sm leading-relaxed text-(--text)/85">{kind.body}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {!build && (
                <Field label="Grant you're asking for" hint={`$5 per design hour, so up to about $${grantCap.toLocaleString()}. Put 0 if you're paying for parts yourself.`}>
                    {(p) => (
                        <div className="flex flex-col gap-2">
                            <div className="relative max-w-56">
                                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-(--text)/85">$</span>
                                <input {...p} type="number" min={0} step={1} inputMode="numeric" placeholder="0" value={funding} onChange={(e) => setFunding(e.target.value)} aria-invalid={overCap} className={`${INPUT} pl-8 tabular-nums`} />
                            </div>
                            {overCap && (
                                <p className="flex items-start gap-2 text-sm leading-relaxed text-(--text)">
                                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
                                    That's more than $5 for each hour you're shipping (about ${grantCap.toLocaleString()}).
                                </p>
                            )}
                        </div>
                    )}
                </Field>
            )}

            <fieldset className="flex flex-col gap-5 border-t-2 border-white/15 pt-6">
                <legend className="float-left mb-1 w-full text-sm font-bold text-(--text)/85">Quick feedback for us</legend>
                <Field label="How did you hear about Torque?">
                    {(p) => <input {...p} required value={answers.howDidYouHear} onChange={answer("howDidYouHear")} className={INPUT} />}
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="What are we doing well?">
                        {(p) => <textarea {...p} required rows={3} value={answers.whatAreWeDoingWell} onChange={answer("whatAreWeDoingWell")} className={`${INPUT} resize-y leading-relaxed`} />}
                    </Field>
                    <Field label="How can we improve?">
                        {(p) => <textarea {...p} required rows={3} value={answers.howCanWeImprove} onChange={answer("howCanWeImprove")} className={`${INPUT} resize-y leading-relaxed`} />}
                    </Field>
                </div>
            </fieldset>

            <FormError>{error}</FormError>

            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={sending} className={BTN_PRIMARY}>
                    <Ship aria-hidden="true" className="size-4.5" />
                    {sending ? "Shipping…" : build ? "Ship the build" : "Ship the design"}
                </button>
                <button type="button" onClick={onCancel} disabled={sending} className={BTN_GHOST}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
