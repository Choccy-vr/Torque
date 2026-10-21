import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch, apiUrl } from './api.js'
import { AuthContext, useAuth } from './useAuth.js'
import { clearMyProfile } from './endpoints.js'

const DEV_MODE = import.meta.env.DEV

// Dev login (dev builds only): a fake, cookie-less session so the UI can be
// clicked through without Hack Club Auth. Only active once devLogin() has
// been used — otherwise dev builds go through the real sign-in below.
const DEV_SESSION = {
    user: {
        id: 'dev-user',
        email: 'dev@example.com',
        name: 'Dev User',
    },
}
const isDevLogin = () => DEV_MODE && sessionStorage.getItem('dev-login') === 'true'

// Sign-in is run by the backend: /auth/login sends the browser to Hack Club Auth,
// which returns to the backend, which sets an HttpOnly session cookie and redirects
// back here. All this side ever does is ask /auth/me who that cookie belongs to.
export function AuthProvider({ children }) {
    const [devLoggedIn] = useState(isDevLogin)
    const [session, setSession] = useState(devLoggedIn ? DEV_SESSION : null)
    const [loading, setLoading] = useState(!devLoggedIn)

    useEffect(() => {
        if (devLoggedIn) return

        let cancelled = false
        apiFetch('auth/me')
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
            .then((user) => {
                if (cancelled) return
                setSession(user ? { user } : null)
                setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [devLoggedIn])

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        signIn: (redirectPath = '/home') => {
            window.location.href = apiUrl(`auth/login?returnTo=${encodeURIComponent(redirectPath)}`)
        },

        signOut: async () => {
            if (devLoggedIn) {
                sessionStorage.removeItem('dev-login')
                setSession(null)
                window.location.href = '/'
                return
            }

            clearMyProfile()
            await apiFetch('auth/logout', { method: 'POST' }).catch(() => null)
            setSession(null)
        },

        devLogin: (redirectPath = '/home') => {
            if (!DEV_MODE) return

            sessionStorage.setItem('dev-login', 'true')

            window.location.href = redirectPath
        },
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Wrap routes that need a signed-in user; bounces to the landing page otherwise.
export function RequireAuth({ children }) {
    const { session, loading } = useAuth()
    if (loading) return <div className="min-h-screen" />
    if (!session) return <Navigate to="/" replace />
    return children
}

export function RequireGuest({ children }) {
    const { session, loading } = useAuth()
    if (loading) return <div className="min-h-screen" />
    if (session) return <Navigate to="/home" replace />
    return children
}