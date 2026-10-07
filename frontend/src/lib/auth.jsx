import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import { config } from './config.js'
import { AuthContext, useAuth } from './useAuth.js'
import { clearMyProfile } from './endpoints.js'

const DEV_MODE = import.meta.env.DEV

// Dev login (dev builds only): a fake, token-less session so the UI can be
// clicked through without the OIDC provider. Only active once devLogin() has
// been used — otherwise dev builds go through the real Supabase flow below.
const DEV_SESSION = {
    user: {
        id: 'dev-user',
        email: 'dev@example.com',
        user_metadata: { full_name: 'Dev User' },
    },
}
const isDevLogin = () => DEV_MODE && sessionStorage.getItem('dev-login') === 'true'

export function AuthProvider({ children }) {
    const [devLoggedIn] = useState(isDevLogin)
    const [session, setSession] = useState(devLoggedIn ? DEV_SESSION : null)
    const [loading, setLoading] = useState(!devLoggedIn)

    useEffect(() => {
        if (devLoggedIn) return

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next)
        })

        // Resolves after supabase-js has exchanged any ?code= from the OIDC redirect.
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setLoading(false)

            const url = new URL(window.location.href)
            if (url.searchParams.has('code')) {
                url.searchParams.delete('code')
                window.history.replaceState(null, '', url.pathname + url.search + url.hash)
            }
        })

        return () => subscription.unsubscribe()
    }, [devLoggedIn])

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        signIn: (redirectPath = '/home') =>
            supabase.auth.signInWithOAuth({
                provider: config.oidcProvider,
                options: { redirectTo: window.location.origin + redirectPath },
            }),

        signOut: () => {
            if (devLoggedIn) {
                sessionStorage.removeItem('dev-login')
                setSession(null)
                window.location.href = '/'
                return
            }

            clearMyProfile()
            return supabase.auth.signOut()
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
