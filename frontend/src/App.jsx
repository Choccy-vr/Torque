import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import './App.css'

function App() {

  return (
    <Router>
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
        </Routes>
    </Router>
  )
}

export default App
