import { apiFetch } from './api.js'

// Typed-ish wrappers around backend endpoints (see backend/README.md).
// Each one resolves to the parsed JSON body or throws an ApiError.

export class ApiError extends Error {
    constructor(status, message) {
        super(message || `Request failed (${status})`)
        this.status = status
    }
}

async function getJson(path) {
    const res = await apiFetch(path)
    if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
    return res.json()
}

// The Navbar remounts on every page, so the profile is fetched once per page
// load and shared. A failed request isn't cached, so the next mount retries.
let profilePromise = null

// GET api/user/me — OwnProfileDto
export function getMyProfile() {
    profilePromise ??= getJson('api/user/me').catch((err) => {
        profilePromise = null
        throw err
    })
    return profilePromise
}

export function clearMyProfile() {
    profilePromise = null
}

// GET api/project/me — PrivateProjectDto[]
export function getMyProjects() {
    return getJson('api/project/me')
}

// GET api/user/{id} — PublicProfileDto
export function getUserProfile(id) {
    return getJson(`api/user/${encodeURIComponent(id)}`)
}

// GET api/project/user/{id} — PublicProjectDto[], newest first
export function getUserProjects(id) {
    return getJson(`api/project/user/${encodeURIComponent(id)}`)
}

// GET api/devlog/user/{id} — PublicDevlogDto[], newest first, capped at 30
export function getUserDevlogs(id) {
    return getJson(`api/devlog/user/${encodeURIComponent(id)}`)
}
