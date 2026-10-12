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

async function sendJson(method, path, body) {
    const res = await apiFetch(path, { method, body: JSON.stringify(body) })
    if (!res.ok) throw new ApiError(res.status, await readError(res))
    return res.status === 204 ? null : res.json()
}

// The backend answers most failures with a plain sentence ("Title is
// required!"), but model-binding failures come back as problem+json.
async function readError(res) {
    const text = await res.text().catch(() => '')
    try {
        const body = JSON.parse(text)
        const first = body.errors && Object.values(body.errors).flat()[0]
        return first || body.title || text
    } catch {
        return text
    }
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
