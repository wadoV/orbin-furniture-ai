/**
 * Orbin AI — main.jsx COMMERCIAL_READY_V4.5
 * React Router v6 + UserProvider + PreferencesProvider
 * Routes: / (landing) | /login | /register | /app
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { PreferencesProvider } from './context/PreferencesContext.jsx'
import { UserProvider, useUser } from './context/UserContext.jsx'

import App from './App.jsx'
import LandingPage from './components/LandingPage.jsx'
import { LoginPage, RegisterPage } from './components/AuthPages.jsx'

// Protected Route: redirects to /login if not logged in
function ProtectedRoute({ children }) {
  const { user } = useUser()
  if (!user.isLoggedIn) return <Navigate to="/login" replace />
  return children
}

// Public Route: redirects to /app if already logged in
function PublicRoute({ children }) {
  const { user } = useUser()
  if (user.isLoggedIn) return <Navigate to="/app" replace />
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
