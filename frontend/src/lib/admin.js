import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorText } from "./forms.js";

// Hooks and constants shared by the admin pages (components/admin).

// The backend caps every admin search here.
export const MAX_RESULTS = 50;

// One URL search param as state. Setting "" removes it.
export function useParam(name) {
    const [params, setParams] = useSearchParams();
    const set = (value) =>
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set(name, value);
            else next.delete(name);
            return next;
        }, { replace: true });
    return [params.get(name) ?? "", set];
}

// Wraps an async action with busy/error state. `run` resolves true on success.
export function useAction() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    async function run(action) {
        setBusy(true);
        setError(null);
        try {
            await action();
            return true;
        } catch (err) {
            setError(err?.status === 403 ? "Only admins can do that." : errorText(err));
            return false;
        } finally {
            setBusy(false);
        }
    }
    return { run, busy, error, setError };
}
