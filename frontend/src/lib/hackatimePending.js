// The Hackatime connection in flight: the OAuth state to echo back, whether it
// runs in a popup or in this tab, and where to return to afterwards. Kept in
// localStorage so the popup and the tab that opened it both see it. No imports,
// so anything can use it without a cycle.

export const CALLBACK_PATH = '/auth/hackatime/callback'

const KEY = 'torque:hackatime-connect'
const MAX_AGE = 15 * 60 * 1000

export function savePending(pending) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...pending, at: Date.now() }))
    } catch {
        // Storage blocked: the callback page then says the link expired.
    }
}

export function readPending() {
    try {
        const pending = JSON.parse(localStorage.getItem(KEY))
        return pending && Date.now() - pending.at < MAX_AGE ? pending : null
    } catch {
        return null
    }
}

export function clearPending() {
    try {
        localStorage.removeItem(KEY)
    } catch {
        // Nothing to clear.
    }
}
