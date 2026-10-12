import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import Cover from "./Cover.jsx";
import { BTN_GHOST, BTN_OUTLINE, FieldError, FOCUS, INPUT } from "../Form.jsx";
import { errorText, isHttpUrl } from "../../lib/forms.js";

export const NOT_A_LINK = "Needs to be a full link, starting with https://";

// Same blueprint sheet as Cover's empty state, holding the link input.
const SHEET = "flex min-h-36 flex-col items-center justify-center gap-3 border-b-2 border-dashed border-white/20 bg-(--bg)/45 px-5 py-6 sm:min-h-44";
const SHEET_GRID = {
    backgroundImage:
        "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
};
const OVERLAY_BTN = `inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-white/20 bg-(--card)/90 px-4 font-medium text-(--text) transition-all duration-300 ease hover:border-white/40 hover:bg-(--card) disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

// The cover band is also where the cover is set: "Add a cover image" turns
// the sheet into a link field, and a set cover gets Change / Remove buttons.
// `onChange` may return a promise (the project page saves straight to the
// server); if it rejects, the error shows on the band and nothing changes.
export default function CoverPicker({ value, onChange, title, emptyText = "No cover image yet" }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const bandRef = useRef(null);
    const errorId = "cover-url-error";

    const edit = () => {
        setDraft(value);
        setError(null);
        setEditing(true);
    };
    const close = () => {
        setEditing(false);
        // Hand focus back to the band's own button.
        requestAnimationFrame(() => bandRef.current?.querySelector("button")?.focus());
    };
    const save = async (url) => {
        if (url === (value ?? "")) return true;
        setSaving(true);
        setError(null);
        try {
            await onChange(url);
            return true;
        } catch (err) {
            setError(errorText(err));
            return false;
        } finally {
            setSaving(false);
        }
    };
    const done = async () => {
        const url = draft.trim();
        if (url && !isHttpUrl(url)) return setError(NOT_A_LINK);
        if (await save(url)) close();
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
                                if (!saving) done();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                close();
                            }
                        }}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        className={INPUT}
                    />
                    <div className="flex gap-2">
                        <button type="button" onClick={done} disabled={saving} className={BTN_OUTLINE}>
                            {saving ? "Saving…" : "Done"}
                        </button>
                        <button type="button" onClick={close} disabled={saving} className={BTN_GHOST}>Cancel</button>
                    </div>
                </div>
                <FieldError id={errorId}>{error}</FieldError>
            </div>
        );
    }

    return (
        <div ref={bandRef} className="relative">
            <Cover
                key={value}
                project={{ coverImageUrl: value || null, title: title || "your project" }}
                emptyText={emptyText}
                onAdd={edit}
            />
            {value && (
                <div className="absolute top-3 right-3 flex gap-2">
                    <button type="button" onClick={edit} disabled={saving} className={OVERLAY_BTN}>
                        <Pencil aria-hidden="true" className="size-4" />
                        Change cover
                    </button>
                    <button type="button" onClick={() => save("")} disabled={saving} aria-label="Remove cover" className={`${OVERLAY_BTN} px-3`}>
                        <X aria-hidden="true" className="size-4.5" />
                    </button>
                </div>
            )}
            {error && (
                <div className="absolute inset-x-3 bottom-3 rounded-(--radius) bg-(--card)/95 px-3 py-2">
                    <FieldError>{error}</FieldError>
                </div>
            )}
        </div>
    );
}
