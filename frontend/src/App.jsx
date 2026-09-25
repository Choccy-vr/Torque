import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import Explore from './pages/Explore.jsx'
import './App.css'

function App() {

  return (
    <Router>
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            {/*<Route path="/projects/:id" element={<Projects />} /*/}
            <Route path="/explore" element={<Explore />} />
        </Routes>
    </Router>
  )
}

export default App
