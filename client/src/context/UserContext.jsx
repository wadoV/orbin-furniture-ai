/**
 * Orbin AI - UserContext v2.0
 * Real Supabase Auth. Plan stored in user_metadata + promo code override.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const PROMO_CODES = {
  KIRA2080: { plan: 'enterprise', company_name: 'Marcenaria Orbin Pro', label: 'Enterprise Desbloqueado' },
  ORBIN_TEST_INDUSTRIAL_2026: { plan: 'enterprise', company_name: 'Marcenaria Orbin Pro', label: 'Enterprise Desbloqueado' }
}
const PROMO_KEY   = 'orbin-promo-plan'

export const PLANS = {
  free: {
    id: 'free', name: { ES: 'Gratuito', PT: 'Gratuito', EN: 'Free' },
    price: { BRL: 0, USD: 0 }, maxModules: 3, aiChat: false,
    thicknesses: [18], exportPDF: false, exportCSV: false,
    exportCNC: false, exportBOM: false, unlimitedAI: false, priority: 0,
  },
  pro: {
    id: 'pro', name: { ES: 'Marceneiro Pro', PT: 'Marceneiro Pro', EN: 'Pro' },
    price: { BRL: 99, USD: 19 }, maxModules: Infinity, aiChat: true,
    thicknesses: [15, 18, 25], exportPDF: true, exportCSV: true,
    exportCNC: false, exportBOM: false, unlimitedAI: true, priority: 1,
  },
  enterprise: {
    id: 'enterprise', name: { ES: 'Industrial / Empresa', PT: 'Industrial / Empresa', EN: 'Enterprise' },
    price: { BRL: 249, USD: 49 }, maxModules: Infinity, aiChat: true,
    thicknesses: [15, 18, 25], exportPDF: true, exportCSV: true,
    exportCNC: true, exportBOM: true, unlimitedAI: true, priority: 2,
  },
}

const defaultUser = {
  id: null,
  name: '',
  email: '',
  plan: 'free',
  company_name: '',
  isLoggedIn: false,
  isVerified: true,
  loading: true
}
const UserContext = createContext(null)

function planFromSession(session) {
  if (!session) return 'free'
  const p = session.user?.user_metadata?.plan
  return PLANS[p] ? p : 'free'
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('orbin-user-session')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.isLoggedIn) {
          return { ...parsed, loading: false }
        }
      }
    } catch {}
    return defaultUser
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orbin-user-session')
      if (saved) {
        localStorage.setItem('orbin-user-session', JSON.stringify(user))
      }
    } catch {}
  }, [user])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orbin-user-session')
      if (saved && JSON.parse(saved).isLoggedIn) {
        return
      }
    } catch {}

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const promo    = localStorage.getItem(PROMO_KEY)
        const base     = planFromSession(session)
        const plan     = (promo && PLANS[promo]) ? promo : base
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          plan,
          isLoggedIn: true,
          isVerified: true,
          loading: false
        })
      } else {
        setUser({ ...defaultUser, loading: false })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      try {
        const saved = localStorage.getItem('orbin-user-session')
        if (saved && JSON.parse(saved).isLoggedIn) {
          return
        }
      } catch {}

      if (session) {
        const promo = localStorage.getItem(PROMO_KEY)
        const base  = planFromSession(session)
        const plan  = (promo && PLANS[promo]) ? promo : base
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          plan,
          isLoggedIn: true,
          isVerified: true,
          loading: false
        })
      } else {
        localStorage.removeItem(PROMO_KEY)
        setUser({ ...defaultUser, loading: false })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.session) {
      setUser({
        id: data.session.user.id,
        email: data.session.user.email,
        name: data.session.user.user_metadata?.name || data.session.user.email.split('@')[0],
        plan: planFromSession(data.session),
        isLoggedIn: true,
        isVerified: true,
        loading: false
      })
    }
    return data
  }, [])

  const register = useCallback(async (name, email, password, plan = 'free') => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name, plan } }
    })
    if (error) throw error
    const promo = localStorage.getItem(PROMO_KEY)
    const finalPlan = promo || plan
    const newUser = {
      id: data.session?.user.id || Date.now().toString(),
      email,
      name,
      plan: finalPlan,
      company_name: '',
      isLoggedIn: true,
      isVerified: false, // Must verify with OTP
      loading: false
    }
    setUser(newUser)
    return { session: true, user: newUser }
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(PROMO_KEY)
    localStorage.removeItem('orbin-user-session')
    await supabase.auth.signOut().catch(() => {})
    setUser({ ...defaultUser, loading: false })
  }, [])

  const upgradePlan = useCallback((planId) => {
    if (!PLANS[planId]) return false
    setUser(prev => ({ ...prev, plan: planId }))
    supabase.auth.updateUser({ data: { plan: planId } }).catch(console.error)
    return true
  }, [])

  const applyPromoCode = useCallback((code) => {
    const key   = code.trim().toUpperCase()
    const grant = PROMO_CODES[key]
    if (!grant) return { success: false, message: 'Codigo invalido' }
    const planId = grant.plan
    const companyName = grant.company_name
    localStorage.setItem(PROMO_KEY, planId)
    setUser(prev => ({ ...prev, plan: planId, company_name: companyName }))
    supabase.auth.updateUser({ data: { plan: planId, company_name: companyName } }).catch(console.error)
    return { success: true, plan: planId, message: 'Plan ' + PLANS[planId].name.ES + ' activado' }
  }, [])

  const verifyCode = useCallback((code) => {
    if (code === '123456' || (code && code.length === 6)) {
      setUser(prev => ({ ...prev, isVerified: true }))
      return { success: true }
    }
    return { success: false, error: 'Código de verificación incorrecto. Intente con 123456.' }
  }, [])

  const [companySettings, setCompanySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('orbin-company-settings')
      if (saved) return JSON.parse(saved)
    } catch {}
    return { name: user?.company_name || "Orbin AI", phone: "", email: user?.email || "", address: "" }
  })

  useEffect(() => {
    if (user.isLoggedIn) {
      setCompanySettings(prev => ({
        name: prev.name && prev.name !== "Orbin AI" ? prev.name : (user.company_name || "Orbin AI"),
        phone: prev.phone || "",
        email: prev.email || user.email || "",
        address: prev.address || "",
      }))
    }
  }, [user])

  const updateCompanySettings = useCallback((newSettings, setAsDefault = false) => {
    setCompanySettings(newSettings)
    if (setAsDefault) {
      localStorage.setItem('orbin-company-settings', JSON.stringify(newSettings))
    }
  }, [])

  const planConfig        = PLANS[user.plan] || PLANS.free
  const isFree            = user.plan === 'free'
  const isPro             = user.plan === 'pro' || user.plan === 'enterprise'
  const isEnterprise      = user.plan === 'enterprise'
  const canAddModule      = (n) => isFree ? n < planConfig.maxModules : true
  const canExportPDF      = planConfig.exportPDF
  const canExportCSV      = planConfig.exportCSV
  const canExportCNC      = planConfig.exportCNC
  const canExportBOM      = planConfig.exportBOM
  const canUseChat        = planConfig.aiChat
  const allowedThicknesses = planConfig.thicknesses

  return (
    <UserContext.Provider value={{
      user, plan: user.plan, planConfig, isFree, isPro, isEnterprise,
      isLoading: user.loading, login, register, logout, upgradePlan, applyPromoCode,
      canAddModule, canExportPDF, canExportCSV, canExportCNC, canExportBOM,
      canUseChat, allowedThicknesses, PLANS, companySettings, updateCompanySettings, verifyCode,
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
