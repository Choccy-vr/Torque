import { useId, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { ConfirmBox } from "../../components/admin/AdminParts.jsx";
import { useAction } from "../../lib/admin.js";
import { Empty, InlineError } from "../../components/PageParts.jsx";
import Markdown from "../../components/Markdown.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, FieldError, FOCUS, FormError, INPUT } from "../../components/Form.jsx";
import { PhotoInput } from "../../components/ImageDrop.jsx";
import { useMarkdownPhotos } from "../../lib/images.js";
import { createAnnouncement, deleteAnnouncement, getAnnouncements, updateAnnouncement } from "../../lib/endpoints.js";
import { formatWhen } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

// Mirror AdminAnnouncementController's limits.
const MAX_TITLE = 200;
const MAX_BODY = 20000;

// /admin/announcements — news on everyone's dashboard. Shows what builders
// see (the latest 30), with write / edit / delete in place.
export default function AdminAnnouncements() {
    return (
        <AdminShell title="Announcements">
            <AnnouncementList />
        </AdminShell>
    );
}

function AnnouncementList() {
    const posts = useApi(getAnnouncements);
    const [writing, setWriting] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[60ch] leading-relaxed text-(--text)/85">
                    Posts show up on every builder's dashboard, newest first. Write them in markdown.
                </p>
                {!writing && (
                    <button type="button" data-opens="new-post" onClick={() => setWriting(true)} className={BTN_PRIMARY}>
                        <Plus aria-hidden="true" className="size-4.5" strokeWidth={2.5} />
                        New announcement
                    </button>
                )}
            </div>

            {writing && (
                <PostEditor
                    heading="New announcement"
                    submitLabel="Post it"
                    onSubmit={(body) => createAnnouncement(body)}
                    onDone={() => { setWriting(false); posts.reload(); }}
                    onCancel={() => {
                        setWriting(false);
                        requestAnimationFrame(() => document.querySelector('[data-opens="new-post"]')?.focus());
                    }}
                />
            )}

            {posts.loading && !posts.data ? (
                <div aria-busy="true" aria-label="Loading announcements" className="flex flex-col gap-4">
                    {[0, 1].map((i) => <div key={i} className="t-card h-44 motion-safe:animate-pulse text-(--text)!" />)}
                </div>
            ) : posts.error ? (
                <InlineError what="announcements" onRetry={posts.reload} />
            ) : posts.data.length === 0 ? (
                writing ? null : (
                    <Empty title="No announcements yet">
                        Post news, deadlines or new rewards here and every builder sees it on their dashboard.
                    </Empty>
                )
            ) : (
                <section aria-labelledby="posts-heading">
                    <h2 id="posts-heading" className="sr-only">Posted announcements</h2>
                    <ul className="flex flex-col gap-4">
                        {posts.data.map((post) => <Post key={post.id} post={post} onChanged={posts.reload} />)}
                    </ul>
                </section>
            )}
        </div>
    );
}

function Post({ post, onChanged }) {
    const [mode, setMode] = useState(null); // null | "edit" | "delete"
    const remove = useAction();

    if (mode === "edit") {
        return (
            <li>
                <PostEditor
                    heading="Edit announcement"
                    initial={post}
                    submitLabel="Save changes"
                    onSubmit={(body) => updateAnnouncement(post.id, body)}
                    onDone={() => { setMode(null); onChanged(); }}
                    onCancel={() => setMode(null)}
                />
            </li>
        );
    }

    return (
        <li>
            <article aria-labelledby={`post-${post.id}`} className="t-card flex flex-col gap-4 px-5 py-6 text-(--text)! sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h3 id={`post-${post.id}`} className="text-xl font-semibold break-words">{post.title}</h3>
                        <p className="text-sm text-(--text)/75 tabular-nums">
                            Posted {formatWhen(post.createdAt)}
                            {post.updatedAt && ` · edited ${formatWhen(post.updatedAt)}`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setMode("edit")} className={BTN_OUTLINE}>
                            <Pencil aria-hidden="true" className="size-4" />
                            Edit
                        </button>
                        <button
                            type="button"
                            aria-expanded={mode === "delete"}
                            onClick={() => setMode(mode === "delete" ? null : "delete")}
                            className={BTN_GHOST}
                        >
                            <Trash2 aria-hidden="true" className="size-4" />
                            Delete
                        </button>
                    </div>
                </div>
                {mode === "delete" && (
                    <ConfirmBox
                        id={`delete-${post.id}`}
                        title="Delete this announcement?"
                        confirmLabel="Delete it"
                        busyLabel="Deleting…"
                        icon={Trash2}
                        busy={remove.busy}
                        onConfirm={async () => { if (await remove.run(() => deleteAnnouncement(post.id))) onChanged(); }}
                        onCancel={() => setMode(null)}
                    >
                        It disappears from every dashboard. There's no undo.
                    </ConfirmBox>
                )}
                <FormError>{remove.error}</FormError>
                <Markdown>{post.body}</Markdown>
            </article>
        </li>
    );
}

