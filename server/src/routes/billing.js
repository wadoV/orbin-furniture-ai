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

