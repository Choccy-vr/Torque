import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import Explore from './pages/Explore.jsx'
import './App.css'

// Fumadocs + shiki are heavy, so the docs only load when visited.
const Docs = lazy(() => import('./pages/Docs.jsx'))

function App() {

  return (
    <Router>
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            {/*<Route path="/projects/:id" element={<Projects />} /*/}
            <Route path="/explore" element={<Explore />} />
            <Route path="/docs/*" element={<Suspense fallback={null}><Docs /></Suspense>} />
        </Routes>
    </Router>
  )
}

export default App
