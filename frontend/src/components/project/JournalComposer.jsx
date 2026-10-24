import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock, ImageOff, ImagePlus, LoaderCircle, RotateCw } from "lucide-react";
import { createDevlog, getJournalPreview } from "../../lib/endpoints.js";
import { formatHours } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";
import Markdown from "../Markdown.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, Field, FieldError, FOCUS, FormError, INPUT } from "../Form.jsx";
import { PhotoInput } from "../ImageDrop.jsx";
import { UPLOADING_MARK, useMarkdownPhotos, withoutUploadMarks } from "../../lib/images.js";
import { JOURNAL_MIN_WRITING, errorText, imagesIn, isHttpUrl, writingLength } from "../../lib/forms.js";

const TEXT_LINK = `rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 hover:bg-white/10 ${FOCUS}`;
const TEXT_ACTION = `-my-2 inline-flex min-h-11 items-center rounded-(--radius) px-2 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`;

// Drafts survive a reload or a trip to another tab.
// Storage can be unavailable (private windows), so every access is guarded.
const draftKey = (projectId) => `journal-draft:${projectId}`;
function readDraft(projectId) {
    try {
        return JSON.parse(localStorage.getItem(draftKey(projectId))) ?? null;
    } catch {
        return null;
    }
}
function writeDraft(projectId, draft) {
    try {
        if (draft) localStorage.setItem(draftKey(projectId), JSON.stringify(draft));
        else localStorage.removeItem(draftKey(projectId));
    } catch {
        // Not saved; the entry still works.
    }
}

const hoursText = (h) => (h > 0 && h < 0.1 ? "under 0.1 hours" : formatHours(Math.round(h * 10) / 10));

// A new journal entry, written at the top of the project's timeline. The body
// is markdown with photos embedded inline; it needs 150+ characters of
// writing and at least one photo that actually loads (the server checks the
// length and that there's a photo). Photos upload to our bucket as they're added.
export default function JournalComposer({ project, onPosted, onCancel, onEdit }) {
    const [restored] = useState(() => readDraft(project.id));
    const [title, setTitle] = useState(restored?.title ?? "");
    const [text, setText] = useState(restored?.text ?? "");
    const [photoStatus, setPhotoStatus] = useState({}); // url -> "ok" | "broken"
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState(null);
    const [discarding, setDiscarding] = useState(false);
    const titleRef = useRef(null);

    // Opened from the timeline header, so bring it into view and start typing.
    useEffect(() => {
        titleRef.current?.focus({ preventScroll: true });
        titleRef.current?.closest("form")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, []);

    useEffect(() => {
        // Uploads don't survive a reload, so their placeholders aren't saved.
        const saved = withoutUploadMarks(text);
        const timer = setTimeout(() => writeDraft(project.id, title || saved ? { title, text: saved } : null), 400);
        return () => clearTimeout(timer);
    }, [project.id, title, text]);

    const writing = writingLength(text);
    const photos = imagesIn(text);
    const loaded = photos.filter((u) => photoStatus[u] === "ok").length;
    const broken = photos.filter((u) => photoStatus[u] === "broken");
    const checking = photos.length - loaded - broken.length;
    const hasDraft = Boolean(title || text);

    const edit = (setter) => (value) => {
        setter(value);
        setError(null);
        setDiscarding(false);
    };
    const onPhotoStatus = useCallback((url, status) => setPhotoStatus((s) => (s[url] === status ? s : { ...s, [url]: status })), []);

    async function submit(e) {
        e.preventDefault();
        if (!title.trim()) return setError("Give this entry a title.");
        if (writing < JOURNAL_MIN_WRITING) {
            return setError(`Write at least ${JOURNAL_MIN_WRITING} characters about what you did (${JOURNAL_MIN_WRITING - writing} to go).`);
        }
        if (text.includes(UPLOADING_MARK)) return setError("A photo is still uploading. Give it a moment, or delete its “[Uploading photo…]” line if it's stuck.");
        const notLink = photos.find((u) => !isHttpUrl(u));
        if (notLink) return setError(`“${notLink}” isn't a full link. Photo links start with https://`);
        if (broken.length > 0) return setError("A photo didn't load. Remove it from the text and add it again.");
        if (loaded === 0) return setError(checking > 0 ? "Still checking your photo. Try again in a moment." : "Add at least one photo of your work.");

        setPosting(true);
        setError(null);
        try {
            await createDevlog({ projectId: project.id, title: title.trim(), text: text.trim(), imageUrls: [] });
            writeDraft(project.id, null);
            onPosted();
        } catch (err) {
            setError(errorText(err));
            setPosting(false);
        }
    }

    function discard() {
        writeDraft(project.id, null);
        setTitle("");
        setText("");
        setError(null);
        setDiscarding(false);
        titleRef.current?.focus();
    }

    return (
        <form
            noValidate
            onSubmit={submit}
            aria-labelledby="composer-title"
            className="t-card flex scroll-mt-14 flex-col gap-6 px-5 py-6 text-(--text) sm:px-7 sm:py-7"
        >
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 id="composer-title" className="text-xl font-semibold text-(--text)">New journal entry</h3>
                    {restored && (restored.title || restored.text) && <p className="text-sm text-(--text)/80">Picked up your saved draft.</p>}
                </div>
                <TimeAdded projectId={project.id} onEdit={onEdit} />
            </div>

            <Field label="Title">
                {(p) => <input {...p} ref={titleRef} aria-required="true" maxLength={200} placeholder="Got the motor spinning" value={title} onChange={(e) => edit(setTitle)(e.target.value)} className={INPUT} />}
            </Field>

            <BodyEditor text={text} onChange={edit(setText)} photos={photos} photoStatus={photoStatus} onPhotoStatus={onPhotoStatus} />

            <ul aria-label="Before you post" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--text)/85 tabular-nums">
                <Requirement met={writing >= JOURNAL_MIN_WRITING}>
                    {writing >= JOURNAL_MIN_WRITING
                        ? `${writing} characters of writing`
                        : `${writing} / ${JOURNAL_MIN_WRITING} characters of writing`}
                </Requirement>
                <Requirement met={loaded > 0 && broken.length === 0}>
                    {photos.length === 0 ? "At least 1 photo"
                        : broken.length > 0 ? `${broken.length} ${broken.length === 1 ? "photo doesn't" : "photos don't"} load`
                        : checking > 0 && loaded === 0 ? "Checking photo…"
                        : `${loaded} ${loaded === 1 ? "photo" : "photos"}`}
                </Requirement>
            </ul>

            <FormError>{error}</FormError>

            <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={posting} className={BTN_PRIMARY}>
                    {posting ? "Posting…" : "Post entry"}
                </button>
                <button type="button" onClick={onCancel} disabled={posting} className={BTN_GHOST}>
                    Close
                </button>
                {hasDraft && (
                    <p className="flex flex-wrap items-center gap-x-1 text-sm text-(--text)/80 sm:ml-auto">
                        {discarding ? (
                            <>
                                <span>Throw away this draft?</span>
                                <button type="button" onClick={discard} className={TEXT_ACTION}>Discard</button>
                                <button type="button" onClick={() => setDiscarding(false)} className={TEXT_ACTION}>Keep</button>
                            </>
                        ) : (
                            <>
                                <span>Draft saved on this device.</span>
                                <button type="button" onClick={() => setDiscarding(true)} className={TEXT_ACTION}>Discard draft</button>
                            </>
                        )}
                    </p>
                )}
            </div>
        </form>
    );
}