// Write or edit a post, with a live preview of how the markdown renders.
function PostEditor({ heading, initial, submitLabel, onSubmit, onDone, onCancel }) {
    const id = useId();
    const [title, setTitle] = useState(initial?.title ?? "");
    const [body, setBody] = useState(initial?.body ?? "");
    const [preview, setPreview] = useState(false);
    const save = useAction();
    const bodyRef = useRef(null);
    const fileRef = useRef(null);
    const photos = useMarkdownPhotos({ purpose: "announcement", textareaRef: bodyRef, setText: setBody });
    const ready = title.trim() && body.trim() && photos.pending === 0;
    const unchanged = initial && title.trim() === initial.title && body === initial.body;

    async function submit(e) {
        e.preventDefault();
        if (await save.run(() => onSubmit({ title: title.trim(), body }))) onDone();
    }

    return (
        <form onSubmit={submit} aria-labelledby={`${id}-heading`} className="t-card flex flex-col gap-5 border-(--accent) px-5 py-6 text-(--text)! sm:px-8">
            <h2 id={`${id}-heading`} className="flex items-center gap-2.5 text-xl font-bold">
                <Megaphone aria-hidden="true" className="size-5 text-(--accent)" />
                {heading}
            </h2>
            <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-title`} className="font-semibold">Title</label>
                <input id={`${id}-title`} autoFocus maxLength={MAX_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor={`${id}-body`} className="mr-auto font-semibold">Post</label>
                    <PhotoInput
                        ref={fileRef}
                        multiple
                        onFiles={(files) => {
                            setPreview(false);
                            photos.insertFiles(files);
                        }}
                    />
                    <button type="button" onClick={() => fileRef.current?.click()} className={`${BTN_OUTLINE} px-4 text-sm`}>
                        <ImagePlus aria-hidden="true" className="size-4" />
                        Insert photo
                    </button>
                    <div role="group" aria-label="Editor view" className="flex rounded-full border-2 border-white/15 p-0.5">
                        {[["Write", false], ["Preview", true]].map(([label, value]) => (
                            <button
                                key={label}
                                type="button"
                                aria-pressed={preview === value}
                                onClick={() => setPreview(value)}
                                className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors duration-300 ease ${FOCUS} ${
                                    preview === value ? "bg-(--accent)/15 text-(--text)" : "text-(--text)/80 hover:text-(--text)"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* The textarea stays mounted in Preview so photo uploads and its caret survive. */}
                {preview && (
                    <div className="min-h-48 rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3">
                        {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-(--text)/75">Nothing to preview yet.</p>}
                    </div>
                )}
                <textarea
                    hidden={preview}
                    ref={bodyRef}
                    id={`${id}-body`}
                    rows={8}
                    maxLength={MAX_BODY}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    {...photos.textHandlers}
                    placeholder={"## What's new\n\n- **Bold** for the key bit\n- [Links](https://hackclub.com) work too"}
                    className={`${INPUT} min-h-48 resize-y font-mono text-[0.9375rem] leading-relaxed ${photos.over ? "border-(--accent)! bg-(--accent)/15" : ""}`}
                    />
                <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-(--text)/90 empty:hidden">
                    {photos.pending > 0 && (
                        <>
                            <LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-(--accent) motion-safe:animate-spin" />
                            {`Uploading ${photos.pending} ${photos.pending === 1 ? "photo" : "photos"}…`}
                        </>
                    )}
                </p>
                {photos.error && <div role="alert"><FieldError>{photos.error}</FieldError></div>}
            </div>
            <FormError>{save.error}</FormError>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={save.busy || !ready || unchanged} className={BTN_PRIMARY}>
                    {save.busy ? "Saving…" : submitLabel}
                </button>
                <button type="button" disabled={save.busy} onClick={onCancel} className={BTN_GHOST}>Cancel</button>
            </div>
        </form>
    );
}
