import { useSyncExternalStore } from 'react'
import { apiFetch } from './api.js'

// Global settings (GET api/settings): admin switches that pause ships,
// journaling and so on. Fetched once per page load and shared by every
// component. A paused endpoint answers 503 { error, paused }; endpoints.js
// reports that here, so the UI catches up without a reload.

export const PAUSE = {
    ships: 'ships_paused',
    resubmissions: 'resubmissions_paused',
    projectCreation: 'project_creation_paused',
    journaling: 'journaling_paused',
    streaks: 'streaks_paused',
    shop: 'shop_paused',
}

// { [key]: { paused, message } }, or null until the first load lands.
let settings = null
let loading = null
const listeners = new Set()

function set(next) {
    settings = next
    for (const listener of listeners) listener()
}

// If the request fails, act as if nothing is paused: the backend still
// refuses a paused action, and its 503 lands here through notePaused.
export function loadSettings({ force = false } = {}) {
    if (loading && !force) return loading
    loading = apiFetch('api/settings')
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}))
        .then((next) => {
            set(next)
            return next
        })
    return loading
}

function subscribe(listener) {
    listeners.add(listener)
    loadSettings()
    return () => listeners.delete(listener)
}

export function useSettings() {
    return useSyncExternalStore(subscribe, () => settings)
}

// The message to show while `key` is on, or null when it's off.
export function pausedMessage(current, key) {
    const setting = current?.[key]
    return setting?.paused ? setting.message : null
}

// Who can flip them (/admin/settings): a profile (OwnProfileDto) with the admin role.
export const isAdmin = (profile) => Boolean(profile?.role?.includes('admin'))

// Called when an action comes back 503 { paused }: it was switched on after
// this page loaded.
export function notePaused(key, message) {
    set({ ...settings, [key]: { paused: true, message } })
}
