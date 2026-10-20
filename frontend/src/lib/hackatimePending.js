// The Hackatime connection in flight: the OAuth state to echo back, whether it
// runs in a popup or in this tab, and where to return to afterwards. Kept in
// localStorage so the popup and the tab that opened it both see it. No imports,
// so supabase.js can use it without a cycle.

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

// The callback page, loaded inside the popup. It stays signed out (see
// supabase.js) so it never refreshes the session token out from under the tab
// that opened it; that tab finishes the connection instead.
export function isCallbackPopup() {
    return window.location.pathname === CALLBACK_PATH && readPending()?.mode === 'popup'
}
