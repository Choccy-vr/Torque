import { supabase } from './supabase.js'
import { config } from './config.js'

// fetch() against the backend, with the current access token attached.
// getSession() refreshes the token first if it's expired, so callers never
// need to touch or hold onto the token themselves.

export async function apiFetch(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession()

    const headers = new Headers(options.headers)
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`)
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    return fetch(`${config.apiUrl}/${path.replace(/^\/+/, '')}`, { ...options, headers })
}
