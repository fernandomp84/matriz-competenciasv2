import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Procesar from './pages/Procesar'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="procesar" element={<Procesar />} />
          {/* Redirigir rutas antiguas */}
          <Route path="megamatriz" element={<Navigate to="/procesar" replace />} />
          <Route path="matrix" element={<Navigate to="/procesar" replace />} />
          <Route path="results" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
