import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import { config } from './config.js'
import { AuthContext, useAuth } from './useAuth.js'

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    const DEV_MODE = import.meta.env.DEV;

    useEffect(() => {
        if (DEV_MODE) {
            const devLoggedIn = sessionStorage.getItem('dev-login')

            if (devLoggedIn === 'true') {
                setSession({
                    user: {
                        id: 'dev-user',
                        email: 'dev@example.com',
                        user_metadata: {
                            full_name: 'Dev User',
                        },
                    },
                })
            }
            setLoading(false)
            return
        }

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
    }, [DEV_MODE])

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
            if (DEV_MODE) {
                sessionStorage.removeItem('dev-login')
                setSession(null)
                window.location.href = '/'
                return
            }

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
