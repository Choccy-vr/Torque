import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, X } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import Cover from "../components/project/Cover.jsx";
import HackatimePicker from "../components/project/HackatimePicker.jsx";
import { LevelPicker } from "../components/project/ProjectEditForm.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, Field, FieldError, FOCUS, FormError, INPUT } from "../components/Form.jsx";
import { createProject } from "../lib/endpoints.js";
import { errorText, isHttpUrl } from "../lib/forms.js";

// Mirrors CreateProjectDto (backend/modules/projects): title and tier are
// required, everything else is optional and editable later.
const TEXT_FIELDS = ["title", "description", "aiUse", "repoUrl", "demoUrl", "readmeUrl", "coverImageUrl"];
const URL_FIELDS = ["coverImageUrl", "repoUrl", "demoUrl", "readmeUrl"];
const NOT_A_LINK = "Needs to be a full link, starting with https://";

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
    const [errors, setErrors] = useState({});
    const formRef = useRef(null);

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
                            <div className="flex flex-wrap gap-3">
                                <button type="submit" disabled={saving} className={`${BTN_PRIMARY} px-8 text-lg`}>
                                    {saving ? "Creating…" : "Create project"}
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

// Same blueprint sheet as Cover's empty state, holding the link input.
const SHEET = "flex min-h-36 flex-col items-center justify-center gap-3 border-b-2 border-dashed border-white/20 bg-(--bg)/45 px-5 py-6 sm:min-h-44";
const SHEET_GRID = {
    backgroundImage:
        "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
};
const OVERLAY_BTN = `inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-white/20 bg-(--card)/90 px-4 font-medium text-(--text) transition-all duration-300 ease hover:border-white/40 hover:bg-(--card) ${FOCUS}`;

// The cover band is also where the cover is set: "Add a cover image" turns
// the sheet into a link field, and a set cover gets Change / Remove buttons.
function CoverPicker({ value, onChange, title }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState(null);
    const bandRef = useRef(null);

    const edit = () => {
        setDraft(value);
        setError(null);
        setEditing(true);
    };
    const close = (next) => {
        if (next !== undefined) onChange(next);
        setEditing(false);
        // Hand focus back to the band's own button.
        requestAnimationFrame(() => bandRef.current?.querySelector("button")?.focus());
    };
    const done = () => {
        const url = draft.trim();
        if (url && !isHttpUrl(url)) return setError(NOT_A_LINK);
        close(url);
    };

    if (editing) {
        return (
            <div className={SHEET} style={SHEET_GRID}>
                <label htmlFor="cover-url" className="font-medium text-(--text)/85">Link to a photo or render</label>
                <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
                    <input
                        id="cover-url"
                        type="url"
                        inputMode="url"
                        autoFocus
                        placeholder="https://…/photo.jpg"
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            setError(null);
                        }}
                        // Enter sets the cover rather than submitting the form.
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                done();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                close();
                            }
                        }}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "cover-url-error" : undefined}
                        className={INPUT}
                    />
                    <div className="flex gap-2">
                        <button type="button" onClick={done} className={BTN_OUTLINE}>Done</button>
                        <button type="button" onClick={() => close()} className={BTN_GHOST}>Cancel</button>
                    </div>
                </div>
                <FieldError id="cover-url-error">{error}</FieldError>
            </div>
        );
    }

    return (
        <div ref={bandRef} className="relative">
            <Cover
                key={value}
                project={{ coverImageUrl: value || null, title: title || "your project" }}
                emptyText="No cover image yet"
                onAdd={edit}
            />
            {value && (
                <div className="absolute top-3 right-3 flex gap-2">
                    <button type="button" onClick={edit} className={OVERLAY_BTN}>
                        <Pencil aria-hidden="true" className="size-4" />
                        Change cover
                    </button>
                    <button type="button" onClick={() => onChange("")} aria-label="Remove cover" className={`${OVERLAY_BTN} px-3`}>
                        <X aria-hidden="true" className="size-4.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
