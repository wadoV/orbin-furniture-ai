/**
 * Orbin AI — Billing & Webhooks Router
 * Handles real checkout creation (Stripe + Mercado Pago) and webhook signatures verification.
 */

const express = require('express')
const router = express.Router()
const { requireAuth, optionalAuth } = require('../middleware/auth')

// ─── Promo Codes (server-side, NUNCA en el bundle del cliente) ──────────────
// SECURITY [2026-06-27]: movido desde client/src/context/UserContext.jsx.
// Estar en el bundle JS los hacía legibles por cualquiera con devtools, sin
// forma de revocar uno sin redeploy. Acá quedan fuera del cliente y la
// validación + el grant ocurren en el server con service_role.
// maxUses [2026-06-27]: límite de redenciones totales por código (Task #8 —
// antes eran infinitamente reusables por cualquier cuenta, sin forma de
// revocar uno filtrado sin redeploy). Se valida contra public.promo_redemptions
// (migration 003). KIRA2080 queda con margen (10) por ser el código de demo
// que Eduardo comparte en vivo; los de beta tester son estrictamente 1:1.
const PROMO_CODES = {
  KIRA2080:          { plan: 'enterprise', company_name: 'Marcenaria Orbin Pro', label: 'Enterprise Desbloqueado', maxUses: 10 },
  'ORBIN-J8B0-N8BQ': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 1', maxUses: 1 },
  'ORBIN-MTQ9-BYUY': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 2', maxUses: 1 },
  'ORBIN-MZ55-VGK0': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 3', maxUses: 1 },
  'ORBIN-BUU3-FL1Z': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 4', maxUses: 1 },
  'ORBIN-DLDN-Y69E': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 5', maxUses: 1 },
  'ORBIN-1Y1W-96WS': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado — Beta Tester 6', maxUses: 1 },
}

// ─── Tiers & Plans Config ───────────────────────────────────────────────────
const PLANS = {
  free: {
    id: 'free',
    name: { ES: 'Gratuito', PT: 'Gratuito', EN: 'Free' },
    price: { USD: 0, BRL: 0 },
    maxModules: 3,
    features: ['3D Viewer', 'Basic design parameters']
  },
  pro: {
    id: 'pro',
    name: { ES: 'Marceneiro Pro', PT: 'Marceneiro Pro', EN: 'Pro' },
    price: { USD: 19, BRL: 99 },
    maxModules: Infinity,
    features: ['Unlimited modules', 'AI Chat design', 'Export PDF/CSV']
  },
  enterprise: {
    id: 'enterprise',
    name: { ES: 'Industrial / Empresa', PT: 'Industrial / Empresa', EN: 'Enterprise' },
    price: { USD: 49, BRL: 249 },
    maxModules: Infinity,
    features: ['Unlimited modules', 'AI Chat design', 'Export PDF/CSV/CNC/BOM', 'Priority AI rendering']
  }
}

// Helper to get Supabase Admin Client (using service key to modify auth.users metadata)
let supabaseAdmin = null
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    return supabaseAdmin
  } catch (err) {
    console.error('[Billing] Failed to init Supabase Admin Client:', err.message)
    return null
  }
}

// Helper to get Stripe client (lazy, reused por /checkout, /webhook, /portal, /downgrade-free).
// [2026-06-27] Antes se instanciaba inline en cada handler — unificado para que
// /portal y la cancelación real en /downgrade-free usen siempre la misma config.
let stripeClient = null
function getStripeClient() {
  if (stripeClient) return stripeClient
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  stripeClient = require('stripe')(key)
  return stripeClient
}

// ─── GET /plans ─────────────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({ success: true, plans: PLANS })
})

