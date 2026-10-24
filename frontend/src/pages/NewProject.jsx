import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CirclePause } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import CoverPicker from "../components/project/CoverPicker.jsx";
import HackatimePicker from "../components/project/HackatimePicker.jsx";
import { LevelPicker } from "../components/project/ProjectEditForm.jsx";
import { BTN_GHOST, BTN_PRIMARY, Field, FieldError, FOCUS, FormError, INPUT } from "../components/Form.jsx";
import { createProject } from "../lib/endpoints.js";
import { errorText, isHttpUrl, NOT_A_LINK } from "../lib/forms.js";
import { PauseNotices } from "../components/PageParts.jsx";
import { PAUSE, pausedMessage, useSettings } from "../lib/settings.js";

// Mirrors CreateProjectDto (backend/modules/projects): title and tier are
// required, everything else is optional and editable later.
const TEXT_FIELDS = ["title", "description", "aiUse", "repoUrl", "demoUrl", "readmeUrl", "coverImageUrl"];
const URL_FIELDS = ["repoUrl", "demoUrl", "readmeUrl"];

// Every problem the form can spot before sending, keyed by field.
function validate(values) {
    const errors = {};
    if (!values.title.trim()) errors.title = "Give your project a title.";
    if (!values.tier) errors.tier = "Pick a level. Not sure? Go with your best guess; a reviewer can adjust it.";
    for (const key of URL_FIELDS) {
        const url = values[key].trim();
        if (url && !isHttpUrl(url)) errors[key] = NOT_A_LINK;
    }
    return errors;
}

// The server's duplicate-link errors (ProjectController.FindDuplicateAsync)
// belong to one field; anything else shows by the submit button.
const SERVER_FIELD = [
    [/repo URL/i, "repoUrl"],
    [/demo URL/i, "demoUrl"],
    [/readme URL/i, "readmeUrl"],
    [/Hackatime/i, "hackatime"],
];

// A GitHub repo link -> the raw link to its README on the default branch.
function readmeFor(repoUrl) {
    try {
        const url = new URL(repoUrl.trim());
        if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
        const [owner, repo] = url.pathname.split("/").filter(Boolean);
        if (!owner || !repo) return null;
        return `https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, "")}/HEAD/README.md`;
    } catch {
        return null;
    }
}

