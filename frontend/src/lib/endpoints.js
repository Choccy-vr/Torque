import { apiFetch } from './api.js'
import { notePaused } from './settings.js'

// Typed-ish wrappers around backend endpoints (see backend/README.md).
// Each one resolves to the parsed JSON body or throws an ApiError.

export class ApiError extends Error {
    // `paused` is the setting's key when an admin switch blocked the request.
    constructor(status, message, paused = null) {
        super(message || `Request failed (${status})`)
        this.status = status
        this.paused = paused
    }
}

async function getJson(path) {
    const res = await apiFetch(path)
    if (!res.ok) throw await apiError(res)
    return res.json()
}

async function sendJson(method, path, body) {
    const res = await apiFetch(path, { method, body: JSON.stringify(body) })
    if (!res.ok) throw await apiError(res)
    return res.status === 204 ? null : res.json()
}

// The backend answers most failures with a plain sentence ("Title is
// required!"), but model-binding failures come back as problem+json, and
// paused actions (and bans) as { error }.
async function apiError(res) {
    const text = await res.text().catch(() => '')
    let body
    try {
        body = JSON.parse(text)
    } catch {
        return new ApiError(res.status, text)
    }
    if (body?.paused) notePaused(body.paused, body.error)
    const first = body?.errors && Object.values(body.errors).flat()[0]
    return new ApiError(res.status, first || body?.error || body?.title || text, body?.paused ?? null)
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

// GET api/project/staff-picks — PublicProjectDto[], newest first
export function getStaffPicks() {
    return getJson('api/project/staff-picks')
}

// GET api/ships/get/me — OwnShipmentDto[], newest first
export function getMyShips() {
    return getJson('api/ships/get/me')
}

// GET api/announcement — AnnouncementDto[], newest first, capped at 30.
// `body` is markdown.
export function getAnnouncements() {
    return getJson('api/announcement')
}

// GET api/project/{id} — PublicProjectDto
export function getProject(id) {
    return getJson(`api/project/${encodeURIComponent(id)}`)
}

// POST api/devlog/batch — PublicDevlogDto[] for up to 30 ids
export function getDevlogs(ids) {
    return sendJson('POST', 'api/devlog/batch', { ids })
}

// POST api/project/create — PrivateProjectDto of the new project
export function createProject(body) {
    return sendJson('POST', 'api/project/create', body)
}

// PATCH api/project/{id} — PrivateProjectDto. Omitted fields are unchanged, "" clears.
export function updateProject(id, changes) {
    return sendJson('PATCH', `api/project/${encodeURIComponent(id)}`, changes)
}

// POST api/project/{id}/archive — PrivateProjectDto
export function setProjectArchived(id, isArchived) {
    return sendJson('POST', `api/project/${encodeURIComponent(id)}/archive`, { isArchived })
}

// POST api/project/{id}/streak/freezes — PrivateProjectDto
export function setStreakFreezesPaused(id, paused) {
    return sendJson('POST', `api/project/${encodeURIComponent(id)}/streak/freezes`, { paused })
}

// POST api/devlog/create — PublicDevlogDto
export function createDevlog(body) {
    return sendJson('POST', 'api/devlog/create', body)
}

// POST api/ships/create — the new shipment
export function createShip(body) {
    return sendJson('POST', 'api/ships/create', body)
}

// GET api/hackatime/projects — { projects: string[] }
export function getHackatimeProjects() {
    return getJson('api/hackatime/projects')
}

// POST api/hackatime/hours — { hours, perProject: { [name]: hours } } for the given names
export function getHackatimeHours(projectNames) {
    return sendJson('POST', 'api/hackatime/hours', { projectNames })
}

// GET api/devlog/preview/{projectId} — what a journal posted now would credit:
// { trackedHours, uncappedHours, maxHours, hackatimeLinked, hackatimeReachable }
export function getJournalPreview(projectId) {
    return getJson(`api/devlog/preview/${encodeURIComponent(projectId)}`)
}

// GET api/admin/settings — AdminSettingDto[] (admins only; 403 otherwise)
export function getAdminSettings() {
    return getJson('api/admin/settings')
}

// PATCH api/admin/settings/{key} — AdminSettingDto. { paused?, message? }; message "" = default.
export function updateSetting(key, changes) {
    return sendJson('PATCH', `api/admin/settings/${encodeURIComponent(key)}`, changes)
}
