import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import NewProject from './pages/NewProject'
import Agents from './pages/Agents'
import NewAgent from './pages/NewAgent'
import Platforms from './pages/Platforms'
import RunDetail from './pages/RunDetail'
import LicensePage from './pages/LicensePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:projectId/runs/:runId" element={<RunDetail />} />
          <Route path="agents" element={<Agents />} />
          <Route path="agents/new" element={<NewAgent />} />
          <Route path="platforms" element={<Platforms />} />
          <Route path="license" element={<LicensePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
