import { useId, useState } from "react";
import { Check } from "lucide-react";
import { updateProject } from "../../lib/endpoints.js";
import HackatimePicker from "./HackatimePicker.jsx";
import { BTN_GHOST, BTN_PRIMARY, Field, FieldError, FormError, INPUT } from "../Form.jsx";
import { errorText, isHttpUrl, useRevealOnMount } from "../../lib/forms.js";
import { LEVELS } from "../../lib/projects.js";

const TEXT_FIELDS = ["title", "description", "aiUse", "repoUrl", "demoUrl", "readmeUrl"];
const URL_FIELDS = [
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

// Short versions of docs/projects/levels.

// Level 1–4 as radio cards, each with a one-line scope so builders can place
// themselves. `value` is null until one is picked.
export function LevelPicker({ value, onChange, error }) {
    const errorId = `${useId()}-error`;

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold text-(--text)">Level</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LEVELS.map(({ level, name, about }) => (
                    <label
                        key={level}
                        className="flex cursor-pointer flex-col gap-1 rounded-2xl border-2 border-white/15 px-4 py-3 text-(--text) transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-[[aria-invalid=true]]:border-(--accent)/70 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                    >
                        <input
                            type="radio"
                            name="level"
                            value={level}
                            checked={value === level}
                            onChange={() => onChange(level)}
                            required
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            className="peer sr-only"
                        />
                        <span className="flex items-center gap-2 font-bold">
                            Level {level}
                            <span className="font-medium text-(--text)/80">· {name}</span>
                            <Check aria-hidden="true" className="ml-auto hidden size-4.5 peer-checked:block" />
                        </span>
                        <span className="text-sm leading-relaxed text-(--text)/80">{about}</span>
                    </label>
                ))}
            </div>
            <FieldError id={errorId}>{error}</FieldError>
        </fieldset>
    );
}
