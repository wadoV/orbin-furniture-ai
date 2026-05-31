/**
 * Orbin AI — main.jsx
 * React Router v6 + UserProvider + PreferencesProvider
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { PreferencesProvider } from './context/PreferencesContext.jsx'
import { UserProvider, useUser } from './context/UserContext.jsx'

import App        from './App.jsx'
import LandingPage from './components/LandingPage.jsx'
import { LoginPage, RegisterPage } from './components/AuthPages.jsx'

// Lee sesión del localStorage directamente para evitar race condition de React 18
function isLoggedIn() {
  try {
    const saved = localStorage.getItem('orbin-user-session')
    return saved ? JSON.parse(saved).isLoggedIn === true : false
  } catch { return false }
}

function ProtectedRoute({ children }) {
  const { user } = useUser()
  // Doble check: estado React + localStorage síncrono
  if (!user.isLoggedIn && !isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useUser()
  if (user.isLoggedIn || isLoggedIn()) return <Navigate to="/app" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <UserProvider>
          <Routes>
            <Route path="/"         element={<LandingPage />} />
            <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/app"      element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </UserProvider>
      </PreferencesProvider>
    </BrowserRouter>
  </React.StrictMode>
)