// How much Hackatime time this entry will credit if posted now. Refreshed
// when you come back to the tab, since writing an entry can take a while.
function TimeAdded({ projectId, onEdit }) {
    const fetchPreview = useCallback(() => getJournalPreview(projectId), [projectId]);
    const { data, loading, error, reload } = useApi(fetchPreview);

    useEffect(() => {
        window.addEventListener("focus", reload);
        return () => window.removeEventListener("focus", reload);
    }, [reload]);

    let body;
    if (loading && !data) {
        body = <span aria-hidden="true" className="inline-block h-5 w-56 rounded bg-white/10 align-middle motion-safe:animate-pulse" />;
    } else if (error) {
        body = (
            <>
                Couldn't work out the time right now.{" "}
                <button type="button" onClick={reload} className={`${TEXT_ACTION} gap-1.5`}>
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Try again
                </button>
            </>
        );
    } else if (!data.hackatimeLinked) {
        body = (
            <>
                Adds <b className="font-bold text-(--text)">no Hackatime time</b>: no Hackatime projects are linked.{" "}
                {onEdit && <button type="button" onClick={onEdit} className={TEXT_ACTION}>Link one</button>}
            </>
        );
    } else if (!data.hackatimeReachable) {
        body = (
            <>
                Couldn't reach Hackatime, so you can't post until it's back. Your draft is saved.{" "}
                <button type="button" onClick={reload} className={`${TEXT_ACTION} gap-1.5`}>
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Try again
                </button>
            </>
        );
    } else if (data.trackedHours < 0.05) {
        body = (
            <>
                Adds <b className="font-bold text-(--text)">no Hackatime time</b>: nothing's been tracked on your linked projects since your last entry.
                Record bench and CAD work with Lapse so reviewers can see it.
            </>
        );
    } else {
        const forfeited = data.uncappedHours - data.trackedHours;
        body = (
            <>
                Adds <b className="font-bold text-(--text) tabular-nums">{hoursText(data.trackedHours)}</b> from Hackatime, the time since your last entry.
                {forfeited >= 0.1 && <> The other {hoursText(forfeited)} won't count ({data.maxHours}h max per entry), so journal more often.</>}
            </>
        );
    }

    return (
        <p aria-live="polite" aria-busy={loading && !data} className="flex items-start gap-2.5 rounded-2xl border-2 border-white/10 bg-(--bg)/45 px-4 py-3 leading-relaxed text-(--text)/90">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--accent)" />
            <span>{body}</span>
        </p>
    );
}

