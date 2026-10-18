import { FOCUS } from "./Form.jsx";

// An on/off switch: a coral pill with an Ink Slate knob when on, a recessed
// well when off. Label it with aria-labelledby (and aria-describedby for its
// hint); the hit area reaches 8px past the pill.
export default function Switch({ on, busy = false, onToggle, ...aria }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={onToggle}
            className={`relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-all duration-300 ease before:absolute before:-inset-2 before:content-[''] disabled:cursor-wait disabled:opacity-70 ${FOCUS} ${
                on ? "border-(--accent) bg-(--accent)" : "border-white/30 bg-(--bg)/70 hover:border-white/50"
            }`}
            {...aria}
        >
            <span
                aria-hidden="true"
                className={`absolute size-5.5 rounded-full transition-all duration-300 ease motion-reduce:transition-none ${
                    on ? "left-[calc(100%-1.5rem)] bg-(--btn-text)" : "left-0.5 bg-(--text)/85"
                }`}
            />
        </button>
    );
}
