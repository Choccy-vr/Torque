// Helpers for the in-app forms (see components/Form.jsx).
import { useEffect, useRef } from "react";

// A form's error text: the server's own sentence when it sent one.
export function errorText(err, fallback = "Something went wrong. Check your connection and try again.") {
    if (err?.status === 401) return "You've been signed out. Log in again to save this.";
    // A 403 with a `code` (identity checks, shop rules) explains itself; a bare one
    // means it isn't the caller's to change.
    if (err?.status === 403 && !err?.code) return "You can only change your own projects.";
    const message = err?.message?.trim();
    return message && !message.startsWith("Request failed") && !message.startsWith("<") ? message : fallback;
}

// Splits "a, b\nc" into trimmed, non-empty, unique entries.
export function splitList(text, separator = /[\n,]/) {
    return [...new Set(text.split(separator).map((s) => s.trim()).filter(Boolean))];
}

export const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

// For a panel that opens below the control that opened it: focus its heading
// (give it tabIndex={-1}) and bring it into view. Returns the ref to attach.
export function useRevealOnMount() {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, []);
    return ref;
}

// Journal bodies are markdown with photos embedded inline: ![alt](url).
// Mirrors backend JournalRules: 150+ characters of writing (photos don't
// count) and at least one photo.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
export const JOURNAL_MIN_WRITING = 150;
export const imagesIn = (text) => [...new Set([...text.matchAll(MARKDOWN_IMAGE)].map((m) => m[1]))];
export const writingLength = (text) => text.replace(MARKDOWN_IMAGE, "").trim().length;
