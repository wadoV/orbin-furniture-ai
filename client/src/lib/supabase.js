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
export const supabase = createClient(SUPABASE_URL || 'http://supabase.invalid', SUPABASE_ANON || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
