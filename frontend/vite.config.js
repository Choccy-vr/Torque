import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [fumadocsMdx(), react(), tailwindcss()],
  // fumadocs-mdx excludes the fumadocs-* packages from pre-bundling, so the
  // react-router they import would be served raw in dev and choke on its
  // CommonJS `cookie` dependency. Pre-bundle it explicitly.
  optimizeDeps: {
    include: ['react-router'],
  },
})
