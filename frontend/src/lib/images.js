// Photo uploads: shrink and clean a picked file in the browser, send it to
// api/upload/image, and hand back the URL that goes in the usual image field.
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImage } from "./endpoints.js";
import { errorText } from "./forms.js";

// Matches the backend's cap (UploadService.MaxImageBytes).
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Bigger originals are refused before decoding; phone photos sit well under this.
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_EDGE = 2560;
const QUALITY = 0.85;

// A reason the file itself can't be used, worded for the person who picked it.
class PhotoError extends Error {}

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
const baseName = (name) => (name || "photo").replace(/\.[^.]+$/, "") || "photo";

// Redraws the photo on a canvas: at most 2560px on its long edge, re-encoded as
// WebP (PNG where the browser can't write WebP). That also drops EXIF, so a
// phone photo's GPS location never leaves the device. GIFs go up untouched to
// keep their animation.
export async function prepareImage(file) {
    if (!file.type.startsWith("image/")) {
        throw new PhotoError("That file isn't a photo. Use a PNG, JPEG, GIF or WebP image.");
    }
    if (file.type === "image/gif") {
        if (file.size > MAX_UPLOAD_BYTES) throw new PhotoError("That GIF is over 10 MB. Trim it or export it smaller.");
        return file;
    }
    if (file.size > MAX_SOURCE_BYTES) throw new PhotoError("That photo is over 40 MB. Export a smaller copy and try again.");

    let bitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        throw new PhotoError("Couldn't open that image (iPhone HEIC photos often do this). Screenshot it or save it as a JPEG, then try again.");
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let blob = await toBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/png");
    if (!blob) throw new PhotoError("Couldn't prepare that image. Try a different file.");
    if (blob.size > MAX_UPLOAD_BYTES) throw new PhotoError("That image is still over 10 MB after shrinking. Try a smaller one.");

    const ext = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${baseName(file.name)}.${ext}`, { type: blob.type });
}

// What to tell someone when an upload fails.
export function uploadErrorText(err) {
    if (err instanceof PhotoError) return err.message;
    if (err?.status === 413) return "That image is over 10 MB.";
    if (err?.status === 429) return "That's a lot of uploads at once. Wait a minute, then try again.";
    if (err?.status === 403) return "You don't have permission to upload images here.";
    return errorText(err, "Couldn't upload that image. Check your connection and try again.");
}

export async function prepareAndUpload(file, purpose) {
    return uploadImage(await prepareImage(file), purpose);
}

// The image files in a drop or paste (clipboard text and dragged links are left alone).
export function filesIn(transfer) {
    return [...(transfer?.files ?? [])];
}
const carriesFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

// Upload one image for a single-image field. `onUploaded(url)` may return a
// promise (saving the field); if it rejects, its error shows like an upload error.
// `onBusyChange(busy)` tells a parent form an upload is in flight (so it can
// hold its save); it still fires if this component unmounts mid-upload.
export function useImageUpload(purpose, onUploaded, onBusyChange) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const inFlight = useRef(false);

    const take = useCallback(async (files) => {
        const file = files?.[0];
        if (!file || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        onBusyChange?.(true);
        setError(null);
        try {
            const url = await prepareAndUpload(file, purpose);
            await onUploaded(url);
        } catch (err) {
            setError(uploadErrorText(err));
        } finally {
            inFlight.current = false;
            setBusy(false);
            onBusyChange?.(false);
        }
    }, [purpose, onUploaded, onBusyChange]);

    return { busy, error, setError, take };
}

// Drag-and-drop of files onto an element. `over` is true while files hover it.
// Spread `handlers` on the target; a drop calls `onFiles(files)`. While any
// drop target is on the page, a file dropped just beside it is swallowed
// instead of the browser opening it in place of the form.
export function useFileDrop(onFiles, disabled = false) {
    const [over, setOver] = useState(false);
    const depth = useRef(0);
    useEffect(guardStrayDrops, []);

    const handlers = {
        onDragEnter(e) {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            depth.current += 1;
            if (!disabled) setOver(true);
        },
        onDragOver(e) {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        },
        onDragLeave(e) {
            if (!carriesFiles(e)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setOver(false);
        },
        onDrop(e) {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            depth.current = 0;
            setOver(false);
            if (!disabled) onFiles(filesIn(e.dataTransfer));
        },
    };
    return { over, handlers };
}

let dropGuards = 0;
const swallowFileDrop = (e) => {
    if (carriesFiles(e)) e.preventDefault();
};
function guardStrayDrops() {
    if (dropGuards++ === 0) {
        window.addEventListener("dragover", swallowFileDrop);
        window.addEventListener("drop", swallowFileDrop);
    }
    return () => {
        if (--dropGuards === 0) {
            window.removeEventListener("dragover", swallowFileDrop);
            window.removeEventListener("drop", swallowFileDrop);
        }
    };
}

// While a photo uploads, the markdown holds a placeholder where it will go.
// It isn't image syntax, so the journal's photo checks don't count it.
export const UPLOADING_MARK = "[Uploading photo";
const UPLOADING_BLOCK = /\[Uploading photo [^\]\n]*…\](\n\n)?/g;
// The text without any upload placeholders (for saving drafts: an upload
// doesn't survive a reload, so its placeholder shouldn't either).
export const withoutUploadMarks = (text) => text.replace(UPLOADING_BLOCK, "");

// One batch of photos is capped so a stray select-all doesn't fire off dozens.
const MAX_BATCH = 10;

// Photos for a markdown textarea: `insertFiles` drops a placeholder per file
// at the caret (where it was last, if the textarea isn't focused), uploads
// them, and swaps each for ![alt](url). `textHandlers` adds paste and
// drag-and-drop of image files to the textarea itself. `setText` must accept
// an updater function (a useState setter does). Leaving the page mid-upload
// asks first.
export function useMarkdownPhotos({ purpose, textareaRef, setText, onInserted }) {
    const [pending, setPending] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (pending === 0) return;
        const warn = (e) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [pending]);

    const insertFiles = useCallback(async (picked, alt = "Photo") => {
        if (!picked.length) return;
        const files = picked.slice(0, MAX_BATCH);
        setError(picked.length > MAX_BATCH ? `Only the first ${MAX_BATCH} photos were added. Add the rest in another go.` : null);
        // A short random tag keeps placeholders unique across reloads and batches.
        const marks = files.map(() => `${UPLOADING_MARK} ${Math.random().toString(36).slice(2, 6)}…]`);
        const block = marks.join("\n\n");

        // A textarea keeps its caret after losing focus, so "Add photo" lands
        // where the person was writing. Without one (not mounted), append.
        const area = textareaRef.current;
        let caret = null;
        setText((t) => {
            const at = area && area.value === t ? area.selectionStart : t.length;
            const spliced = spliceBlock(t, at, block);
            caret = spliced.caret;
            return spliced.next;
        });
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el || el.hidden || caret === null) return;
            el.focus();
            el.setSelectionRange(caret, caret);
        });

        setPending((n) => n + files.length);
        await Promise.all(files.map(async (file, i) => {
            try {
                const url = await prepareAndUpload(file, purpose);
                setText((t) => t.replace(marks[i], `![${alt}](${url})`));
                onInserted?.(url);
            } catch (err) {
                setText((t) => removeBlock(t, marks[i]));
                setError(files.length > 1 ? `${file.name} didn't upload. ${uploadErrorText(err)}` : uploadErrorText(err));
            } finally {
                setPending((n) => n - 1);
            }
        }));
    }, [purpose, textareaRef, setText, onInserted]);

    const drop = useFileDrop((files) => insertFiles(files));
    const textHandlers = {
        ...drop.handlers,
        onPaste(e) {
            const files = filesIn(e.clipboardData).filter((f) => f.type.startsWith("image/"));
            if (!files.length) return;
            e.preventDefault();
            insertFiles(files);
        },
    };

    return { insertFiles, textHandlers, over: drop.over, pending, error, setError };
}

// Puts `block` on its own paragraph at `at`. Returns the new text and where
// the caret goes (just after the block).
export function spliceBlock(text, at, block) {
    const before = text.slice(0, at).replace(/\s*$/, "");
    const after = text.slice(at).replace(/^\s*/, "");
    const next = `${before}${before ? "\n\n" : ""}${block}\n\n${after}`;
    return { next, caret: next.length - after.length };
}

function removeBlock(text, block) {
    return text.includes(`${block}\n\n`) ? text.replace(`${block}\n\n`, "") : text.replace(block, "");
}
