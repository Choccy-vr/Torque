import { useId } from "react";
import { CircleAlert } from "lucide-react";

// Form vocabulary for in-app forms (the project page's edit, ship and journal
// forms). Fields are recessed wells in the card: page-coloured, 16px corners,
// a quiet white edge that goes full coral on focus. Errors stay Chalk White
// and are marked with a coral icon and edge, never coral text.

// DESIGN.md's focus ring: 2px Chalk White at a 3px offset (coral would only
// be 2.74:1 against the card).
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text)";

const BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-(--radius) border-2 px-6 font-bold transition-all duration-300 ease disabled:cursor-not-allowed ${FOCUS}`;

// Coral pill; lightens on hover so the Ink Slate label keeps its contrast.
export const BTN_PRIMARY = `${BTN} border-(--accent) bg-(--accent) text-(--btn-text) hover:border-(--btn-bg-hover) hover:bg-(--btn-bg-hover) disabled:border-white/15 disabled:bg-white/10 disabled:text-(--text)/75`;

// Coral-outline pill, the secondary path beside a primary.
export const BTN_OUTLINE = `${BTN} border-(--accent)/55 text-(--text) hover:border-(--accent) hover:bg-(--accent)/15 disabled:border-white/15 disabled:bg-transparent disabled:text-(--text)/75`;

// Borderless until hovered, for quiet actions (Cancel, Archive).
export const BTN_GHOST = `${BTN} border-transparent text-(--text) hover:border-white/20 hover:bg-white/10 disabled:text-(--text)/75 disabled:hover:border-transparent disabled:hover:bg-transparent`;

export const INPUT = `w-full rounded-2xl border-2 border-white/15 bg-(--bg)/70 px-4 py-2.5 text-(--text) caret-(--accent) placeholder:text-(--text)/75 transition-colors duration-300 ease hover:border-white/30 focus:border-(--accent) focus:outline-none ${FOCUS} aria-[invalid=true]:border-(--accent)`;

// A labelled field. `children` is a render function that receives the props
// to spread on the control (id, aria-describedby, aria-invalid). `error`
// shows under the control and marks it invalid.
export function Field({ label, hint, optional = false, error, children }) {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="font-semibold text-(--text)">
                {label}
                {optional && <span className="font-normal text-(--text)/75"> (optional)</span>}
            </label>
            {children({
                id,
                "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
                "aria-invalid": error ? true : undefined,
            })}
            <FieldError id={errorId}>{error}</FieldError>
            {hint && <p id={hintId} className="text-sm leading-relaxed text-(--text)/80">{hint}</p>}
        </div>
    );
}

// What's wrong with one field, right under it. Chalk White text with a coral
// icon, since coral text would fail contrast.
export function FieldError({ id, children }) {
    if (!children) return null;
    return (
        <p id={id} className="flex items-start gap-2 text-sm leading-relaxed font-medium text-(--text)">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--accent)" />
            {children}
        </p>
    );
}

// The server's reason a save failed, shown where the submit button is.
export function FormError({ children }) {
    if (!children) return null;
    return (
        <p role="alert" className="flex items-start gap-2.5 rounded-2xl border-2 border-(--accent) bg-(--accent)/15 px-4 py-3 leading-relaxed text-(--text)">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--text)" />
            {children}
        </p>
    );
}
