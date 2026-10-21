// Per-environment settings. In the Docker image the backend serves /config.js, which sets
// window.__TORQUE_CONFIG__ from its env vars at runtime. In dev that file is an empty stub
// (public/config.js), so Vite's VITE_* vars from .env.local are used instead.
// Copy .env.example to .env.local for dev.
const runtime = window.__TORQUE_CONFIG__ ?? {}

export const config = {
    // Blank means same origin, which is how the Docker image serves the API
    apiUrl: (runtime.apiUrl ?? import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
}
