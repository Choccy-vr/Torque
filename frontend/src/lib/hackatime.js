import { useCallback, useEffect, useRef, useState } from 'react'
import { finishHackatime, startHackatime } from './endpoints.js'
import { clearPending, readPending, savePending } from './hackatimePending.js'

// Connecting a Hackatime account. Hackatime opens in a popup so a half-filled
// form survives. The popup's callback page posts the code back over CHANNEL,
// and this tab (which holds the session) finishes the link. If the popup is
// blocked, this tab goes to Hackatime itself and comes back to `returnTo`.

export const CHANNEL = 'torque:hackatime'
const RESULT_EVENT = 'torque:hackatime-result'

export const DENIED_MESSAGE = "Access wasn't approved on Hackatime. Try again whenever you're ready."

// Why a connection failed, in words a builder can act on.
export function describeHackatimeError(error) {
    if (error?.status === 503) return "Hackatime isn't set up on Torque yet. Try again later."
    if (error?.status === 429) return 'Too many tries in a row. Wait a minute, then try again.'
    if (error?.status === 403 && error.message) return error.message
    if (error?.status === 502) return error.message || "Couldn't check your Hackatime account right now. Try again in a minute."
    if (error?.status === 401) return "Hackatime didn't accept the connection. Try again."
    return "Couldn't reach the server. Check your connection and try again."
}

// Opens Hackatime. Resolves to the popup window (or never, when this tab is
// leaving for Hackatime); the outcome arrives through useHackatimeResult.
export async function connectHackatime() {
    // Opened before any await, so it still counts as part of the click and
    // isn't blocked; it's pointed at Hackatime once the URL arrives.
    const popup = window.open('', 'torque-hackatime', 'popup,width=520,height=760')

    let start
    try {
        start = await startHackatime()
    } catch (error) {
        popup?.close()
        throw error
    }

    savePending({
        state: start.state,
        mode: popup ? 'popup' : 'redirect',
        returnTo: window.location.pathname + window.location.search,
    })
    listen()

    if (popup) {
        popup.location.href = start.url
        return popup
    }
    window.location.assign(start.url)
    return new Promise(() => {})
}

// Calls `onResult({ ok, message })` when a connection started in this tab ends.
// `onResult` must be stable (useCallback).
export function useHackatimeResult(onResult) {
    useEffect(() => {
        const handler = (e) => onResult(e.detail)
        window.addEventListener(RESULT_EVENT, handler)
        return () => window.removeEventListener(RESULT_EVENT, handler)
    }, [onResult])
}

// The connect button's behaviour, for any button that starts it: `connect` to
// call on click, `waiting` while Hackatime is open, and `error` once it fails.
// Calls `onConnected` once the account is linked.
export function useConnectHackatime(onConnected) {
    const [waiting, setWaiting] = useState(false)
    const [error, setError] = useState(null)
    const watchRef = useRef(null)

    const stopWatching = () => clearInterval(watchRef.current)
    useEffect(() => stopWatching, [])

    useHackatimeResult(useCallback((result) => {
        stopWatching()
        setWaiting(false)
        if (result.ok) onConnected?.()
        else setError(result.message)
    }, [onConnected]))

    async function connect() {
        if (waiting) return
        setError(null)
        setWaiting(true)
        try {
            const popup = await connectHackatime()
            // Closing the popup without finishing just puts the button back.
            watchRef.current = setInterval(() => {
                if (popup.closed) { stopWatching(); setWaiting(false) }
            }, 500)
        } catch (e) {
            setWaiting(false)
            setError(describeHackatimeError(e))
        }
    }

    return { connect, waiting, error }
}

function announce(result) {
    window.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail: result }))
}

// One listener per tab, for the popup's callback message. Stays up after the
// popup closes, since the popup can't always be watched once it's on Hackatime.
let channel = null
function listen() {
    if (channel || typeof BroadcastChannel === 'undefined') return
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = async ({ data }) => {
        if (data?.type !== 'callback') return
        const pending = readPending()
        // Hackatime echoes the signed `state.signature`; ours is the part before
        // the dot. No match means another tab started it, so let that one answer.
        const echoed = data.state ?? ''
        const ours = pending?.state === echoed.slice(0, echoed.lastIndexOf('.'))
        if (!pending || (!ours && !(data.denied && !echoed))) return
        clearPending()

        let result
        if (data.denied || !data.code) {
            result = { ok: false, message: DENIED_MESSAGE }
        } else {
            try {
                await finishHackatime(data.code, data.state, pending.state)
                result = { ok: true }
            } catch (error) {
                result = { ok: false, message: describeHackatimeError(error) }
            }
        }
        channel.postMessage({ type: 'done', state: data.state, ...result })
        announce(result)
    }
}
