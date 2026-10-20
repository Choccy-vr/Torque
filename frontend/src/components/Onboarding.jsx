import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useOutletContext } from 'react-router-dom'
import { completeOnboarding, getHackatimeStatus, getMyProfile, joinSlackChannels } from '../lib/endpoints.js'
import { useConnectHackatime } from '../lib/hackatime.js'
import { FieldError } from './Form.jsx'

const steps = [
    {
        title: "Profile Information",
        description: "Pick a username, bio, and profile picture that will show up to people who view your profile.",
    },
    {
        title: "Hackatime Setup",
        description: "Setup Hackatime to be able to track time.",
    },
    {
        title: "Join our community on Slack",
    },
];

export default function Onboarding({ onComplete = () => { } }) {
    const { markOnboarded } = useOutletContext() ?? {}

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1);
    const [hackatimeConnected, setHackatimeConnected] = useState(false)
    const onHackatimeConnected = useCallback(() => setHackatimeConnected(true), [])
    const hackatime = useConnectHackatime(onHackatimeConnected)
    const [formData, setFormData] = useState({
        username: "",
        bio: "",
        profilePicture: null,
        slackInvite: null,
    })

    // Fill in whatever the account already has, without overwriting typing.
    useEffect(() => {
        getMyProfile()
            .then((profile) => setFormData((prev) => ({
                ...prev,
                username: prev.username || profile.username || "",
                bio: prev.bio || profile.bio || "",
                profilePicture: prev.profilePicture ?? profile.profilePictureUrl ?? null,
            })))
            .catch(() => { })
        getHackatimeStatus()
            .then(({ connected }) => { if (connected) setHackatimeConnected(true) })
            .catch(() => { })
    }, [])

    const isFirstPage = page === 1;
    const isLastPage = page === 3;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 sm:p-8">

            <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-(--accent)/55 bg-(--bg) shadow-2xl transition-all duration-300 ease-in-out">
                <div className="h-1 w-full bg-(--accent)/15">
                    <div
                        className="h-full bg-(--accent) transition-all duration-500 ease"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-(--accent)/20">
                    <form
                        key={page}
                        onSubmit={isLastPage ? handleSubmit : nextPage}
                        className="flex flex-col flex-1"
                    >
                        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 sm:py-12">
                            <div className="mx-auto w-full max-w-lg">
                                <div className="mb-6">
                                    <div className="flex flex-row gap-2 items-center mb-2 text-md font-medium ">
                                        <p className={page === 1 ? "text-(--accent)" : ""}>Username</p>
                                        <ArrowRight size={14} />
                                        <p className={page === 2 ? "text-(--accent)" : ""}>Hackatime</p>
                                        <ArrowRight size={14} />
                                        <p className={page === 3 ? "text-(--accent)" : ""}>Slack</p>
                                    </div>

                                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                        {currentStep.title}
                                    </h2>

                                    {currentStep.description && (
                                        <p className="mt-3 text-sm leading-6 opacity-60 sm:text-base">
                                            {currentStep.description}
                                        </p>
                                    )}
                                </div>

                                {page === 1 && (
                                    <div className="flex flex-col gap-2">
                                        <div className="">
                                            <label htmlFor="username" className="text-sm font-medium">Username</label>
                                            <input
                                                type="text"
                                                id="username"
                                                name="username"
                                                required
                                                value={formData.username}
                                                onChange={updateField}
                                                minLength={4}
                                                maxLength={24}
                                                pattern="[A-Za-z0-9_]+"
                                                autoComplete="username"
                                                autoFocus
                                                title="Use 4–24 letters, numbers, or underscores."
                                                className="w-full h-12 rounded-xl bg-(--bg) px-4 outline-none border-2 focus:border-(--accent) transition-all placeholder:opacity-40 border-(--accent)/30"
                                                placeholder="Orpheus_123"
                                            />
                                            <p className="text-xs opacity-50">
                                                4-24 characters, letters, numbers, and underscores only.
                                            </p>
                                        </div>

                                        <div className="mt-4">
                                            <label htmlFor="bio" className="text-sm font-medium">
                                                Bio
                                                <span className="ml-2 opacity-40">
                                                    (Optional)
                                                </span>
                                            </label>

                                            <textarea
                                                id="bio"
                                                name="bio"
                                                maxLength={160}
                                                onChange={updateField}
                                                value={formData.bio}
                                                rows={4}
                                                placeholder="Write a short description about yourself..."
                                                className="w-full resize-none rounded-xl border-2 border-(--accent)/30 bg-(--bg) p-4 text-sm outline-none transition-all placeholder:opacity-40 focus:border-(--accent)"
                                            />
                                            <p className="text-right text-xs opacity-50">
                                                {formData.bio.length}/160
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {page === 2 && (
                                    <div>
                                        <div className="rounded-xl border border-(--accent)/25 p-5">
                                            <p className="text-sm text-center font-medium">
                                                {hackatimeConnected
                                                    ? "Your Hackatime account is linked. You're all set for this step."
                                                    : "Hackatime will open so you can approve access."}
                                            </p>
                                            <button
                                                onClick={hackatime.connect}
                                                disabled={hackatimeConnected}
                                                aria-disabled={hackatime.waiting || undefined}
                                                type="button"
                                                className="flex items-center w-full max-w-md justify-center gap-2 mt-2 rounded-xl bg-(--accent) px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] aria-disabled:cursor-wait disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/60 disabled:hover:brightness-100 disabled:active:scale-100"
                                            >
                                                {hackatimeConnected ? (
                                                    <>
                                                        <Check size={18} aria-hidden="true" />
                                                        Hackatime Linked
                                                    </>
                                                ) : hackatime.waiting ? (
                                                    <>
                                                        <LoaderCircle size={18} aria-hidden="true" className="motion-safe:animate-spin" />
                                                        Waiting for Hackatime…
                                                    </>
                                                ) : (
                                                    "Link Hackatime"
                                                )}
                                            </button>
                                            <div aria-live="polite" className="mt-2">
                                                <FieldError>{hackatime.error}</FieldError>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {page === 3 && (
                                    <div>
                                        <fieldset className="rounded-xl border border-(--accent)/25 p-5">
                                            <legend className="sr-only">Slack invite</legend>
                                            <p className="text-sm font-medium">
                                                Do you want to be invited to the Torque Slack channels?
                                            </p>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                {[
                                                    { value: true, label: "Yes, invite me" },
                                                    { value: false, label: "No thanks" },
                                                ].map(({ value, label }) => (
                                                    <label
                                                        key={label}
                                                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-(--accent)/30 px-4 py-3 text-sm font-semibold transition-all duration-200 hover:bg-(--accent)/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--text)"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="slackInvite"
                                                            required
                                                            checked={formData.slackInvite === value}
                                                            onChange={() => setFormData((prev) => ({ ...prev, slackInvite: value }))}
                                                            className="sr-only"
                                                        />
                                                        {formData.slackInvite === value && <Check size={16} aria-hidden="true" />}
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && <p role="alert" className="px-5 pb-2 text-sm text-red-400 sm:px-12">{error}</p>}
                        <div className="flex items-center justify-between gap-4 border-t border-(--accent)/20 p-5 sm:px-12 sm:py-6">
                            <button
                                type="button"
                                onClick={previousPage}
                                disabled={isFirstPage}
                                aria-label="Previous page"
                                className="flex items-center justify-center gap-2 rounded-xl border-3 border-(--accent)/30 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-(--accent)/10 disabled:cursor-not-allowed disabled:opacity-30 hover:brightness-110 active:scale-[0.98]"
                            >

                                {/*flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--accent)/30 transition-all hover:bg-(--accent)/10 disabled:cursor-not-allowed disabled:opacity-30*/}
                                <>
                                    <ArrowLeft size={18} />
                                    Back
                                </>
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center justify-center gap-2 rounded-xl bg-(--accent) px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                            >
                                {isLastPage ? (
                                    saving ? (
                                        <>
                                            Finishing…
                                            <LoaderCircle size={18} aria-hidden="true" className="motion-safe:animate-spin" />
                                        </>
                                    ) : (
                                        <>
                                            Finish
                                            <Check size={18} />
                                        </>
                                    )
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}