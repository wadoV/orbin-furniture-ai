/**
 * Orbin AI — Supabase Client
 * Single instance shared across the app.
 */
import { createClient } from '@supabase/supabase-js'
import { DEMO_MODE } from '../config/demoMode.js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  // En DEMO_MODE Supabase no se usa → aviso, no error rojo en consola de la demo.
  const log = DEMO_MODE ? console.warn : console.error
  log('[Orbin] Missing Supabase env vars — check client/.env')
}

// ★ 2026-10-09 (piloto): createClient() LANZA si la URL es undefined → el módulo
//   reventaba al importarse y el app entero quedaba en blanco. Placeholder inerte:
//   las llamadas fallan de forma controlada (y en DEMO_MODE ni se hacen).
// Helper defensivo para resolver la URL de retorno del flujo OAuth evitando bucles o dominios huérfanos
export function getAuthRedirectUrl() {
  const envRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL
  if (envRedirect && typeof envRedirect === 'string' && envRedirect.trim()) {
    return envRedirect.trim()
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/app`
  }
  return 'http://localhost:5174/app'
}

export const supabase = createClient(SUPABASE_URL || 'http://supabase.invalid', SUPABASE_ANON || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Inicia sesión con Google OAuth de manera defensiva.
 * Asegura redirectTo explícito y captura de errores sin quebrar la UI.
 */
export async function signInWithGoogle(customRedirectUrl) {
  try {
    const redirectTo = customRedirectUrl || getAuthRedirectUrl()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      console.error('[Supabase Auth] Error al iniciar sesión con Google:', error.message)
      throw error
    }
    return { data, error: null }
  } catch (err) {
    console.error('[Supabase Auth] Excepción en signInWithGoogle:', err)
    return { data: null, error: err }
  }
}