function Requirement({ met, children }) {
    return (
        <li className={`flex items-center gap-1.5 ${met ? "text-(--text)" : ""}`}>
            {met
                ? <Check aria-hidden="true" className="size-4 shrink-0 text-(--accent)" />
                : <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-white/30" />}
            <span className="sr-only">{met ? "Done: " : "Needed: "}</span>
            {children}
        </li>
    );
}

// Markdown body with a Write / Preview switch and photo uploads: "Add photo"
// (or pasting / dropping images on the text) uploads them and puts
// ![Photo](url) in at the cursor. A strip below shows the photos it holds.
function BodyEditor({ text, onChange, photos, photoStatus, onPhotoStatus }) {
    const [view, setView] = useState("write");
    const textareaRef = useRef(null);
    const fileRef = useRef(null);
    const id = useId();
    const markPhotoOk = useCallback((url) => onPhotoStatus(url, "ok"), [onPhotoStatus]);
    const upload = useMarkdownPhotos({ purpose: "journal", textareaRef, setText: onChange, onInserted: markPhotoOk });

    function addFiles(files) {
        setView("write");
        upload.insertFiles(files);
    }

    const viewClass = (on) =>
        `inline-flex min-h-10 items-center rounded-(--radius) px-4 font-medium transition-all duration-300 ease ${FOCUS} ${
            on ? "bg-(--accent)/15 text-(--text)" : "text-(--text)/85 hover:bg-white/10 hover:text-(--text)"
        }`;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-body`} className="font-semibold text-(--text)">What did you work on?</label>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Body view" className="inline-flex rounded-(--radius) border-2 border-white/15 p-0.5">
                    <button type="button" aria-pressed={view === "write"} onClick={() => setView("write")} className={viewClass(view === "write")}>Write</button>
                    <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")} className={viewClass(view === "preview")}>Preview</button>
                </div>
                <PhotoInput ref={fileRef} multiple onFiles={addFiles} />
                <button type="button" onClick={() => fileRef.current?.click()} className={`${BTN_OUTLINE} px-4`}>
                    <ImagePlus aria-hidden="true" className="size-4.5" />
                    Add photo
                </button>
            </div>

            {/* The textarea stays mounted in Preview so its label, undo history and caret survive. */}
            <textarea
                ref={textareaRef}
                id={`${id}-body`}
                hidden={view !== "write"}
                aria-describedby={`${id}-hint${upload.error ? ` ${id}-upload-error` : ""}`}
                rows={9}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                {...upload.textHandlers}
                placeholder={"What you tried, what broke, what you'd do differently. Add a photo next to the part it shows."}
                className={`${INPUT} resize-y leading-relaxed ${upload.over ? "border-(--accent)! bg-(--accent)/15" : ""}`}
            />
            {view === "preview" && (
                <div className="min-h-56 rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3">
                    {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-(--text)/80">Nothing to preview yet.</p>}
                </div>
            )}

            <p aria-live="polite" className="empty:hidden flex items-center gap-2 text-sm font-medium text-(--text)/90">
                {upload.over && upload.pending === 0 && "Let go to add the photo where your cursor is."}
                {upload.pending > 0 && (
                    <>
                        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-(--accent) motion-safe:animate-spin" />
                        {`Uploading ${upload.pending} ${upload.pending === 1 ? "photo" : "photos"}…`}
                    </>
                )}
            </p>
            {upload.error && <div role="alert"><FieldError id={`${id}-upload-error`}>{upload.error}</FieldError></div>}

            {photos.length > 0 && <PhotoStrip urls={photos} status={photoStatus} onStatus={onPhotoStatus} />}

            <p id={`${id}-hint`} className="text-sm leading-relaxed text-(--text)/80">
                Markdown works: <Syntax>**bold**</Syntax>, <Syntax>- lists</Syntax>, <Syntax>`code`</Syntax>, links. Photos go right in the text, so put each one next to the part it shows. You can also paste or drag photos straight into the text, and change “Photo” to what it shows.{" "}
                <Link to="/docs/journaling/how-to-journal" className={TEXT_LINK}>How to journal</Link>
            </p>
        </div>
    );
}

function Syntax({ children }) {
    return <code className="rounded-md bg-(--bg)/70 px-1.5 py-0.5 font-mono text-[0.8125rem] text-(--text)">{children}</code>;
}

// Small thumbnails of every photo in the body, so a link that doesn't load
// shows up before posting rather than in front of a reviewer.
function PhotoStrip({ urls, status, onStatus }) {
    return (
        <ul aria-label="Photos in this entry" className="flex flex-wrap gap-2">
            {urls.map((url) => (
                <li key={url} title={url}>
                    {status[url] === "broken" ? (
                        <span className="flex h-16 w-24 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-(--accent) text-xs text-(--text)">
                            <ImageOff aria-hidden="true" className="size-4" />
                            Didn't load
                        </span>
                    ) : (
                        <img
                            src={url}
                            alt=""
                            onLoad={() => onStatus(url, "ok")}
                            onError={() => onStatus(url, "broken")}
                            className="h-16 w-24 rounded-xl border-2 border-white/15 bg-(--bg) object-cover"
                        />
                    )}
                </li>
            ))}
        </ul>
    );
}
