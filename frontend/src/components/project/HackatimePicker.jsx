import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { getHackatimeHours, getHackatimeProjects } from "../../lib/endpoints.js";
import { splitList } from "../../lib/forms.js";
import { useApi } from "../../lib/useApi.js";
import { Field, FOCUS, INPUT } from "../Form.jsx";

const formatTime = (h) => (h == null ? "–" : `${Number.isInteger(h) ? h : h.toFixed(1)}h`);

// Your Hackatime projects with their all-time hours, most tracked first.
async function loadProjects() {
    const { projects } = await getHackatimeProjects();
    if (projects.length === 0) return [];
    // Hours are a nicety: if that call fails, still offer the names.
    const hours = await getHackatimeHours(projects).then((r) => r.perProject ?? {}, () => ({}));
    return projects
        .map((name) => ({ name, hours: hours[name] ?? null }))
        .sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1) || a.name.localeCompare(b.name));
}

// Linked Hackatime projects as removable tags, plus a dropdown of the rest
// with their tracked time. Falls back to a comma-separated list when
// Hackatime isn't connected.
export default function HackatimePicker({ value, onChange }) {
    const { data, loading, error } = useApi(loadProjects);
    const fieldsetRef = useRef(null);

    if (loading) {
        return <div aria-busy="true" aria-label="Loading Hackatime projects" className="h-20 rounded-2xl bg-white/10 motion-safe:animate-pulse" />;
    }

    if (error || data.length === 0) {
        return (
            <Field
                label="Hackatime projects"
                optional
                hint={error
                    ? "Couldn't reach Hackatime, so type the project names, separated by commas."
                    : "Names of the Hackatime projects that track this build's firmware time, separated by commas."}
            >
                {(p) => <input {...p} defaultValue={value.join(", ")} onChange={(e) => onChange(splitList(e.target.value))} className={INPUT} />}
            </Field>
        );
    }

    const hoursOf = new Map(data.map((p) => [p.name, p.hours]));
    // Unlinking removes the focused button, so hand focus to the next tag's
    // button (or the dropdown) once the list re-renders.
    const remove = (name, i) => {
        onChange(value.filter((n) => n !== name));
        requestAnimationFrame(() => {
            const buttons = fieldsetRef.current?.querySelectorAll("[data-unlink]") ?? [];
            (buttons[Math.min(i, buttons.length - 1)] ?? fieldsetRef.current?.querySelector("[data-picker]"))?.focus();
        });
    };

    return (
        <fieldset ref={fieldsetRef} className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold text-(--text)">
                Hackatime projects <span className="font-normal text-(--text)/75">(optional)</span>
            </legend>
            {value.length > 0 && (
                <ul aria-label="Linked Hackatime projects" className="flex flex-wrap gap-2">
                    {value.map((name, i) => (
                        <li
                            key={name}
                            className="inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-(--accent) bg-(--accent)/15 pr-1 pl-4 font-medium text-(--text)"
                        >
                            {name}
                            <span className="text-sm text-(--text)/85 tabular-nums">
                                {formatTime(hoursOf.get(name))}<span className="sr-only"> tracked</span>
                            </span>
                            <button
                                type="button"
                                data-unlink
                                aria-label={`Unlink ${name}`}
                                onClick={() => remove(name, i)}
                                className={`relative inline-flex size-9 items-center justify-center rounded-full transition-all duration-300 ease before:absolute before:-inset-1 before:content-[''] hover:bg-white/15 ${FOCUS}`}
                            >
                                <X aria-hidden="true" className="size-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <ProjectDropdown
                options={data.filter((p) => !value.includes(p.name))}
                onPick={(name) => onChange([...value, name])}
            />
            <p className="text-sm leading-relaxed text-(--text)/80">
                Firmware time on these projects counts toward your journal entries.
            </p>
        </fieldset>
    );
}

// A button that opens a listbox of unlinked projects (name left, hours right).
// Arrow keys move, Enter/Space picks, Escape or a click outside closes.
function ProjectDropdown({ options, onPick }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const buttonRef = useRef(null);
    const listRef = useRef(null);
    const wrapRef = useRef(null);
    const listId = useId();

    const close = useCallback((refocus) => {
        setOpen(false);
        if (refocus) buttonRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        listRef.current?.focus();
        const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) close(false); };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [open, close]);

    useEffect(() => {
        listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    function pick(i) {
        const option = options[i];
        if (!option) return;
        onPick(option.name);
        setActive(Math.min(i, options.length - 2));
        close(true);
    }

    function onKeyDown(e) {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Home") { e.preventDefault(); setActive(0); }
        else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
        else if (e.key === "Escape") { e.preventDefault(); close(true); }
        // Hand focus back first so the browser's Tab moves on from the button.
        else if (e.key === "Tab") { buttonRef.current?.focus(); setOpen(false); }
        // Typeahead: jump to the next project starting with that letter.
        else if (e.key.length === 1 && /\S/.test(e.key)) {
            const key = e.key.toLowerCase();
            const order = [...options.keys()].map((n) => (active + 1 + n) % options.length);
            const hit = order.find((n) => options[n].name.toLowerCase().startsWith(key));
            if (hit !== undefined) setActive(hit);
        }
    }

    const empty = options.length === 0;

    return (
        <div ref={wrapRef} className="relative self-start">
            <button
                ref={buttonRef}
                type="button"
                data-picker
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-disabled={empty ? true : undefined}
                onClick={empty ? undefined : () => (open ? close(false) : (setActive(0), setOpen(true)))}
                onKeyDown={(e) => { if (e.key === "ArrowDown" && !open && !empty) { e.preventDefault(); setActive(0); setOpen(true); } }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-(--radius) border-2 border-dashed border-white/25 px-4 font-medium text-(--text)/90 transition-all duration-300 ease hover:border-white/45 hover:bg-white/10 hover:text-(--text) aria-disabled:cursor-default aria-disabled:border-transparent aria-disabled:px-0 aria-disabled:hover:bg-transparent aria-expanded:border-solid aria-expanded:border-(--accent) ${FOCUS}`}
            >
                {empty ? (
                    "All your Hackatime projects are linked"
                ) : (
                    <>
                        <Plus aria-hidden="true" className="size-4.5 shrink-0" />
                        Link a Hackatime project
                        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform duration-300 ease ${open ? "rotate-180" : ""}`} />
                    </>
                )}
            </button>
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    tabIndex={-1}
                    aria-label="Your Hackatime projects"
                    aria-activedescendant={`${listId}-${active}`}
                    onKeyDown={onKeyDown}
                    className="t-scroll absolute top-full left-0 z-30 mt-2 max-h-64 w-[min(22rem,calc(100vw-4rem))] overflow-y-auto rounded-2xl border-2 border-(--accent) bg-(--card) p-1.5 focus:outline-none"
                >
                    {options.map((option, i) => (
                        <li
                            key={option.name}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            onPointerEnter={() => setActive(i)}
                            onClick={() => pick(i)}
                            className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl px-3 text-(--text) ${i === active ? "bg-(--accent)/15 shadow-[inset_3px_0_0_var(--accent)]" : ""}`}
                        >
                            <span className="min-w-0 truncate font-medium">{option.name}</span>
                            <span className="shrink-0 text-sm text-(--text)/80 tabular-nums">{formatTime(option.hours)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
