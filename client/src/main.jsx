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
import { DEMO_MODE } from './config/demoMode.js'
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

// ★ 2026-10-09 — Bypass CONDICIONAL. La lógica de guardas se conserva intacta
//   detrás de DEMO_MODE (antes de hoy estaba borrada: `return children` fijo).
function ProtectedRoute({ children }) {
  const { user, isLoading } = useUser()
  if (DEMO_MODE) return children
  if (isLoading) return <AuthLoading />
  if (!user?.isLoggedIn) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, isLoading } = useUser()
  if (DEMO_MODE) return <Navigate to="/app" replace />   // en demo no hay login
  if (isLoading) return <AuthLoading />
  if (user?.isLoggedIn) return <Navigate to="/app" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <PreferencesProvider>
      <UserProvider>
        <SeoMeta />
        <Routes>
          {/* DEMO BYPASS: "/" → taller (/app). Se redirige (no se monta <App/> en "/")
              porque Header/App condicionan galería, presupuesto y despiece a pathname==='/app'.
              Con DEMO_MODE=false vuelve la LandingPage comercial. */}
          <Route path="/" element={DEMO_MODE ? <Navigate to="/app" replace /> : <LandingPage />} />
          <Route path="/landing"  element={<LandingPage />} />
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/verify"   element={<VerifyOTPPage />} />
          <Route path="/terms"    element={<TermsOfService />} />
          <Route path="/privacy"  element={<PrivacyPolicy />} />
          <Route path="/app"      element={<ProtectedRoute><App /></ProtectedRoute>} />
          <Route path="/blog/como-fazer-lista-de-corte-mdf"              element={<ComoFazerListaCorte />} />
          <Route path="/blog/corredicas-telescopicas-caixa-tecnica-13mm" element={<CaixaTecnica13mm />} />
          {/* P2 2026-07-19: canonical ASCII slug; legacy ñ URL kept alive via redirect */}
          <Route path="/blog/diseno-parametrico-muebles-cocina"          element={<DisenoParametricoMuebles />} />
          <Route path="/blog/diseño-parametrico-muebles-cocina"          element={<Navigate to="/blog/diseno-parametrico-muebles-cocina" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    </PreferencesProvider>
  </BrowserRouter>
)

