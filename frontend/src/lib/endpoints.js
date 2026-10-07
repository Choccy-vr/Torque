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
