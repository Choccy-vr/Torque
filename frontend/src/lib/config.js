// Per-environment settings, injected by Vite from .env files at build time.
// Copy .env.example to .env.local for dev; set the same VITE_* vars in prod.
function required(name) {
    const value = import.meta.env[name]
    if (!value) throw new Error(`Missing ${name} (see frontend/.env.example)`)
    return value
}

export const config = {
    supabaseUrl: required('VITE_SUPABASE_URL'),
    supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY'),
    oidcProvider: required('VITE_OIDC_PROVIDER'),
    apiUrl: required('VITE_API_URL').replace(/\/+$/, ''),
}
