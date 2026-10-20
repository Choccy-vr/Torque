import { lazy, Suspense, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import Project from './pages/Project.jsx'
import NewProject from './pages/NewProject.jsx'
import Explore from './pages/Explore.jsx'
import Profile from './pages/Profile.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminUser from './pages/admin/User.jsx'
import AdminProjects from './pages/admin/Projects.jsx'
import AdminProject from './pages/admin/Project.jsx'
import AdminShips from './pages/admin/Ships.jsx'
import AdminShip from './pages/admin/Ship.jsx'
import AdminAnnouncements from './pages/admin/Announcements.jsx'
import AdminSettings from './pages/admin/Settings.jsx'
import HackatimeCallback from './pages/HackatimeCallback.jsx'
import Onboarding from './components/Onboarding.jsx'
import RequireOnboarding from './components/RequireOnboarding.jsx'
import { AuthProvider, RequireAuth, RequireGuest } from './lib/auth.jsx'
import { useAuth } from './lib/useAuth.js'
import { CALLBACK_PATH } from './lib/hackatimePending.js'
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
    const { user, loading } = useAuth();
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
                <Route path="/" element={<RequireGuest> <Landing/> </RequireGuest>} />
                <Route element={<RequireOnboarding user={user} loading={loading} />}>
                    <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
                    <Route
                        path="/onboarding"
                        element={
                            <RequireAuth>
                                <>
                                    <div inert aria-hidden="true">
                                        <Home />
                                    </div>
                                    <Onboarding />
                                </>
                            </RequireAuth>
                        }
                    />
                    <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
                    <Route path="/projects/new" element={<RequireAuth><NewProject /></RequireAuth>} />
                    <Route path="/projects/:id" element={<Project />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/docs/*" element={<Suspense fallback={<div className="min-h-screen" />}><Docs /></Suspense>} />
                    <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                    <Route path="/profile/:id" element={<Profile />} />
                    <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                    <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
                    <Route path="/admin/users/:id" element={<RequireAuth><AdminUser /></RequireAuth>} />
                    <Route path="/admin/projects" element={<RequireAuth><AdminProjects /></RequireAuth>} />
                    <Route path="/admin/projects/:id" element={<RequireAuth><AdminProject /></RequireAuth>} />
                    <Route path="/admin/ships" element={<RequireAuth><AdminShips /></RequireAuth>} />
                    <Route path="/admin/ships/:id" element={<RequireAuth><AdminShip /></RequireAuth>} />
                    <Route path="/admin/announcements" element={<RequireAuth><AdminAnnouncements /></RequireAuth>} />
                    <Route path="/admin/settings" element={<RequireAuth><AdminSettings /></RequireAuth>} />
                    {/* Not behind RequireAuth: the popup copy of this page is signed out on purpose. */}
                    <Route path={CALLBACK_PATH} element={<HackatimeCallback />} />
                </Route>
            </Routes>
        </div>
    )
}

function App() {

  return (
    <AuthProvider>
        <Router>
            <AppRoutes />
        </Router>
    </AuthProvider>
  )
}

export default App
