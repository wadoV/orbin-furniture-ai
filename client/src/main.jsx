/**
 * Orbin AI - main.jsx v2.0
 * ProtectedRoute aguarda Supabase Auth antes de redirigir.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { PreferencesProvider } from './context/PreferencesContext.jsx'
import { UserProvider, useUser } from './context/UserContext.jsx'
import App         from './App.jsx'
import LandingPage from './components/LandingPage.jsx'
import { LoginPage, RegisterPage, VerifyOTPPage } from './components/AuthPages.jsx'
import { TermsOfService, PrivacyPolicy } from './components/LegalPages.jsx'
import SeoMeta from './components/SeoMeta.jsx'
import ComoFazerListaCorte      from './pages/blog/ComoFazerListaCorte.jsx'
import CaixaTecnica13mm         from './pages/blog/CaixaTecnica13mm.jsx'
import DisenoParametricoMuebles from './pages/blog/DisenoParametricoMuebles.jsx'

function AuthLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)' }}>
          <svg viewBox="0 0 300 360" className="w-6 h-6" fill="none" aria-hidden="true">
            <g transform="rotate(35 150 180)">
              <path fill="none" stroke="#0E0E0E" strokeWidth="6" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
              <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
            </g>
          </svg>
        </div>
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useUser()
  if (isLoading) return <AuthLoading />
  if (!user.isLoggedIn) return <Navigate to="/login" replace />
  if (user.isLoggedIn && !user.isVerified) return <Navigate to="/verify" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, isLoading } = useUser()
  if (isLoading) return <AuthLoading />
  if (user.isLoggedIn) {
    if (!user.isVerified) return <Navigate to="/verify" replace />
    return <Navigate to="/app" replace />
  }
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <PreferencesProvider>
      <UserProvider>
        <SeoMeta />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/verify"   element={<VerifyOTPPage />} />
          <Route path="/terms"    element={<TermsOfService />} />
          <Route path="/privacy"  element={<PrivacyPolicy />} />
          <Route path="/app"      element={<ProtectedRoute><App /></ProtectedRoute>} />
          <Route path="/blog/como-fazer-lista-de-corte-mdf"              element={<ComoFazerListaCorte />} />
          <Route path="/blog/corredicas-telescopicas-caixa-tecnica-13mm" element={<CaixaTecnica13mm />} />
          <Route path="/blog/diseño-parametrico-muebles-cocina"          element={<DisenoParametricoMuebles />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    </PreferencesProvider>
  </BrowserRouter>
)
