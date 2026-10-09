/**
 * Orbin AI — DEMO_MODE (Bypass Condicional del Piloto Industrial)
 *
 * Un único interruptor para la demo de taller. NADA se borra: auth Supabase/OAuth,
 * checkout Stripe/Mercado Pago y LandingPage siguen compilando y vuelven a operar
 * apagando este flag.
 *
 *   VITE_DEMO_MODE=true   → fuerza demo (también en build de producción)
 *   VITE_DEMO_MODE=false  → fuerza flujo comercial real (también en `vite dev`)
 *   (sin definir)         → demo SOLO en `vite dev`; un build de producción
 *                           nunca queda en demo por accidente.
 */
const raw = String(import.meta.env?.VITE_DEMO_MODE ?? '').trim().toLowerCase()

export const DEMO_MODE =
  raw === 'true' ? true :
  raw === 'false' ? false :
  import.meta.env?.DEV === true

/** Token que el backend acepta solo con DEMO_MODE=true o fuera de producción. */
export const DEMO_TOKEN = 'demo-local-token'

/** Perfil forzado de la demo (contrato pedido para el piloto). */
export const DEMO_TALLER_USER = Object.freeze({
  id: 'demo-taller',
  name: 'Demo Taller',
  email: 'demo@taller.local',
  plan: 'pro',
  role: 'admin',
  company_name: 'Marcenaria Demo Taller',
  isLoggedIn: true,        // campo que consume el resto del UI
  isAuthenticated: true,
  isPro: true,
  isVerified: true,
  loading: false,
})