// ─── POST /checkout ─────────────────────────────────────────────────────────
// Generates a checkout link for the chosen plan.
router.post('/checkout', requireAuth, async (req, res) => {
  const { planId, provider, region } = req.body
  if (!planId || !PLANS[planId]) {
    return res.status(400).json({ success: false, error: 'Plan ID inválido o no especificado.' })
  }

  if (planId === 'free') {
    return res.json({ success: true, checkoutUrl: '/app', message: 'Free plan selected.' })
  }

  try {
    // [2026-07] GLOBAL-FIRST: Stripe es el riel primario mundial (suscripción
    // recurrente, cualquier tarjeta de crédito/débito, cualquier país). Mercado
    // Pago queda DORMIDO por defecto: estaba como pago ÚNICO (Preference) y
    // filtraba el MRR de cada cliente. Ya NO se enruta por región/moneda —
    // un cliente de Brasil también paga por Stripe (suscripción real, cancelable,
    // con Customer Portal). MP solo se activa si el usuario lo pide explícito
    // (provider === 'mercadopago') Y el flag ENABLE_MP_ONETIME === 'true'
    // (reservado para métodos locales BR a futuro; hoy apagado).
    const useMercadoPago = provider === 'mercadopago' && process.env.ENABLE_MP_ONETIME === 'true';

    if (useMercadoPago) {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;
      if (!mpAccessToken) {
        throw new Error('Mercado Pago Access Token is not configured on the server.');
      }
      
      const { MercadoPagoConfig, Preference } = require('mercadopago');
      const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const preference = new Preference(mpClient);

      const response = await preference.create({
        body: {
          items: [
            {
              id: planId,
              title: PLANS[planId].name.PT || PLANS[planId].name.ES || `Orbin AI ${planId}`,
              quantity: 1,
              unit_price: PLANS[planId].price.BRL,
              currency_id: 'BRL',
            }
          ],
          payer: {
            email: req.user.email,
          },
          payment_methods: {
            excluded_payment_types: [],
            installments: 12,
          },
          back_urls: {
            success: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app?checkout=success`,
            pending: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app?checkout=pending`,
            failure: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app?checkout=failure`,
          },
          auto_return: 'approved',
          external_reference: JSON.stringify({ userId: req.user.id, plan: planId }),
          notification_url: `${process.env.SERVER_URL || process.env.API_URL || 'https://orbin-api.railway.app'}/api/billing/webhook`,
        }
      });

      const checkoutUrl = response.init_point || response.sandbox_init_point;
      return res.json({
        success: true,
        checkoutUrl,
        message: 'Checkout preference created successfully (Mercado Pago).'
      });
    } else {
      const stripe = getStripeClient();
      if (!stripe) {
        throw new Error('Stripe Secret Key is not configured on the server.');
      }

      const priceId = planId === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ENTERPRISE;
      if (!priceId) {
        throw new Error(`Stripe Price ID not configured for plan: ${planId}`);
      }

      const session = await stripe.checkout.sessions.create({
        // 'card' cubre todas las tarjetas de crédito y débito del mundo
        // (Visa, Mastercard, Amex, etc.). Para monedas locales por país,
        // activar "Adaptive Pricing" en el Dashboard de Stripe (sin cambio de código).
        payment_method_types: ['card'],
        customer_email: req.user.email,
        billing_address_collection: 'auto',
        allow_promotion_codes: true,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app?checkout=success`,
        cancel_url: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app?checkout=failure`,
        client_reference_id: req.user.id,
        metadata: {
          userId: req.user.id,
          plan: planId,
        },
        subscription_data: {
          metadata: {
            userId: req.user.id,
            plan: planId,
          }
        }
      });

      return res.json({
        success: true,
        checkoutUrl: session.url,
        message: 'Checkout session created successfully (Stripe).'
      });
    }
  } catch (err) {
    // FIX #8 (QA 2026-06-26): err.message acá podía ser literalmente
    // "Stripe Secret Key is not configured on the server." — un detalle de
    // configuración interna que no debe llegar al usuario. Logueado abajo,
    // mensaje seguro al cliente.
    console.error('[Billing Checkout] Error creating session:', err);
    res.status(500).json({ success: false, error: 'No pudimos iniciar el proceso de pago. Intentá de nuevo o contactanos.' })
  }
})


// ─── Helper: upgrade plan en Supabase (service_role) ─────────────────────────
// SECURITY [2026-06-27]: el plan ahora se escribe en app_metadata, NUNCA en
// user_metadata. app_metadata solo es escribible por el service_role (esta
// función) — el SDK público del cliente (supabase.auth.updateUser) no puede
// tocarlo bajo ninguna circunstancia. Antes esto escribía a user_metadata,
// que SÍ es escribible por el propio usuario desde el cliente (incluso desde
// la consola del navegador), lo que permitía autoasignarse Enterprise gratis
// sin pasar por pago ni código promocional. Ver server/src/middleware/auth.js
// (lee app_metadata) y client/src/context/UserContext.jsx (idem).
//
// company_name sí se deja en user_metadata: no es un dato de autorización,
// solo cosmético, y no hay riesgo en que el usuario lo edite.
//
// stripeIds [2026-06-27, Task #5 Layer 1]: { stripe_customer_id, stripe_subscription_id }
// opcional, mergeado en app_metadata junto al plan. Sin esto, /downgrade-free
// nunca podía cancelar la suscripción real en Stripe (solo apagaba el flag
// interno) y no existía forma de construir un Customer Portal session.
// Pasar `null` en un campo lo borra explícitamente (ej. al cancelar);
// pasar `undefined` (no incluir la key) lo deja intacto.
async function upgradeUserPlan(userId, plan, companyName, stripeIds) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    console.error('[Billing] Supabase Admin no disponible; no se pudo actualizar el plan.')
    return { error: 'Supabase Admin no disponible.' }
  }
  // Merge manual contra el app_metadata/user_metadata existentes — evita pisar
  // otros campos (ej. roles) que pudieran vivir ahí.
  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId)
  if (getErr || !existing?.user) {
    console.error('[Billing] No se pudo leer el usuario antes de actualizar plan:', getErr?.message)
    return { error: getErr?.message || 'Usuario no encontrado.' }
  }
  const nextAppMetadata = { ...existing.user.app_metadata, plan }
  if (stripeIds && Object.prototype.hasOwnProperty.call(stripeIds, 'stripe_customer_id')) {
    nextAppMetadata.stripe_customer_id = stripeIds.stripe_customer_id
  }
  if (stripeIds && Object.prototype.hasOwnProperty.call(stripeIds, 'stripe_subscription_id')) {
    nextAppMetadata.stripe_subscription_id = stripeIds.stripe_subscription_id
  }
  const payload = { app_metadata: nextAppMetadata }
  if (companyName !== undefined) {
    payload.user_metadata = { ...existing.user.user_metadata, company_name: companyName }
  }
  const { error } = await admin.auth.admin.updateUserById(userId, payload)
  if (error) {
    console.error('[Billing] Error actualizando plan:', error.message)
    return { error: error.message }
  }
  console.log(`[Billing] Usuario ${userId} → plan ${plan} (app_metadata)`)
  return { error: null }
}

// ─── POST /redeem-promo ───────────────────────────────────────────────────────
// SECURITY [2026-06-27]: reemplaza la validación client-side de PROMO_CODES.
// requireAuth garantiza que solo un usuario autenticado real puede llamarla,
// y el grant se hace acá vía service_role (app_metadata) — el cliente nunca
// vuelve a tener la capacidad de otorgarse un plan a sí mismo.
router.post('/redeem-promo', requireAuth, async (req, res) => {
  const code = (req.body?.code || '').trim().toUpperCase()
  if (!code) {
    return res.status(400).json({ success: false, error: 'Ingresá un código.' })
  }
  const grant = PROMO_CODES[code]
  if (!grant) {
    return res.status(400).json({ success: false, error: 'Código inválido.' })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return res.status(500).json({ success: false, error: 'No pudimos activar el código. Intentá de nuevo.' })
  }

  // FIX #8 [2026-06-27]: enforcement de single-use / máximo de usos por
  // código contra public.promo_redemptions (migration 003). Antes cualquier
  // código era infinitamente reusable por cualquier cuenta.
  const { count, error: countErr } = await admin
    .from('promo_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('code', code)
  if (countErr) {
    console.error('[Billing] Error consultando usos de promo code:', countErr.message)
    return res.status(500).json({ success: false, error: 'No pudimos validar el código. Intentá de nuevo.' })
  }
  if ((count || 0) >= grant.maxUses) {
    return res.status(409).json({ success: false, error: 'Este código ya alcanzó su límite de usos.' })
  }

  // UNIQUE(code, user_id) en la tabla evita que el mismo usuario infle el
  // contador reintentando la redención.
  const { error: insertErr } = await admin
    .from('promo_redemptions')
    .insert({ code, user_id: req.user.id })
  if (insertErr) {
    if (insertErr.code === '23505') { // unique_violation
      return res.status(409).json({ success: false, error: 'Ya redimiste este código anteriormente.' })
    }
    console.error('[Billing] Error registrando redención de promo code:', insertErr.message)
    return res.status(500).json({ success: false, error: 'No pudimos activar el código. Intentá de nuevo.' })
  }

  const { error } = await upgradeUserPlan(req.user.id, grant.plan, grant.company_name)
  if (error) {
    return res.status(500).json({ success: false, error: 'No pudimos activar el código. Intentá de nuevo.' })
  }
  return res.json({
    success: true,
    plan: grant.plan,
    company_name: grant.company_name,
    message: `Plan ${PLANS[grant.plan]?.name.ES || grant.plan} activado`
  })
})

// ─── POST /downgrade-free ─────────────────────────────────────────────────────
// Self-service downgrade. Seguro por diseño: un usuario solo puede bajar su
// propio privilegio a 'free', nunca subirlo — no es superficie de ataque.
//
// FIX [2026-06-27, Task #5 Layer 1]: antes esto SOLO apagaba el flag interno
// (app_metadata.plan = 'free') sin tocar la suscripción real en Stripe — un
// usuario que "bajaba" de plan en la app seguía siendo cobrado por Stripe
// indefinidamente (riesgo de chargeback/disputa). Ahora, si hay una
// stripe_subscription_id en app_metadata, se cancela de verdad antes de
// bajar el flag. Usuarios de Mercado Pago / promo code (sin subscription_id)
// no tienen nada que cancelar acá — ver Task #5 Layer 2, pendiente decisión
// de negocio sobre si BR/MP debe migrar a PreApproval para tener un
// equivalente cancelable.
router.post('/downgrade-free', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin()
  if (admin) {
    const { data: existing, error: getErr } = await admin.auth.admin.getUserById(req.user.id)
    const subscriptionId = existing?.user?.app_metadata?.stripe_subscription_id
    if (!getErr && subscriptionId) {
      const stripe = getStripeClient()
      if (stripe) {
        try {
          await stripe.subscriptions.cancel(subscriptionId)
          console.log(`[Billing] Suscripción Stripe ${subscriptionId} cancelada (downgrade-free, user ${req.user.id})`)
        } catch (err) {
          // Tolerar "ya estaba cancelada" — no debe bloquear el downgrade interno.
          // Cualquier otro error de Stripe sí se loguea para investigar.
          if (err?.code !== 'resource_missing') {
            console.error('[Billing] Error cancelando suscripción Stripe en downgrade-free:', err.message)
          }
        }
      } else {
        console.error('[Billing] downgrade-free: stripe_subscription_id presente pero Stripe no configurado en el server.')
      }
    }
  }

  const { error } = await upgradeUserPlan(req.user.id, 'free', undefined, { stripe_subscription_id: null })
  if (error) {
    return res.status(500).json({ success: false, error: 'No pudimos actualizar tu plan. Intentá de nuevo.' })
  }
  return res.json({ success: true, plan: 'free', message: 'Plan Gratuito activado' })
})

// ─── POST /portal ───────────────────────────────────────────────────────────
// NUEVO [2026-06-27, Task #5 Layer 1]: Stripe Customer Portal — self-service
// real (actualizar tarjeta, ver facturas, cancelar). Solo cubre usuarios con
// stripe_customer_id en app_metadata (suscriptos vía Stripe, no Mercado Pago
// ni promo code) — Mercado Pago no tiene un portal hosted equivalente; eso
// queda para Task #5 Layer 3 (flujo de cancelación in-app para BR).
router.post('/portal', requireAuth, async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return res.status(500).json({ success: false, error: 'No pudimos abrir el portal de facturación. Intentá de nuevo.' })
  }
  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(req.user.id)
  const customerId = existing?.user?.app_metadata?.stripe_customer_id
  if (getErr || !customerId) {
    return res.status(400).json({
      success: false,
      error: 'No encontramos una suscripción de Stripe asociada a tu cuenta.'
    })
  }
  const stripe = getStripeClient()
  if (!stripe) {
    return res.status(500).json({ success: false, error: 'Stripe no está configurado en el servidor.' })
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'}/app`,
    })
    return res.json({ success: true, url: session.url })
  } catch (err) {
    console.error('[Billing] Error creando sesión de Customer Portal:', err.message)
    return res.status(500).json({ success: false, error: 'No pudimos abrir el portal de facturación. Intentá de nuevo.' })
  }
})

// ─── POST /webhook ───────────────────────────────────────────────────────────
// Verifica firma (Stripe) y notificaciones (Mercado Pago) y sube el plan del usuario.
// index.js captura req.rawBody vía el verify de express.json (necesario para Stripe).
router.post('/webhook', async (req, res) => {
  const stripeSig = req.headers['stripe-signature']

  // ── Stripe ──
  if (stripeSig) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!endpointSecret) {
      console.error('[Billing Webhook] STRIPE_WEBHOOK_SECRET no configurado — rechazado.')
      return res.status(400).json({ success: false, error: 'Webhook secret not configured.' })
    }
    let event
    try {
      const stripe = getStripeClient()
      if (!stripe) {
        console.error('[Billing Webhook] STRIPE_SECRET_KEY no configurado — rechazado.')
        return res.status(400).json({ success: false, error: 'Stripe not configured.' })
      }
      event = stripe.webhooks.constructEvent(req.rawBody, stripeSig, endpointSecret)
    } catch (err) {
      console.error('[Billing Webhook] Firma Stripe inválida:', err.message)
      return res.status(400).json({ success: false, error: 'Firma del webhook inválida.' })
    }
    try {
      const obj = event.data.object
      switch (event.type) {
        // FIX [2026-06-27, Task #5 Layer 1]: antes solo se leían
        // metadata.userId/plan — nunca se persistía obj.customer ni
        // obj.subscription, por lo que /downgrade-free no podía cancelar
        // nada real y no existía base para el Customer Portal. Ahora se
        // capturan acá y se guardan en app_metadata vía upgradeUserPlan.
        case 'checkout.session.completed': {
          const userId = obj.metadata?.userId || obj.client_reference_id
          const plan = obj.metadata?.plan
          if (userId && plan) {
            await upgradeUserPlan(userId, plan, undefined, {
              stripe_customer_id: obj.customer || undefined,
              stripe_subscription_id: obj.subscription || undefined,
            })
          }
          break
        }
        case 'customer.subscription.updated': {
          const userId = obj.metadata?.userId
          const plan = obj.metadata?.plan
          if (userId && plan) {
            await upgradeUserPlan(userId, plan, undefined, {
              stripe_customer_id: obj.customer || undefined,
              stripe_subscription_id: obj.id || undefined,
            })
          }
          break
        }
        case 'customer.subscription.deleted': {
          const userId = obj.metadata?.userId
          // Conservamos stripe_customer_id (sigue siendo el mismo cliente en
          // Stripe, útil si vuelve a suscribirse) pero limpiamos el
          // subscription_id — ya no hay nada que cancelar ni administrar.
          if (userId) {
            await upgradeUserPlan(userId, 'free', undefined, { stripe_subscription_id: null })
          }
          break
        }
        default:
          break
      }
      return res.json({ received: true })
    } catch (err) {
      console.error('[Billing Webhook] Error handler Stripe:', err.message)
      return res.status(500).json({ success: false, error: 'Error procesando el evento de pago.' })
    }
  }

  // ── Mercado Pago ──
  try {
    const dataId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id)
    const topic = req.query.topic || req.query.type || (req.body && req.body.type)
    if (!dataId) return res.status(200).json({ received: true }) // ping de prueba sin pago
    if (topic === 'payment' || (req.body && typeof req.body.action === 'string' && req.body.action.includes('payment'))) {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN
      if (!mpAccessToken) return res.status(400).json({ success: false, error: 'MP token not set' })
      const { MercadoPagoConfig, Payment } = require('mercadopago')
      const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken })
      const payment = await new Payment(mpClient).get({ id: dataId })
      if (payment && payment.status === 'approved') {
        let ref = {}
        try { ref = JSON.parse(payment.external_reference || '{}') } catch (_) {}
        if (ref.userId && ref.plan) await upgradeUserPlan(ref.userId, ref.plan)
      }
    }
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[Billing Webhook] Error handler Mercado Pago:', err.message)
    return res.status(500).json({ success: false, error: 'Error procesando la notificación de pago.' })
  }
})

module.exports = router
