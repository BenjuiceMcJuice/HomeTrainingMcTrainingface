import { Routes, Route } from 'react-router-dom'
import Nav from './components/layout/Nav'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Plan from './pages/Plan'

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-[#1a1d2e]">
      <Nav />
      <main className="pb-16 md:pb-0">
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/log"     element={<Log />} />
          <Route path="/history" element={<History />} />
          <Route path="/plan"    element={<Plan />} />
        </Routes>
      </main>
    </div>
  )
}
