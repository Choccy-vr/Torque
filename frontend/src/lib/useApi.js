import { useCallback, useEffect, useState } from 'react'

// Runs `fetcher` on mount and tracks its result. `fetcher` must be a stable
// reference (a module-level function from endpoints.js, or wrapped in
// useCallback). `reload()` re-runs it, e.g. for a "Try again" button.
export function useApi(fetcher) {
    const [state, setState] = useState({ data: null, error: null, loading: true })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        fetcher().then(
            (data) => !cancelled && setState({ data, error: null, loading: false }),
            (error) => !cancelled && setState({ data: null, error, loading: false }),
        )
        return () => { cancelled = true }
    }, [fetcher, attempt])

    const reload = useCallback(() => {
        setState((s) => ({ ...s, error: null, loading: true }))
        setAttempt((n) => n + 1)
    }, [])
    return { ...state, reload }
}

// Like useApi, but a new `fetcher` keeps the last result on screen (marked
// `loading`) until its own answer arrives, instead of flashing skeletons.
export function useLatest(fetcher) {
    const [state, setState] = useState({ for: null, data: null, error: null })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        fetcher().then(
            (data) => !cancelled && setState({ for: fetcher, data, error: null }),
            (error) => !cancelled && setState((s) => ({ for: fetcher, data: s.data, error })),
        )
        return () => { cancelled = true }
    }, [fetcher, attempt])

    const loading = state.for !== fetcher
    const reload = useCallback(() => {
        setState((s) => ({ ...s, for: null, error: null }))
        setAttempt((n) => n + 1)
    }, [])
    return { data: state.data, error: loading ? null : state.error, loading, reload }
}
