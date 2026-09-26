import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import Explore from './pages/Explore.jsx'
import './App.css'

// Fumadocs + shiki are heavy, so the docs only load when visited.
const loadDocs = () => import('./pages/Docs.jsx')
const Docs = lazy(loadDocs)

// Which part of the site a path belongs to. The page fade replays only when
// this changes, so moving between doc pages doesn't re-fade the whole layout.
function sectionOf(pathname) {
    if (pathname === '/') return 'landing'
    if (pathname.startsWith('/docs')) return 'docs'
    return 'app'
}

function AppRoutes() {
    const { pathname } = useLocation()
    const section = sectionOf(pathname)

    // Start each section at the top instead of wherever the last one was scrolled.
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [section])

    // Fetch the docs chunk in the background once the first page is up, so
    // opening the docs doesn't sit on an empty screen while it downloads.
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500))
        idle(() => loadDocs())
    }, [])

    return (
        <div key={section} className="t-page">
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<Home />} />
                <Route path="/projects" element={<Projects />} />
                {/*<Route path="/projects/:id" element={<Projects />} /*/}
                <Route path="/explore" element={<Explore />} />
                <Route path="/docs/*" element={<Suspense fallback={<div className="min-h-screen" />}><Docs /></Suspense>} />
            </Routes>
        </div>
    )
}

function App() {

  return (
    <Router>
        <AppRoutes />
    </Router>
  )
}

export default App
