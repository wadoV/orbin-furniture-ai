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
          <span className="text-[14px] font-black text-black">O</span>
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
