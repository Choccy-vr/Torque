import { config } from './config.js'

// fetch() against the backend. The session is an HttpOnly cookie the backend set at
// sign-in, so callers never see or hold a token; credentials: 'include' sends it to
// the API's origin in dev too (Vite and the backend are different ports there).
// Writes also carry X-Torque-Request, which the backend requires alongside the
// cookie so another site can't submit forms with it (see AuthExtension.CsrfHeader).

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers)
    if (!SAFE_METHODS.includes((options.method ?? 'GET').toUpperCase())) {
        headers.set('X-Torque-Request', '1')
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    return fetch(apiUrl(path), { ...options, headers, credentials: 'include' })
}

export function apiUrl(path) {
    return `${config.apiUrl}/${path.replace(/^\/+/, '')}`
}
