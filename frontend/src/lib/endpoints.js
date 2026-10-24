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
    const err = new ApiError(res.status, first || body?.error || body?.title || text, body?.paused ?? null)
    // Shop failures name their reason (`code`); a bulk item add lists its bad `rows`.
    if (body?.code) err.code = body.code
    if (Array.isArray(body?.rows)) err.rows = body.rows
    return err
}

// POST api/upload/image (multipart) — stores one image in the bucket and
// resolves to its public URL. purpose: cover | journal | shop | announcement.
export async function uploadImage(file, purpose) {
    const body = new FormData()
    body.append('purpose', purpose)
    body.append('file', file)
    const res = await apiFetch('api/upload/image', { method: 'POST', body })
    if (!res.ok) throw await apiError(res)
    return (await res.json()).url
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

// PUT api/user/me/onboarding — saves username, bio and profile picture, and sets
// completedFirstTimeSetup. Every field is overwritten, so pass the current picture
// to keep it.
export async function completeOnboarding({ username, bio, profilePictureUrl }) {
    const result = await sendJson('PUT', 'api/user/me/onboarding', { username, bio, profilePictureUrl })
    clearMyProfile()
    return result
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

// POST api/slack/channels/join — { results: [{ channelId, status }] }: invites
// the signed-in user to Torque's Slack channels
export function joinSlackChannels() {
    return sendJson('POST', 'api/slack/channels/join')
}

// GET api/hackatime/status — { connected }
export function getHackatimeStatus() {
    return getJson('api/hackatime/status')
}

// POST api/hackatime/start — { url, state }: the Hackatime authorize URL, and the
// state to hold onto and echo back as `storedState` in the callback
export function startHackatime() {
    return sendJson('POST', 'api/hackatime/start')
}

// POST api/hackatime/callback — links Hackatime to the signed-in user
export function finishHackatime(code, state, storedState) {
    return sendJson('POST', 'api/hackatime/callback', { code, state, storedState })
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

// ---------------------------------------------------------------- admin
// Everything below is admin-only (403 otherwise). See backend/README.md.

// Drops empty values so "no filter" isn't sent as ?status=
function query(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

// GET api/admin/user/search — AdminUserSummaryDto[], newest first, max 50
export function searchAdminUsers(q) {
    return getJson(`api/admin/user/search${query({ q })}`)
}

// GET api/admin/user/{id} — AdminUserDto
export function getAdminUser(id) {
    return getJson(`api/admin/user/${encodeURIComponent(id)}`)
}

// PATCH api/admin/user/{id} — AdminUserDto. { internalNote?, watchlisted?, streakFreezes? }
export function updateAdminUser(id, changes) {
    return sendJson('PATCH', `api/admin/user/${encodeURIComponent(id)}`, changes)
}

// POST api/admin/user/{id}/ban — AdminUserDto
export function setUserBanned(id, banned) {
    return sendJson('POST', `api/admin/user/${encodeURIComponent(id)}/ban`, { banned })
}

// PUT api/admin/user/{id}/roles — AdminUserDto. roles: subset of ["admin", "reviewer"]
export function setUserRoles(id, roles) {
    return sendJson('PUT', `api/admin/user/${encodeURIComponent(id)}/roles`, { roles })
}

// PATCH api/admin/user/{id}/timezone — { id, timeZone }
export function setUserTimeZone(id, timeZone) {
    return sendJson('PATCH', `api/admin/user/${encodeURIComponent(id)}/timezone`, { timeZone })
}

// GET api/admin/user/{id}/volts/history — { id, volts, entries: LedgerEntryDto[] }
export function getUserVoltsHistory(id) {
    return getJson(`api/admin/user/${encodeURIComponent(id)}/volts/history`)
}

// POST api/admin/user/{id}/volts — { id, volts }. amount is signed.
export function adjustUserVolts(id, amount, reason) {
    return sendJson('POST', `api/admin/user/${encodeURIComponent(id)}/volts`, { amount, reason })
}

// GET api/admin/project/search — AdminProjectSummaryDto[]. { q?, status?, ownerId?, archived? }
export function searchAdminProjects(params = {}) {
    return getJson(`api/admin/project/search${query(params)}`)
}

// GET api/admin/project/{id} — AdminProjectDto
export function getAdminProject(id) {
    return getJson(`api/admin/project/${encodeURIComponent(id)}`)
}

// PATCH api/admin/project/{id} — AdminProjectDto. { tier?, isArchived?, exceptional? }
export function updateAdminProject(id, changes) {
    return sendJson('PATCH', `api/admin/project/${encodeURIComponent(id)}`, changes)
}

// POST api/admin/project/{id}/staff-pick — PublicProjectDto
export function setStaffPick(id, isStaffPick) {
    return sendJson('POST', `api/admin/project/${encodeURIComponent(id)}/staff-pick`, { isStaffPick })
}

// GET api/admin/project/{id}/lapse — { timelapses: TimelapseDto[] }
export function getProjectTimelapses(id) {
    return getJson(`api/admin/project/${encodeURIComponent(id)}/lapse`)
}

// GET api/admin/ships — AdminShipmentSummaryDto[]. { q?, status?, userId?, projectId? }
export function searchAdminShips(params = {}) {
    return getJson(`api/admin/ships${query(params)}`)
}

// GET api/admin/ships/{id} — AdminShipmentDetailDto (with reviews)
export function getAdminShip(id) {
    return getJson(`api/admin/ships/${encodeURIComponent(id)}`)
}

// POST api/admin/announcement/create — AnnouncementDto. { title, body (markdown) }
export function createAnnouncement(body) {
    return sendJson('POST', 'api/admin/announcement/create', body)
}

// PATCH api/admin/announcement/{id} — AnnouncementDto. { title?, body? }
export function updateAnnouncement(id, changes) {
    return sendJson('PATCH', `api/admin/announcement/${encodeURIComponent(id)}`, changes)
}

// DELETE api/admin/announcement/{id} — 204
export function deleteAnnouncement(id) {
    return sendJson('DELETE', `api/admin/announcement/${encodeURIComponent(id)}`)
}

// GET api/admin/shop/items — AdminShopItemDto[], every item by level then sortOrder
export function getAdminShopItems() {
    return getJson('api/admin/shop/items')
}

// POST api/admin/shop/items — AdminShopItemDto. Body: see ShopItemInputDto
export function createShopItem(item) {
    return sendJson('POST', 'api/admin/shop/items', item)
}

// POST api/admin/shop/items/bulk — AdminShopItemDto[]. All or nothing: a 400
// carries err.rows = [{ index, name, error }]
export function bulkCreateShopItems(items) {
    return sendJson('POST', 'api/admin/shop/items/bulk', items)
}

// PUT api/admin/shop/items/{id} — AdminShopItemDto. Replaces the whole item.
export function updateShopItem(id, item) {
    return sendJson('PUT', `api/admin/shop/items/${encodeURIComponent(id)}`, item)
}

// DELETE api/admin/shop/items/{id} — { deleted, deactivated }
export function deleteShopItem(id) {
    return sendJson('DELETE', `api/admin/shop/items/${encodeURIComponent(id)}`)
}

// GET api/admin/shop/daily — { today, endsAt, current, picks[] }
export function getAdminShopDaily() {
    return getJson('api/admin/shop/daily')
}

// PUT api/admin/shop/daily/today — same as getAdminShopDaily. No itemId = reroll.
export function setShopDaily(itemId = null) {
    return sendJson('PUT', 'api/admin/shop/daily/today', { itemId })
}

// GET api/admin/shop/orders — AdminShopOrderDto[] (max 200). { status?, itemId?, userId?, sort? }
export function getAdminShopOrders(params = {}) {
    return getJson(`api/admin/shop/orders${query(params)}`)
}

// GET api/admin/shop/orders/{id} — AdminShopOrderDto with the shipping address
export function getAdminShopOrder(id) {
    return getJson(`api/admin/shop/orders/${encodeURIComponent(id)}`)
}

// POST api/admin/shop/orders/{id}/fulfill — AdminShopOrderDto. { trackingReference?, note? }
export function fulfillShopOrder(id, body) {
    return sendJson('POST', `api/admin/shop/orders/${encodeURIComponent(id)}/fulfill`, body)
}

// POST api/admin/shop/orders/{id}/refund — AdminShopOrderDto. { reason }
export function refundShopOrder(id, reason) {
    return sendJson('POST', `api/admin/shop/orders/${encodeURIComponent(id)}/refund`, { reason })
}

// GET api/project/search — SearchProjectDto[] (with ownerUsername), title matches
// first, capped at SEARCH_LIMIT
export const SEARCH_LIMIT = 25
export function searchProjects(q) {
    return getJson(`api/project/search?q=${encodeURIComponent(q)}`)
}

// GET api/project/leaderboard/{hours|volts} — LeaderboardProjectDto[], top 50
// approved projects
export function getLeaderboard(kind) {
    return getJson(`api/project/leaderboard/${kind === 'volts' ? 'volts' : 'hours'}`)
}

// GET api/user/me/banned — { banned, reason } (reason: "hackatime" | "other" | null). Answers even while banned.
export function getBanStatus() {
    return getJson('api/user/me/banned')
}

// PUT api/user/me/timezone — { timeZone }. One-time: 409 once it's set.
export async function setMyTimeZone(timeZone) {
    const result = await sendJson('PUT', 'api/user/me/timezone', { timeZone })
    clearMyProfile()
    return result
}

// GET api/shop — ShopDto: { unlockedTier, region, volts, daily, tiers[] }, priced
// for the caller's region
export function getShop() {
    return getJson('api/shop')
}

// GET api/shop/marquee — public { name, imageUrl, tier, description, price, hasOptions }[] for the landing tape
export function getShopMarquee() {
    return getJson('api/shop/marquee')
}

// GET api/shop/address — { address | null, region, editUrl }, live from Hack Club Auth
export function getShopAddress() {
    return getJson('api/shop/address')
}

// POST api/shop/purchase — { order, volts }. Failures carry err.code.
// { itemId, variantId?, quantity, addressConfirmed, note?, clientRequestId }
export function purchaseShopItem(body) {
    return sendJson('POST', 'api/shop/purchase', body)
}

// GET api/shop/orders — ShopOrderDto[], newest first
export function getMyShopOrders() {
    return getJson('api/shop/orders')
}

// POST api/shop/orders/{id}/cancel — { order, volts }
export function cancelShopOrder(id) {
    return sendJson('POST', `api/shop/orders/${encodeURIComponent(id)}/cancel`)
}
