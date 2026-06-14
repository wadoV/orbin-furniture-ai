/**
 * Orbin AI — Billing & Webhooks Router
 * Handles real checkout creation (Stripe + Mercado Pago) and webhook signatures verification.
 */

const express = require('express')
const router = express.Router()
const { requireAuth, optionalAuth } = require('../middleware/auth')

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
    const isBrazil = provider === 'mercadopago' || region === 'BR' || region === 'PT' || region === 'pt-BR' || region === 'pt' || req.body.currency === 'BRL';

    if (isBrazil) {
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
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new Error('Stripe Secret Key is not configured on the server.');
      }
      const stripe = require('stripe')(stripeSecretKey);

      const priceId = planId === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_ENTERPRISE;
      if (!priceId) {
        throw new Error(`Stripe Price ID not configured for plan: ${planId}`);
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
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
    console.error('[Billing Checkout] Error creating session:', err);
    res.status(500).json({ success: false, error: err.message })
  }
})


// ─── Helper: upgrade plan en Supabase (service_role) ─────────────────────────
async function upgradeUserPlan(userId, plan) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    console.error('[Billing] Supabase Admin no disponible; no se pudo actualizar el plan.')
    return
  }
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan }
  })
  if (error) console.error('[Billing] Error actualizando plan:', error.message)
  else console.log(`[Billing] Usuario ${userId} → plan ${plan}`)
}

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
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
      event = stripe.webhooks.constructEvent(req.rawBody, stripeSig, endpointSecret)
    } catch (err) {
      console.error('[Billing Webhook] Firma Stripe inválida:', err.message)
      return res.status(400).json({ success: false, error: `Webhook Error: ${err.message}` })
    }
    try {
      const obj = event.data.object
      switch (event.type) {
        case 'checkout.session.completed':
        case 'customer.subscription.updated': {
          const userId = obj.metadata?.userId || obj.client_reference_id
          const plan = obj.metadata?.plan
          if (userId && plan) await upgradeUserPlan(userId, plan)
          break
        }
        case 'customer.subscription.deleted': {
          const userId = obj.metadata?.userId
          if (userId) await upgradeUserPlan(userId, 'free')
          break
        }
        default:
          break
      }
      return res.json({ received: true })
    } catch (err) {
      console.error('[Billing Webhook] Error handler Stripe:', err.message)
      return res.status(500).json({ success: false, error: err.message })
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
    return res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
