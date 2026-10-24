import { forwardRef, useId } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { FieldError } from "./Form.jsx";
import { filesIn, useFileDrop, useImageUpload } from "../lib/images.js";

// The blueprint sheet's fine 22px grid, shared with Cover's empty state.
const SHEET_GRID = {
    backgroundImage:
        "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
};

// A hidden file picker for photos, opened from a button with ref.current.click().
export const PhotoInput = forwardRef(function PhotoInput({ onFiles, multiple = false }, ref) {
    return (
        <input
            ref={ref}
            type="file"
            accept="image/*"
            multiple={multiple}
            hidden
            onChange={(e) => {
                onFiles(filesIn(e.target));
                // Picking the same file again should still fire.
                e.target.value = "";
            }}
        />
    );
});

// An empty image slot that takes one photo: click (or Enter) to choose a file,
// drop one on it, or paste one while it has focus. Drawn as the dashed
// "nothing here yet" sheet; files hovering over it turn it coral.
// `onUploaded(url)` may return a promise; if it rejects, the error shows here.
// `onBusyChange(busy)` lets a parent form hold its save while one uploads.
// `className` sizes and shapes the sheet (corners, which sides have a border,
// min height). On touch screens, where nothing gets dropped, it just says tap.
export default function ImageDrop({ purpose, onUploaded, onBusyChange, title = "Drop a photo here", className = "", autoFocus = false }) {
    const { busy, error, take } = useImageUpload(purpose, onUploaded, onBusyChange);
    const { over, handlers } = useFileDrop(take, busy);
    const id = useId();

    return (
        <div
            {...handlers}
            aria-busy={busy}
            style={SHEET_GRID}
            className={`flex flex-col border-dashed transition-colors duration-300 ease ${
                over ? "border-(--accent) bg-(--accent)/15" : "border-white/20 bg-(--bg)/45"
            } ${className}`}
        >
            <input
                id={`${id}-file`}
                type="file"
                accept="image/*"
                aria-disabled={busy || undefined}
                autoFocus={autoFocus}
                aria-describedby={[`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ")}
                aria-invalid={error ? true : undefined}
                className="peer sr-only"
                // Clicks while busy would open a picker whose pick is ignored.
                onClick={(e) => busy && e.preventDefault()}
                onChange={(e) => {
                    take(filesIn(e.target));
                    e.target.value = "";
                }}
                onPaste={(e) => {
                    const files = filesIn(e.clipboardData);
                    if (!files.length) return;
                    e.preventDefault();
                    take(files);
                }}
            />
            <label
                htmlFor={`${id}-file`}
                className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-[inherit] px-5 py-6 text-center transition-colors duration-300 ease peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:-outline-offset-8 peer-focus-visible:outline-(--text) ${
                    busy ? "cursor-progress" : "cursor-pointer hover:bg-white/5"
                }`}
            >
                {busy
                    ? <LoaderCircle aria-hidden="true" className="size-7 text-(--accent) motion-safe:animate-spin" />
                    : <ImageUp aria-hidden="true" strokeWidth={1.5} className={`size-7 transition-colors duration-300 ease ${over ? "text-(--text)" : "text-(--text)/60"}`} />}
                {busy || over ? (
                    <span className="font-medium text-(--text)">{busy ? "Uploading…" : "Let go to upload"}</span>
                ) : (
                    <>
                        <span className="font-medium text-(--text) pointer-coarse:hidden">{title}</span>
                        <span className="font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4">
                            <span className="pointer-coarse:hidden">or choose a file</span>
                            <span className="hidden pointer-coarse:inline">Tap to add a photo</span>
                        </span>
                    </>
                )}
            </label>
            <p id={`${id}-hint`} className="sr-only">PNG, JPEG, GIF or WebP. Big photos are shrunk before uploading. You can also paste an image while this is focused.</p>
            <p aria-live="polite" className="sr-only">{busy ? "Uploading photo…" : ""}</p>
            {error && (
                <div role="alert" className="flex justify-center px-5 pb-5">
                    <FieldError id={`${id}-error`}>{error}</FieldError>
                </div>
            )}
        </div>
    );
}
