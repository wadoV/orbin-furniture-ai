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

// ─── POST /webhook ──────────────────────────────────────────────────────────
// Handles webhook signals with signature verification
router.post('/webhook', async (req, res) => {
  const stripeSig = req.headers['stripe-signature'];
  const mpSig = req.headers['x-signature'];

  if (!stripeSig && !mpSig) {
    return res.status(401).json({ success: false, error: 'Missing webhook signature.' });
  }

  try {
    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(500).json({ success: false, error: 'Supabase Admin credentials are not configured on the server.' });
    }

    if (stripeSig) {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        return res.status(503).json({ success: false, error: 'Stripe Webhook Secret not configured.' });
      }
      
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const stripe = require('stripe')(stripeSecretKey);

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody, stripeSig, endpointSecret);
      } catch (err) {
        console.error('[Stripe Webhook Error]', err.message);
        return res.status(400).json({ success: false, error: `Stripe webhook verification failed: ${err.message}` });
      }

      console.log('[Billing Webhook] Stripe event received:', event.type);
      const sessionOrSub = event.data.object;
      
      let userId = sessionOrSub.metadata?.userId || sessionOrSub.client_reference_id;
      let planId = sessionOrSub.metadata?.plan;

      if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
        if (!userId || !planId) {
          console.warn('[Stripe Webhook] userId or planId missing in session:', { userId, planId });
          return res.status(400).json({ success: false, error: 'userId or plan missing in Stripe payload.' });
        }
        
        console.log(`[Billing Webhook] Upgrading user ${userId} to plan ${planId}`);
        const { error } = await sb.auth.admin.updateUserById(userId, {
          user_metadata: { plan: planId }
        });
        if (error) throw error;
        console.log(`[Billing Webhook] User ${userId} successfully upgraded to ${planId}`);
      } else if (event.type === 'customer.subscription.deleted') {
        if (!userId) {
          console.warn('[Stripe Webhook] userId missing in subscription deletion');
          return res.status(400).json({ success: false, error: 'userId missing in Stripe payload.' });
        }
        console.log(`[Billing Webhook] Downgrading user ${userId} to free plan`);
        const { error } = await sb.auth.admin.updateUserById(userId, {
          user_metadata: { plan: 'free' }
        });
        if (error) throw error;
        console.log(`[Billing Webhook] User ${userId} successfully downgraded to free`);
      }
      
      return res.json({ success: true, received: true });
    }

    if (mpSig) {
      const parts = mpSig.split(',');
      let ts = '';
      let v1 = '';
      for (const part of parts) {
        const [key, val] = part.split('=');
        if (key && val) {
          if (key.trim() === 'ts') ts = val.trim();
          if (key.trim() === 'v1') v1 = val.trim();
        }
      }

      const dataId = req.body.data?.id || req.query['data.id'] || req.query['id'];
      if (!dataId) {
        console.log('[MP Webhook] Received webhook without dataId, acknowledging.');
        return res.json({ success: true, message: 'Acknowledged without dataId' });
      }

      const secret = process.env.MP_WEBHOOK_SECRET || process.env.MP_ACCESS_TOKEN;
      if (!secret) {
        return res.status(503).json({ success: false, error: 'Mercado Pago Webhook Secret/Access Token not configured.' });
      }

      const manifest = `id:${dataId}.ts:${ts}.`;
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(manifest);
      const hash = hmac.digest('hex');

      if (hash !== v1) {
        console.error('[MP Webhook] Hash mismatch. Computed:', hash, 'Received:', v1);
        return res.status(401).json({ success: false, error: 'Invalid Mercado Pago signature' });
      }

      console.log('[Billing Webhook] Mercado Pago payment verified signature for ID:', dataId);

      let paymentInfo;
      try {
        const { MercadoPagoConfig, Payment } = require('mercadopago');
        const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const paymentClient = new Payment(mpClient);
        paymentInfo = await paymentClient.get({ id: dataId });
      } catch (err) {
        console.warn('[MP Webhook] SDK payment get failed, falling back to direct fetch:', err.message);
        const resVal = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
        });
        paymentInfo = await resVal.json();
      }

      const status = paymentInfo.status || paymentInfo.body?.status;
      const externalRef = paymentInfo.external_reference || paymentInfo.body?.external_reference;

      console.log(`[MP Webhook] Payment status: ${status}, externalRef: ${externalRef}`);

      if (status === 'approved' && externalRef) {
        let userId, planId;
        try {
          const parsed = JSON.parse(externalRef);
          userId = parsed.userId;
          planId = parsed.plan;
        } catch (e) {
          console.error('[MP Webhook] Failed to parse external reference JSON:', externalRef, e.message);
          return res.status(400).json({ success: false, error: 'Invalid external reference' });
        }

        if (userId && planId) {
          console.log(`[MP Webhook] Upgrading user ${userId} to plan ${planId}`);
          const { error } = await sb.auth.admin.updateUserById(userId, {
            user_metadata: { plan: planId }
          });
          if (error) throw error;
          console.log(`[MP Webhook] User ${userId} successfully upgraded to ${planId}`);
        }
      }

      return res.json({ success: true, received: true });
    }
  } catch (err) {
    console.error('[Billing Webhook] Error processing webhook:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
