import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { updateProject } from "../../lib/endpoints.js";
import HackatimePicker from "./HackatimePicker.jsx";
import { BTN_GHOST, BTN_PRIMARY, Field, FOCUS, FormError, INPUT } from "../Form.jsx";
import { errorText, isHttpUrl, useRevealOnMount } from "../../lib/forms.js";

const TEXT_FIELDS = ["title", "description", "aiUse", "repoUrl", "demoUrl", "readmeUrl", "coverImageUrl"];
const URL_FIELDS = [
    ["coverImageUrl", "Cover image"],
    ["repoUrl", "Repository"],
    ["demoUrl", "Demo"],
    ["readmeUrl", "Readme"],
];

// The project card turned into its own edit form, in place. Sends only what
// changed; a cleared optional field is sent as "" so the server clears it.
export default function ProjectEditForm({ project, onSaved, onCancel }) {
    const headingRef = useRevealOnMount();
    const [values, setValues] = useState(() => ({
        ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, project[k] ?? ""])),
        tier: project.tier,
        hackatime: project.hackatimeProjectNames ?? [],
    }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        const title = values.title.trim();
        if (!title) return setError("Give your project a title.");
        const badUrl = URL_FIELDS.find(([k]) => values[k].trim() && !isHttpUrl(values[k].trim()));
        if (badUrl) return setError(`${badUrl[1]} needs to be a full link starting with https://`);

        const changes = {};
        for (const key of TEXT_FIELDS) {
            const next = values[key].trim();
            if (next !== (project[key] ?? "")) changes[key] = next;
        }
        if (values.tier !== project.tier) changes.tier = values.tier;
        const before = project.hackatimeProjectNames ?? [];
        if (values.hackatime.length !== before.length || values.hackatime.some((n) => !before.includes(n))) {
            changes.hackatimeProjectNames = values.hackatime;
        }
        if (Object.keys(changes).length === 0) return onCancel();

        setSaving(true);
        setError(null);
        try {
            await updateProject(project.id, changes);
            onSaved();
        } catch (err) {
            setError(errorText(err));
            setSaving(false);
        }
    }

    return (
        <form
            onSubmit={submit}
            aria-labelledby="edit-project-title"
            className="t-card flex flex-col gap-7 px-5 py-6 text-(--text) sm:px-8 sm:py-8"
        >
            <h2 id="edit-project-title" ref={headingRef} tabIndex={-1} className="scroll-mt-14 [font-family:var(--heading-font)] text-3xl font-bold text-(--text) outline-none">
                Edit project
            </h2>

            <Field label="Title">
                {(p) => <input {...p} required maxLength={200} value={values.title} onChange={set("title")} className={INPUT} />}
            </Field>

            <Field label="Description" optional hint="What it is and what moves. Line breaks are kept.">
                {(p) => <textarea {...p} rows={5} maxLength={5000} value={values.description} onChange={set("description")} className={`${INPUT} resize-y leading-relaxed`} />}
            </Field>

            <LevelPicker value={values.tier} onChange={(tier) => setValues((v) => ({ ...v, tier }))} />

            <CoverField value={values.coverImageUrl} onChange={set("coverImageUrl")} />

            <div className="grid gap-7 sm:grid-cols-3 sm:gap-4">
                <Field label="Repository" optional>
                    {(p) => <input {...p} type="url" inputMode="url" placeholder="https://github.com/…" value={values.repoUrl} onChange={set("repoUrl")} className={INPUT} />}
                </Field>
                <Field label="Demo" optional>
                    {(p) => <input {...p} type="url" inputMode="url" placeholder="https://…" value={values.demoUrl} onChange={set("demoUrl")} className={INPUT} />}
                </Field>
                <Field label="Readme" optional>
                    {(p) => <input {...p} type="url" inputMode="url" placeholder="https://…" value={values.readmeUrl} onChange={set("readmeUrl")} className={INPUT} />}
                </Field>
            </div>

            <Field label="How did you use AI?" optional hint="Be upfront: using AI is fine, hiding it isn't. Leave blank if you didn't use any.">
                {(p) => <textarea {...p} rows={3} maxLength={2000} value={values.aiUse} onChange={set("aiUse")} className={`${INPUT} resize-y leading-relaxed`} />}
            </Field>

            <HackatimePicker value={values.hackatime} onChange={(hackatime) => setValues((v) => ({ ...v, hackatime }))} />

            <FormError>{error}</FormError>

            <div className="flex flex-wrap gap-3 border-t-2 border-white/15 pt-6">
                <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                    {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={onCancel} disabled={saving} className={BTN_GHOST}>
                    Cancel
                </button>
            </div>
        </form>
    );
}

// Level 1–4 as a row of pill radios.
function LevelPicker({ value, onChange }) {
    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold text-(--text)">Level</legend>
            <div className="grid grid-cols-4 gap-2 sm:flex">
                {[1, 2, 3, 4].map((level) => (
                    <label
                        key={level}
                        className="relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius) border-2 border-white/15 px-5 font-bold text-(--text) transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                    >
                        <input
                            type="radio"
                            name="level"
                            value={level}
                            checked={value === level}
                            onChange={() => onChange(level)}
                            className="peer sr-only"
                        />
                        <Check aria-hidden="true" className="hidden size-4 peer-checked:block" />
                        <span className="sr-only">Level </span>{level}
                    </label>
                ))}
            </div>
            <p className="text-sm leading-relaxed text-(--text)/80">
                Based on how mechanically and electrically complex the build is. Reviewers can adjust it.{" "}
                <Link to="/docs/projects/levels" className={`rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 hover:bg-white/10 ${FOCUS}`}>
                    What each level means
                </Link>
            </p>
        </fieldset>
    );
}

// Cover image link with a live preview, so a broken link shows before saving.
function CoverField({ value, onChange }) {
    const url = value.trim();
    const [failed, setFailed] = useState(null);
    const valid = url && isHttpUrl(url);

    return (
        <Field label="Cover image" optional hint="A direct link to a photo or render (ends in .jpg, .png, …). It's shown across the top of the project.">
            {(p) => (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <input {...p} type="url" inputMode="url" placeholder="https://…/photo.jpg" value={value} onChange={onChange} className={INPUT} />
                    {valid && (
                        <div className="flex aspect-[21/9] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white/15 bg-(--bg) sm:w-44">
                            {failed === url ? (
                                <span className="px-3 text-center text-sm text-(--text)/80">Can't load this image</span>
                            ) : (
                                <img key={url} src={url} alt="Cover preview" onError={() => setFailed(url)} className="size-full object-cover" />
                            )}
                        </div>
                    )}
                </div>
            )}
        </Field>
    );
}
