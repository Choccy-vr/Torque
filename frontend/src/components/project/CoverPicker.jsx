import { useCallback, useRef, useState } from "react";
import { ImageUp, LoaderCircle, X } from "lucide-react";
import Cover from "./Cover.jsx";
import ImageDrop, { PhotoInput } from "../ImageDrop.jsx";
import { FieldError, FOCUS } from "../Form.jsx";
import { errorText } from "../../lib/forms.js";
import { useFileDrop, useImageUpload } from "../../lib/images.js";

const OVERLAY_BTN = `inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-white/20 bg-(--card)/90 px-4 font-medium text-(--text) transition-all duration-300 ease hover:border-white/40 hover:bg-(--card) disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

// The cover band is also where the cover is set. With no cover it's the
// dashed drop sheet (click, drop or paste a photo); a set cover gets
// Change / Remove buttons and takes a dropped photo as a replacement.
// `onChange` may return a promise (the project page saves straight to the
// server); if it rejects, the error shows on the band and nothing changes.
// `onBusyChange(busy)` lets a form hold its submit while a photo uploads.
export default function CoverPicker({ value, onChange, onBusyChange, title }) {
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState(null);
    const [status, setStatus] = useState("");
    const fileRef = useRef(null);
    const changeRef = useRef(null);

    // After a new cover lands, keep keyboard focus on the band (the sheet it
    // was dropped on is gone) and say so.
    const set = useCallback(async (url) => {
        await onChange(url);
        setStatus("Cover photo set.");
        requestAnimationFrame(() => changeRef.current?.focus());
    }, [onChange]);
    const upload = useImageUpload("cover", set, onBusyChange);
    const drop = useFileDrop(upload.take, upload.busy);

    async function remove() {
        setRemoving(true);
        setRemoveError(null);
        upload.setError(null);
        try {
            await onChange("");
            setStatus("Cover photo removed.");
        } catch (err) {
            setRemoveError(errorText(err));
        } finally {
            setRemoving(false);
        }
    }

    const live = <p aria-live="polite" className="sr-only">{status}</p>;

    if (!value) {
        return (
            <>
                <ImageDrop
                    purpose="cover"
                    onUploaded={set}
                    onBusyChange={onBusyChange}
                    title="Drop a photo or render of your build"
                    className="min-h-36 border-b-2 sm:min-h-44"
                />
                {live}
            </>
        );
    }

    const busy = upload.busy || removing;
    const error = upload.error || removeError;
    return (
        <div {...drop.handlers} aria-busy={busy}>
            <div className="relative">
                <Cover key={value} project={{ coverImageUrl: value, title: title || "your project" }} />
                {(drop.over || upload.busy) && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-(--accent) bg-(--bg)/80">
                        {upload.busy
                            ? <LoaderCircle aria-hidden="true" className="size-7 text-(--accent) motion-safe:animate-spin" />
                            : <ImageUp aria-hidden="true" strokeWidth={1.5} className="size-7 text-(--text)" />}
                        <p className="font-medium text-(--text)">{upload.busy ? "Uploading…" : "Let go to replace the cover"}</p>
                    </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                    <PhotoInput ref={fileRef} onFiles={upload.take} />
                    <button ref={changeRef} type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={OVERLAY_BTN}>
                        <ImageUp aria-hidden="true" className="size-4" />
                        Change cover
                    </button>
                    <button type="button" onClick={remove} disabled={busy} aria-label="Remove cover" className={`${OVERLAY_BTN} px-3`}>
                        <X aria-hidden="true" className="size-4.5" />
                    </button>
                </div>
            </div>
            {error && (
                <div role="alert" className="border-b-2 border-white/10 px-5 py-3 sm:px-8">
                    <FieldError>{error}</FieldError>
                </div>
            )}
            {live}
        </div>
    );
}
