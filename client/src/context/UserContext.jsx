/**
 * Orbin AI — UserContext v1.0
 * Global SaaS plan state: free | pro | enterprise
 * PROTECTED: This context must not alter Viewer3D or closetEngine logic.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ─── Plan Definitions ─────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    id: 'free',
    name: { ES: 'Gratuito', PT: 'Gratuito', EN: 'Free' },
    price: { BRL: 0, USD: 0 },
    maxModules: 3,
    aiChat: false,
    thicknesses: [18],           // only 18mm MDF
    exportPDF: false,
    exportCSV: false,
    exportCNC: false,
    exportBOM: false,
    unlimitedAI: false,
    priority: 0,
  },
  pro: {
    id: 'pro',
    name: { ES: 'Marceneiro Pro', PT: 'Marceneiro Pro', EN: 'Pro' },
    price: { BRL: 99, USD: 19 },
    maxModules: Infinity,
    aiChat: true,
    thicknesses: [15, 18, 25],
    exportPDF: true,
    exportCSV: true,
    exportCNC: false,
    exportBOM: false,
    unlimitedAI: true,
    priority: 1,
  },
  enterprise: {
    id: 'enterprise',
    name: { ES: 'Industrial / Empresa', PT: 'Industrial / Empresa', EN: 'Enterprise' },
    price: { BRL: 249, USD: 49 },
    maxModules: Infinity,
    aiChat: true,
    thicknesses: [15, 18, 25],
    exportPDF: true,
    exportCSV: true,
    exportCNC: true,
    exportBOM: true,
    unlimitedAI: true,
    priority: 2,
  },
}

const STORAGE_KEY = 'orbin-user-session'

const defaultUser = {
  id: null,
  name: '',
  email: '',
  plan: 'free',          // 'free' | 'pro' | 'enterprise'
  isLoggedIn: false,
}

// ─── Context ──────────────────────────────────────────────────────────────────
const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : defaultUser
    } catch {
      return defaultUser
    }
  })

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)) }
    catch { /* quota exceeded */ }
  }, [user])

  // ── Auth actions ─────────────────────────────────────────────────────────
  const login = useCallback((email, password) => {
    // Simulated auth — replace with real API call in production
    const mockUsers = {
      'pro@orbin.ai':        { name: 'Eduardo Pro',        plan: 'pro' },
      'enterprise@orbin.ai': { name: 'Eduardo Enterprise', plan: 'enterprise' },
    }
    const found = mockUsers[email]
    const newUser = {
      id: Date.now().toString(),
      email,
      name:     found?.name || email.split('@')[0],
      plan:     found?.plan || 'free',
      isLoggedIn: true,
    }
    setUser(newUser)
    return newUser
  }, [])

  const register = useCallback((name, email, plan = 'free') => {
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      plan,
      isLoggedIn: true,
    }
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(() => {
    setUser(defaultUser)
  }, [])

  const upgradePlan = useCallback((planId) => {
    if (!PLANS[planId]) return
    setUser(prev => ({ ...prev, plan: planId }))
  }, [])

  // ── Plan helpers ─────────────────────────────────────────────────────────
  const planConfig  = PLANS[user.plan] || PLANS.free
  const isFree       = user.plan === 'free'
  const isPro        = user.plan === 'pro' || user.plan === 'enterprise'
  const isEnterprise = user.plan === 'enterprise'

  const canAddModule   = (currentCount) => isFree ? currentCount < planConfig.maxModules : true
  const canExportPDF   = planConfig.exportPDF
  const canExportCSV   = planConfig.exportCSV
  const canExportCNC   = planConfig.exportCNC
  const canExportBOM   = planConfig.exportBOM
  const canUseChat     = planConfig.aiChat
  const allowedThicknesses = planConfig.thicknesses

  return (
    <UserContext.Provider value={{
      user,
      plan: user.plan,
      planConfig,
      isFree,
      isPro,
      isEnterprise,
      login,
      register,
      logout,
      upgradePlan,
      canAddModule,
      canExportPDF,
      canExportCSV,
      canExportCNC,
      canExportBOM,
      canUseChat,
      allowedThicknesses,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
