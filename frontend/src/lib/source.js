import { createElement } from 'react'
import { defineDocs } from 'fumadocs-mdx/macro'
import { loader } from 'fumadocs-core/source'
import {
  BookOpen,
  Cog,
  Flag,
  Gift,
  CircleHelp,
  Lightbulb,
  NotebookPen,
  Package,
  PencilRuler,
  Rocket,
  Route,
  Wrench,
  Zap,
} from 'lucide-react'

// Docs content lives in frontend/content/docs (.mdx pages + meta.json for
// sidebar order). The fumadocs-mdx Vite plugin compiles it into the bundle,
// so pages can be looked up client-side — no server loader needed.
const docs = defineDocs({
  dir: 'content/docs',
})

// Icons usable from `icon:` in page frontmatter / meta.json and in sidebar
// separators ("---[Rocket]Start Here---"). Listed by hand instead of using
// fumadocs' lucideIconsPlugin, which would bundle every Lucide icon.
const icons = {
  BookOpen,
  Cog,
  Flag,
  Gift,
  CircleHelp,
  Lightbulb,
  NotebookPen,
  Package,
  PencilRuler,
  Rocket,
  Route,
  Wrench,
  Zap,
}

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon(name) {
    if (!name) return
    if (name in icons) return createElement(icons[name])
    console.warn(`[docs] Unknown sidebar icon: ${name}`)
  },
})
