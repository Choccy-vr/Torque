import { defineDocs } from 'fumadocs-mdx/macro'
import { loader } from 'fumadocs-core/source'

// Docs content lives in frontend/content/docs (.mdx pages + meta.json for
// sidebar order). The fumadocs-mdx Vite plugin compiles it into the bundle,
// so pages can be looked up client-side — no server loader needed.
const docs = defineDocs({
  dir: 'content/docs',
})

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