// /projects/new — the project card as a blank sheet: same cover band (set
// from the band itself), same redlined title, then the fields.
// Creating it lands you on the new project's page.
export default function NewProject() {
    const navigate = useNavigate();
    const [values, setValues] = useState(() => ({
        ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, ""])),
        tier: null,
        hackatime: [],
    }));
    const [saving, setSaving] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [errors, setErrors] = useState({});
    const formRef = useRef(null);
    // Filling the form in still works while creating is paused (nothing is
    // lost); only Create is held back, and the notice up top says why.
    const paused = pausedMessage(useSettings(), PAUSE.projectCreation);

    const clearErrors = (...keys) => setErrors((e) => {
        const rest = { ...e };
        for (const key of keys) delete rest[key];
        return rest;
    });
    // Editing a field clears its error.
    const update = (key, value) => {
        setValues((v) => ({ ...v, [key]: value }));
        clearErrors(key);
    };
    const set = (key) => (e) => update(key, e.target.value);

    // The readme follows a GitHub repo link until it's edited by hand.
    const setRepo = (e) => {
        const repoUrl = e.target.value;
        setValues((v) => {
            const following = v.readmeUrl === "" || v.readmeUrl === (readmeFor(v.repoUrl) ?? "");
            return { ...v, repoUrl, readmeUrl: following ? readmeFor(repoUrl) ?? "" : v.readmeUrl };
        });
        clearErrors("repoUrl", "readmeUrl");
    };

    // Focus the first field with a problem, once it has rendered as invalid.
    const showErrors = (next) => {
        setErrors(next);
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
    };

    async function submit(e) {
        e.preventDefault();
        if (paused || coverUploading) return;
        const found = validate(values);
        if (Object.keys(found).length > 0) return showErrors(found);

        // Blank optional fields are left out rather than sent empty.
        const body = { tier: values.tier };
        for (const key of TEXT_FIELDS) {
            const value = values[key].trim();
            if (value) body[key] = value;
        }
        if (values.hackatime.length > 0) body.hackatimeProjectNames = values.hackatime;

        setSaving(true);
        setErrors({});
        try {
            const project = await createProject(body);
            navigate(`/projects/${project.id}`);
        } catch (err) {
            // A pause switched on after this page loaded: the notice shows it.
            if (err?.paused) return setSaving(false);
            const message = errorText(err);
            const field = err?.status === 400 && SERVER_FIELD.find(([pattern]) => pattern.test(message))?.[1];
            if (field) showErrors({ [field]: message });
            else setErrors({ form: message });
            setSaving(false);
        }
    }

    return (
        <AppShell title="New project">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
                <Link
                    to="/projects"
                    className={`-ml-3 inline-flex min-h-11 items-center gap-2 self-start rounded-(--radius) px-3 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    <ArrowLeft aria-hidden="true" className="size-4.5" />
                    My projects
                </Link>

                <PauseNotices keys={[PAUSE.projectCreation]} />

                <form
                    ref={formRef}
                    onSubmit={submit}
                    noValidate
                    aria-labelledby="new-project-title"
                    className="t-card overflow-hidden text-(--text)"
                >
                    <CoverPicker
                        value={values.coverImageUrl}
                        onChange={(url) => update("coverImageUrl", url)}
                        onBusyChange={setCoverUploading}
                        title={values.title.trim()}
                    />

                    <div className="flex flex-col gap-7 px-5 py-6 sm:px-8 sm:py-8">
                        <h1
                            id="new-project-title"
                            className="mb-1 [font-family:var(--heading-font)] text-3xl leading-tight font-bold text-(--text) after:mt-3 after:block after:h-1 after:w-14 after:rounded-full after:bg-(--accent) after:content-[''] sm:text-4xl"
                        >
                            New project
                        </h1>

                        <Field label="Title" error={errors.title}>
                            {(p) => <input {...p} required maxLength={200} autoComplete="off" value={values.title} onChange={set("title")} className={INPUT} />}
                        </Field>

                        <LevelPicker value={values.tier} onChange={(tier) => update("tier", tier)} error={errors.tier} />

                        <Field label="Description" optional>
                            {(p) => <textarea {...p} rows={5} maxLength={5000} value={values.description} onChange={set("description")} className={`${INPUT} resize-y leading-relaxed`} />}
                        </Field>

                        <Field label="Repository" optional error={errors.repoUrl}>
                            {(p) => <input {...p} type="url" inputMode="url" placeholder="https://github.com/…" value={values.repoUrl} onChange={setRepo} className={INPUT} />}
                        </Field>

                        <div className="grid gap-7 sm:grid-cols-2 sm:gap-4">
                            <Field label="Readme" optional error={errors.readmeUrl}>
                                {(p) => <input {...p} type="url" inputMode="url" placeholder="https://…" value={values.readmeUrl} onChange={set("readmeUrl")} className={INPUT} />}
                            </Field>
                            <Field label="Demo" optional error={errors.demoUrl}>
                                {(p) => <input {...p} type="url" inputMode="url" placeholder="https://…" value={values.demoUrl} onChange={set("demoUrl")} className={INPUT} />}
                            </Field>
                        </div>

                        <div className="flex flex-col gap-2">
                            <HackatimePicker value={values.hackatime} onChange={(hackatime) => update("hackatime", hackatime)} hint={false} />
                            <FieldError>{errors.hackatime}</FieldError>
                        </div>

                        <Field label="How did you use AI?" optional hint="Be upfront: using AI is fine, hiding it isn't. Leave blank if you didn't use any.">
                            {(p) => <textarea {...p} rows={3} maxLength={2000} value={values.aiUse} onChange={set("aiUse")} className={`${INPUT} resize-y leading-relaxed`} />}
                        </Field>

                        <div className="flex flex-col gap-4 border-t-2 border-white/15 pt-6">
                            <FormError>{errors.form}</FormError>
                            {paused && (
                                <p id="create-paused" className="flex max-w-[65ch] items-start gap-2.5 leading-relaxed text-(--text)/90">
                                    <CirclePause aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--text)/85" />
                                    {paused} Your answers stay here until then.
                                </p>
                            )}
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    disabled={saving || coverUploading}
                                    aria-disabled={paused ? true : undefined}
                                    aria-describedby={paused ? "create-paused" : undefined}
                                    className={`${BTN_PRIMARY} px-8 text-lg aria-disabled:cursor-not-allowed aria-disabled:border-white/15 aria-disabled:bg-white/10 aria-disabled:text-(--text)/75 aria-disabled:hover:border-white/15 aria-disabled:hover:bg-white/10`}
                                >
                                    {saving ? "Creating…" : coverUploading ? "Waiting for cover…" : "Create project"}
                                </button>
                                <Link to="/projects" className={`${BTN_GHOST} ${saving ? "pointer-events-none opacity-60" : ""}`}>
                                    Cancel
                                </Link>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AppShell>
    );
}
