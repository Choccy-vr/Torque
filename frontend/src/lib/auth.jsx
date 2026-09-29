import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'
import { config } from './config.js'
import { AuthContext, useAuth } from './useAuth.js'

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
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
    }, [])

    const value = {
        session,
        user: session?.user ?? null,
        loading,
        signIn: (redirectPath = '/home') =>
            supabase.auth.signInWithOAuth({
                provider: config.oidcProvider,
                options: { redirectTo: window.location.origin + redirectPath },
            }),
        signOut: () => supabase.auth.signOut(),
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
