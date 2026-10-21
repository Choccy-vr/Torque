import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock, LoaderCircle } from "lucide-react";
import { useOutletContext } from 'react-router-dom'
import { completeOnboarding, getHackatimeStatus, getMyProfile, joinSlackChannels, setMyTimeZone } from '../lib/endpoints.js'
import { useConnectHackatime } from '../lib/hackatime.js'
import { cityOf, detectTimeZone, offsetOf, regionOf, timeIn, timeZonesByRegion } from '../lib/timezone.js'
import { BTN_GHOST, BTN_PRIMARY, Field, FieldError, FormError, INPUT } from './Form.jsx'

const steps = [
    {
        label: "Profile",
        title: "Profile information",
        description: "Pick a username, bio, and profile picture that will show up to people who view your profile.",
    },
    {
        label: "Hackatime",
        title: "Hackatime setup",
        description: "Link Hackatime so the time you spend coding (and the Lapse sessions that feed into it) gets tracked.",
    },
    {
        label: "Slack",
        title: "Join our community on Slack",
    },
    {
        label: "Timezone",
        title: "Where's your midnight?",
        description: "Your streak day runs from midnight to midnight in your timezone, so a late-night session counts for the right day.",
    },
];

const TIMEZONE_STEP = steps.length;

// Matches the backend's rule (api/user/me/onboarding).
const USERNAME_HINT = "3–30 characters: letters, numbers, _ or -.";

// A big pick-one choice, drawn as a pill-cornered card: coral edge and wash
// when chosen.
const CHOICE = `flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-white/15 px-4 py-3 text-center font-semibold text-(--text) transition-all duration-300 ease hover:border-white/30 hover:bg-white/5 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)`;

const WELL = "rounded-2xl border-2 border-white/10 bg-(--bg)/45 p-5";

