import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import { isCallbackPopup } from './hackatimePending.js'

// sessionStorage instead of the default localStorage: the session is scoped to
// this tab and wiped when it closes, rather than sitting on disk indefinitely.
// Falls back to memory-only if storage is blocked (e.g. some private modes),
// and in the Hackatime popup, which must stay signed out (hackatimePending.js).
function tabStorage() {
    try {
        if (isCallbackPopup()) throw new Error('signed-out popup')
        const s = window.sessionStorage
        s.setItem('__probe', '1')
        s.removeItem('__probe')
        return s
    } catch {
        const mem = new Map()
        return {
            getItem: (k) => mem.get(k) ?? null,
            setItem: (k, v) => mem.set(k, v),
            removeItem: (k) => mem.delete(k),
        }
    }
}

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
        // PKCE: the provider redirects back with a one-time ?code= that
        // supabase-js exchanges itself, so tokens never appear in the URL.
        flowType: 'pkce',
        storage: tabStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
})
