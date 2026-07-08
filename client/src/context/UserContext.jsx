/**
 * Orbin AI - UserContext v3.0
 * Real Supabase Auth. Plan stored ONLY in app_metadata (service_role-only
 * write), never in user_metadata.
 *
 * SECURITY FIX [2026-06-27]: v2.0 leía y escribía el plan en user_metadata,
 * que es escribible por el propio usuario autenticado vía
 * supabase.auth.updateUser() — incluso desde la consola del navegador, sin
 * pasar por checkout ni código promocional. Cualquier usuario podía ejecutar
 * `supabase.auth.updateUser({data:{plan:'enterprise'}})` y quedar Enterprise
 * gratis, permanentemente. Ver hallazgo completo: tarea #7.
 *
 * Fix: el plan ahora SOLO se lee de session.user.app_metadata (ver
 * planFromSession), y SOLO se escribe server-side con service_role (ver
 * server/src/routes/billing.js: webhook real, /redeem-promo, /downgrade-free).
 * El cliente no tiene ninguna vía para escribir su propio plan — ni siquiera
 * accidentalmente, porque el SDK público de Supabase no expone una forma de
 * setear app_metadata desde el cliente.
 *
 * Los códigos promocionales se validan y otorgan en el server (ver
 * PROMO_CODES en billing.js) — ya no viven en este bundle.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/client.js'

// Código promocional ingresado ANTES de tener una sesión real (ej. durante el
// formulario de registro, previo a confirmar el email). Solo guarda el texto
// crudo del código — nunca un plan — y se redime contra el server en cuanto
// existe una sesión autenticada (ver redeemPendingPromo más abajo).
const PENDING_PROMO_KEY = 'orbin-pending-promo'

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
  const p = session.user?.app_metadata?.plan
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

  // FIX [2026-06-27]: este efecto antes se saltaba la verificación real de
  // Supabase si ya había una sesión "isLoggedIn" cacheada en localStorage —
  // eso permitía que cualquier valor escrito a mano (o quedado de una sesión
  // de prueba vieja, ej. id "DIR-001"/"theboy575@gmail.com" plan enterprise)
  // quedara logueado para siempre sin validación, y rompía /login porque
  // PublicRoute (main.jsx) ve isLoggedIn=true y redirige a /app antes de
  // mostrar el formulario. Ahora Supabase es la única fuente de verdad: el
  // localStorage solo sirve como hint de pintado inicial (useState arriba),
  // y aquí siempre se reconcilia contra la sesión real, limpiando cualquier
  // sesión local que no tenga respaldo en el backend.
  // Evita redimir el mismo código pendiente más de una vez por ciclo de vida
  // del provider (onAuthStateChange puede disparar SIGNED_IN más de una vez).
  const redeemedPendingRef = useRef(false)

  const redeemPendingPromo = useCallback(async () => {
    const code = localStorage.getItem(PENDING_PROMO_KEY)
    if (!code || redeemedPendingRef.current) return
    redeemedPendingRef.current = true
    localStorage.removeItem(PENDING_PROMO_KEY)
    try {
      const r = await api.redeemPromo(code)
      if (r.success) {
        setUser(prev => ({ ...prev, plan: r.plan, company_name: r.company_name ?? prev.company_name }))
      }
    } catch (err) {
      console.error('[UserContext] No se pudo redimir el código pendiente:', err)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          plan: planFromSession(session),
          isLoggedIn: true,
          isVerified: true,
          loading: false
        })
        redeemPendingPromo()
      } else {
        localStorage.removeItem('orbin-user-session')
        setUser({ ...defaultUser, loading: false })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email.split('@')[0],
          plan: planFromSession(session),
          isLoggedIn: true,
          isVerified: true,
          loading: false
        })
        redeemPendingPromo()
      } else {
        localStorage.removeItem('orbin-user-session')
        setUser({ ...defaultUser, loading: false })
      }
    })
    return () => subscription.unsubscribe()
  }, [redeemPendingPromo])

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

  // NOTA [2026-06-27]: `plan` acá es puramente cosmético — se guarda en
  // user_metadata.name/plan solo para mostrarlo en UI antes de verificar el
  // email. Ya no determina el entitlement real (eso vive en app_metadata,
  // escrito únicamente por el server tras pago real o código promocional
  // válido). Si el usuario pasa plan='enterprise' acá a mano (ej. devtools),
  // no obtiene nada: planFromSession() ignora user_metadata por completo.
  const register = useCallback(async (name, email, password, plan = 'free') => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name, plan } }
    })
    if (error) throw error
    const newUser = {
      id: data.session?.user.id || Date.now().toString(),
      email,
      name,
      plan: 'free',
      company_name: '',
      isLoggedIn: true,
      isVerified: false, // Must verify with OTP
      loading: false
    }
    setUser(newUser)
    return { session: true, user: newUser }
  }, [])

  // RECOVERY [2026-06-26]: Google OAuth signup/login — flagueado por Eduardo como
  // crítico para confianza del usuario (login social = percepción de seguridad).
  // signInWithOAuth redirige fuera de la app; el retorno pasa por
  // supabase.auth.onAuthStateChange (ya registrado arriba), que crea la sesión
  // normalmente — no requiere lógica adicional de creación de usuario aquí.
  const loginWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` }
    })
    if (error) throw error
    return data
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem('orbin-user-session')
    redeemedPendingRef.current = false
    await supabase.auth.signOut().catch(() => {})
    setUser({ ...defaultUser, loading: false })
  }, [])

  // SECURITY [2026-06-27]: solo permite bajar a 'free' (autodowngrade — nunca
  // sube privilegio, no es superficie de ataque) y lo hace vía el server
  // (/billing/downgrade-free), nunca escribiendo el plan directo desde el
  // cliente. Cualquier otro planId se rechaza: subir de plan SIEMPRE pasa por
  // checkout real (ver Header.jsx) o por un código promocional válido
  // redimido server-side (ver applyPromoCode).
  const upgradePlan = useCallback(async (planId) => {
    if (planId !== 'free') {
      console.warn('[UserContext] upgradePlan solo admite downgrade a "free". Use el checkout real para planes pagos.')
      return false
    }
    setUser(prev => ({ ...prev, plan: 'free' })) // optimista
    try {
      await api.downgradeFree()
      return true
    } catch (err) {
      console.error('[UserContext] Error en downgrade a free:', err)
      // Revertir el estado optimista al valor real (app_metadata server-side).
      const { data: { session } } = await supabase.auth.refreshSession()
      setUser(prev => ({ ...prev, plan: planFromSession(session) }))
      return false
    }
  }, [])

  // SECURITY [2026-06-27]: ya no valida ni otorga nada en el cliente. Si hay
  // sesión real, redime el código contra el server (única fuente de verdad).
  // Si todavía no hay sesión (ej. código ingresado durante el registro, antes
  // de confirmar el email), solo guarda el texto crudo para redimirlo en
  // cuanto exista una sesión autenticada (ver redeemPendingPromo).
  const applyPromoCode = useCallback(async (code) => {
    const trimmed = (code || '').trim()
    if (!trimmed) return { success: false, message: 'Ingresá un código.' }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      localStorage.setItem(PENDING_PROMO_KEY, trimmed)
      return { success: true, pending: true, message: 'Código guardado — se activará al confirmar tu cuenta.' }
    }

    try {
      const r = await api.redeemPromo(trimmed)
      setUser(prev => ({ ...prev, plan: r.plan, company_name: r.company_name ?? prev.company_name }))
      return { success: true, plan: r.plan, message: r.message }
    } catch (err) {
      return { success: false, message: err.message || 'Código inválido.' }
    }
  }, [])

  // RECOVERY [2026-06-25]: cierre de bypass OTP. Antes aceptaba '123456' o
  // cualquier código de 6 dígitos sin validar contra Supabase — vulnerabilidad
  // crítica que permitía verificar cualquier cuenta sin acceso al correo real.
  // Ahora valida el OTP real emitido por supabase.auth.signUp() vía verifyOtp().
  const verifyCode = useCallback(async (code, emailArg) => {
    const email = emailArg || user?.email
    if (!email) return { success: false, error: 'No hay un correo asociado a la verificación.' }
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    if (error) return { success: false, error: error.message || 'Código de verificación incorrecto.' }
    if (data?.session) {
      setUser({
        id: data.session.user.id,
        email: data.session.user.email,
        name: data.session.user.user_metadata?.name || email.split('@')[0],
        company_name: data.session.user.user_metadata?.company_name || '',
        plan: planFromSession(data.session),
        isLoggedIn: true,
        isVerified: true,
        loading: false
      })
      // verifyOtp ya dispara onAuthStateChange(SIGNED_IN), que a su vez llama
      // redeemPendingPromo() — pero la llamamos también acá explícitamente
      // por si ese listener todavía no se montó en este render.
      redeemPendingPromo()
    } else {
      setUser(prev => ({ ...prev, isVerified: true }))
    }
    return { success: true }
  }, [user?.email, redeemPendingPromo])

  // RECOVERY [2026-06-25]: resendCode existía en backup-20260614 y fue dropeado;
  // el botón "Reenviar" en AuthPages.jsx quedó como simulación pura. Se restaura
  // usando supabase.auth.resend(), que reemite el OTP real al correo.
  const resendCode = useCallback(async (emailArg) => {
    const email = emailArg || user?.email
    if (!email) return { success: false, error: 'No hay correo para reenviar el código.' }
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }, [user?.email])

  // RECOVERY [2026-06-25]: necesario para reflejar en UI el plan actualizado
  // por el webhook de billing (Stripe/MercadoPago actualiza user_metadata.plan
  // vía Admin API server-side; el cliente no recibe ese cambio automáticamente
  // y debe refrescar la sesión al volver del checkout).
  const refreshPlan = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession()
    if (session) {
      const plan = planFromSession(session)
      setUser(prev => ({ ...prev, plan }))
      return plan
    }
    return null
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
      isLoading: user.loading, login, register, loginWithGoogle, logout, upgradePlan, applyPromoCode,
      canAddModule, canExportPDF, canExportCSV, canExportCNC, canExportBOM,
      canUseChat, allowedThicknesses, PLANS, companySettings, updateCompanySettings, verifyCode,
      resendCode, refreshPlan,
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