export default function Onboarding({ onComplete = () => { } }) {
    const { markOnboarded } = useOutletContext() ?? {}

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [timeZoneError, setTimeZoneError] = useState('')
    const [page, setPage] = useState(1);
    const [hackatimeConnected, setHackatimeConnected] = useState(false)
    const onHackatimeConnected = useCallback(() => setHackatimeConnected(true), [])
    const hackatime = useConnectHackatime(onHackatimeConnected)
    const [detected] = useState(detectTimeZone)
    // The zone the account already has; it can only be set once.
    const [savedTimeZone, setSavedTimeZone] = useState(null)
    const [formData, setFormData] = useState({
        username: "",
        bio: "",
        profilePicture: null,
        slackInvite: null,
        // "detected" or "other"; null until they answer.
        timeZoneChoice: null,
        timeZone: detected,
    })

    // Fill in whatever the account already has, without overwriting typing.
    useEffect(() => {
        getMyProfile()
            .then((profile) => {
                setFormData((prev) => ({
                    ...prev,
                    username: prev.username || profile.username || "",
                    bio: prev.bio || profile.bio || "",
                    profilePicture: prev.profilePicture ?? profile.profilePictureUrl ?? null,
                }))
                if (profile.timeZone) setSavedTimeZone(profile.timeZone)
            })
            .catch(() => { })
        getHackatimeStatus()
            .then(({ connected }) => { if (connected) setHackatimeConnected(true) })
            .catch(() => { })
    }, [])

    // The form remounts per step, which drops focus; hand it to the new step's
    // heading so keyboard and screen-reader users land on what changed. Step 1
    // starts in the username field instead.
    const titleRef = useRef(null)
    const firstRender = useRef(true)
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return }
        titleRef.current?.focus()
    }, [page])

    const isFirstPage = page === 1;
    const isLastPage = page === steps.length;
    const currentStep = steps[page - 1];
    const progress = (page / steps.length) * 100;

    function updateField(e) {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    function nextPage(e) {
        e.preventDefault();

        if (page < steps.length) {
            setPage((prev) => prev + 1);
        }
    }

    function previousPage(e) {
        e.preventDefault();

        if (!isFirstPage) {
            setPage((prev) => prev - 1);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        setTimeZoneError('')

        // Timezone first: it's one-time, so a retry after a later failure just
        // gets a 409, which means it's already in place.
        if (!savedTimeZone) {
            const zone = formData.timeZoneChoice === "other" ? formData.timeZone : detected
            try {
                await setMyTimeZone(zone)
                setSavedTimeZone(zone)
            } catch (err) {
                if (err.status !== 409) {
                    setSaving(false)
                    if (err.status === 400) {
                        // The server doesn't know this zone; open the list so they can pick a neighbour.
                        setFormData((prev) => ({ ...prev, timeZoneChoice: "other", timeZone: zone }))
                        setTimeZoneError("That timezone isn't on our list. Pick the nearest city in the same timezone.")
                    } else {
                        setTimeZoneError(err.status
                            ? "Couldn't save your timezone. Try again in a moment."
                            : "Couldn't reach the server. Check your connection and try again.")
                    }
                    return
                }
            }
        }

        try {
            await completeOnboarding({
                username: formData.username,
                bio: formData.bio,
                profilePictureUrl: formData.profilePicture ?? "",
            })
        } catch (err) {
            setSaving(false)
            // A taken or invalid username is fixed on the first step.
            if (err.status === 400 || err.status === 409) setPage(1)
            setError(err.status ? err.message : "Couldn't reach the server. Check your connection and try again.")
            return
        }

        // Slack invites are a bonus: a failure here mustn't trap someone in onboarding.
        if (formData.slackInvite) {
            await joinSlackChannels().catch((err) => console.error(err))
        }

        setSaving(false)
        markOnboarded?.()
        onComplete(formData)
    }

    return (
        <div className="t-shell fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-8">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-title"
                className="t-card relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden text-(--text)!"
            >
                <div
                    role="progressbar"
                    aria-label="Setup progress"
                    aria-valuemin={1}
                    aria-valuemax={steps.length}
                    aria-valuenow={page}
                    aria-valuetext={`Step ${page} of ${steps.length}: ${currentStep.label}`}
                    className="h-1 w-full shrink-0 bg-(--accent)/15"
                >
                    <div
                        className="h-full bg-(--accent) transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <form
                    key={page}
                    onSubmit={isLastPage ? handleSubmit : nextPage}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="t-scroll min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-12 sm:py-10">
                        <div className="mx-auto w-full max-w-lg">
                            <div className="mb-7">
                                <ol className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                    {steps.map((step, i) => (
                                        <li key={step.label} className="flex items-center gap-2">
                                            {i > 0 && <ArrowRight aria-hidden="true" className="size-3.5 text-(--text)/60" />}
                                            <span
                                                aria-current={page === i + 1 ? "step" : undefined}
                                                className={page === i + 1
                                                    ? "font-bold text-(--text) underline decoration-(--accent) decoration-2 underline-offset-[6px]"
                                                    : i + 1 < page ? "text-(--text)/85" : "text-(--text)/70"}
                                            >
                                                {step.label}
                                            </span>
                                        </li>
                                    ))}
                                </ol>

                                <h2 id="onboarding-title" ref={titleRef} tabIndex={-1} className="[font-family:var(--heading-font)] text-3xl font-bold text-balance outline-none">
                                    {currentStep.title}
                                </h2>

                                {currentStep.description && (
                                    <p className="mt-3 max-w-[60ch] leading-relaxed text-(--text)/85">
                                        {currentStep.description}
                                    </p>
                                )}
                            </div>

                            {page === 1 && (
                                <div className="flex flex-col gap-5">
                                    <Field label="Username" hint={USERNAME_HINT}>
                                        {(props) => (
                                            <input
                                                {...props}
                                                type="text"
                                                name="username"
                                                required
                                                value={formData.username}
                                                onChange={updateField}
                                                minLength={3}
                                                maxLength={30}
                                                pattern="[A-Za-z0-9_\-]+"
                                                autoComplete="username"
                                                autoFocus
                                                spellCheck={false}
                                                title={USERNAME_HINT}
                                                className={INPUT}
                                                placeholder="orpheus_123"
                                            />
                                        )}
                                    </Field>

                                    <Field label="Bio" optional hint={<span className="tabular-nums">{formData.bio.length}/160</span>}>
                                        {(props) => (
                                            <textarea
                                                {...props}
                                                name="bio"
                                                maxLength={160}
                                                onChange={updateField}
                                                value={formData.bio}
                                                rows={4}
                                                placeholder="What do you like to build?"
                                                className={`${INPUT} resize-none`}
                                            />
                                        )}
                                    </Field>
                                </div>
                            )}

                            {page === 2 && (
                                <div className={`${WELL} flex flex-col items-start gap-3`}>
                                    <p className="leading-relaxed text-(--text)/90">
                                        {hackatimeConnected
                                            ? "Your Hackatime account is linked. You're all set for this step."
                                            : "Hackatime will open so you can approve access."}
                                    </p>
                                    <button
                                        onClick={hackatime.connect}
                                        disabled={hackatimeConnected}
                                        aria-disabled={hackatime.waiting || undefined}
                                        type="button"
                                        className={`${BTN_PRIMARY} aria-disabled:cursor-wait`}
                                    >
                                        {hackatimeConnected ? (
                                            <>
                                                <Check aria-hidden="true" className="size-5" />
                                                Hackatime linked
                                            </>
                                        ) : hackatime.waiting ? (
                                            <>
                                                <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                                                Waiting for Hackatime…
                                            </>
                                        ) : (
                                            "Link Hackatime"
                                        )}
                                    </button>
                                    <div aria-live="polite">
                                        <FieldError>{hackatime.error}</FieldError>
                                    </div>
                                </div>
                            )}

                            {page === 3 && (
                                <fieldset className={WELL}>
                                    <legend className="sr-only">Slack invite</legend>
                                    <p className="font-semibold">
                                        Do you want to be invited to the Torque Slack channels?
                                    </p>
                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {[
                                            { value: true, label: "Yes, invite me" },
                                            { value: false, label: "No thanks" },
                                        ].map(({ value, label }) => (
                                            <label key={label} className={CHOICE}>
                                                <input
                                                    type="radio"
                                                    name="slackInvite"
                                                    required
                                                    checked={formData.slackInvite === value}
                                                    onChange={() => setFormData((prev) => ({ ...prev, slackInvite: value }))}
                                                    className="sr-only"
                                                />
                                                {formData.slackInvite === value && <Check aria-hidden="true" className="size-4" />}
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            )}

                            {page === TIMEZONE_STEP && (
                                savedTimeZone ? (
                                    <div className={WELL}>
                                        <ZoneReadout id={savedTimeZone} lead="Your streak timezone is" />
                                        <p className="mt-4 text-sm leading-relaxed text-(--text)/80">
                                            It's already set, so there's nothing to do here. If it's wrong, ask an admin to change it.
                                        </p>
                                    </div>
                                ) : (
                                    <TimeZonePicker
                                        detected={detected}
                                        choice={formData.timeZoneChoice}
                                        zone={formData.timeZone}
                                        error={timeZoneError}
                                        onChoice={(timeZoneChoice) => { setTimeZoneError(''); setFormData((prev) => ({ ...prev, timeZoneChoice })) }}
                                        onZone={(timeZone) => { setTimeZoneError(''); setFormData((prev) => ({ ...prev, timeZone })) }}
                                    />
                                )
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-t-2 border-white/10">
                        {error && <div className="px-5 pt-4 sm:px-12"><FormError>{error}</FormError></div>}
                        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-12 sm:py-5">
                            <button
                                type="button"
                                onClick={previousPage}
                                disabled={isFirstPage || saving}
                                className={`${BTN_GHOST} disabled:invisible`}
                            >
                                <ArrowLeft aria-hidden="true" className="size-5" />
                                Back
                            </button>

                            <button type="submit" disabled={saving} className={`${BTN_PRIMARY} disabled:cursor-wait`}>
                                {isLastPage ? (
                                    saving ? (
                                        <>
                                            Finishing…
                                            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Finish
                                            <Check aria-hidden="true" className="size-5" />
                                        </>
                                    )
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight aria-hidden="true" className="size-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

// A timezone as a place: the city large, then its region, UTC offset and the
// time there right now, so "is this me?" is answerable at a glance.
function ZoneReadout({ id, lead }) {
    const region = regionOf(id);
    const offset = offsetOf(id);
    const now = timeIn(id);

    return (
        <div className="flex items-start gap-4">
            <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] border-2 border-(--accent) bg-(--card)">
                <Clock className="size-6 text-(--accent)" />
            </span>
            <div className="min-w-0">
                <p className="text-sm text-(--text)/80">{lead}</p>
                <p className="text-2xl font-bold break-words">{cityOf(id)}</p>
                <p className="mt-0.5 text-sm text-(--text)/80 tabular-nums">
                    {[region, offset, now && `${now} there now`].filter(Boolean).join(" · ")}
                </p>
            </div>
        </div>
    );
}

function TimeZonePicker({ detected, choice, zone, error, onChoice, onZone }) {
    // ~400 zones; label them once.
    const groups = useMemo(() => timeZonesByRegion(detected).map(([region, ids]) => [
        region,
        ids.map((id) => [id, `${cityOf(id)}${id.split('/').length > 2 ? ` (${regionOf(id)})` : ""} · ${offsetOf(id)}`]),
    ]), [detected]);

    return (
        <div className="flex flex-col gap-4">
            <fieldset className={WELL}>
                <legend className="sr-only">Is this your timezone?</legend>
                <ZoneReadout id={detected} lead="Your device says you're in" />
                <p className="mt-4 text-sm leading-relaxed text-(--text)/85">
                    You can only set this once. After that, only an admin can change it.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                        { value: "detected", label: "Yes, that's right" },
                        { value: "other", label: "No, I'll pick it" },
                    ].map(({ value, label }) => (
                        <label key={value} className={CHOICE}>
                            <input
                                type="radio"
                                name="timeZoneChoice"
                                required
                                checked={choice === value}
                                onChange={() => onChoice(value)}
                                className="sr-only"
                            />
                            {choice === value && <Check aria-hidden="true" className="size-4" />}
                            {label}
                        </label>
                    ))}
                </div>
            </fieldset>

            {choice === "other" && (
                <Field
                    label="Your timezone"
                    error={error}
                    hint="Pick the nearest big city in your timezone. Type a city's name to jump to it."
                >
                    {(props) => (
                        <select
                            {...props}
                            value={zone}
                            onChange={(e) => onZone(e.target.value)}
                            autoFocus
                            className={`${INPUT} min-h-12 cursor-pointer [&_optgroup]:bg-(--card) [&_option]:bg-(--card)`}
                        >
                            {groups.map(([region, ids]) => (
                                <optgroup key={region} label={region}>
                                    {ids.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    )}
                </Field>
            )}
            {choice !== "other" && <div role="alert"><FieldError>{error}</FieldError></div>}
        </div>
    );
}
