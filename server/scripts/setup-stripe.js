/**
 * One-off automation — crea (o reutiliza) los Products + Prices de Stripe
 * para los planes Pro/Enterprise, en base a server/src/routes/billing.js
 * (USD 19/mes Pro, USD 49/mes Enterprise, suscripción mensual recurrente).
 * Idempotente: si ya existe un product con ese nombre, lo reusa en vez de
 * duplicar.
 *
 * Uso: node scripts/setup-stripe.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const stripeKey = process.env.STRIPE_SECRET_KEY
if (!stripeKey) {
  console.error('Falta STRIPE_SECRET_KEY en server/.env')
  process.exit(1)
}
if (!stripeKey.startsWith('sk_test_')) {
  console.error('Esta key no es de test mode (sk_test_...). Por seguridad, este script solo corre con keys de test.')
  process.exit(1)
}

const stripe = require('stripe')(stripeKey)

const PLAN_SPECS = [
  { key: 'PRO',        name: 'Orbin AI — Marceneiro Pro', amountUsdCents: 1900 },
  { key: 'ENTERPRISE', name: 'Orbin AI — Industrial / Empresa', amountUsdCents: 4900 },
]

async function findExistingProduct(name) {
  const products = await stripe.products.list({ limit: 100, active: true })
  return products.data.find(p => p.name === name)
}

async function findExistingPrice(productId, amount) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  return prices.data.find(p =>
    p.unit_amount === amount && p.currency === 'usd' && p.recurring?.interval === 'month'
  )
}

async function main() {
  const result = {}
  for (const spec of PLAN_SPECS) {
    let product = await findExistingProduct(spec.name)
    if (!product) {
      product = await stripe.products.create({ name: spec.name })
      console.log(`Product creado: ${spec.name} (${product.id})`)
    } else {
      console.log(`Product ya existía: ${spec.name} (${product.id})`)
    }

    let price = await findExistingPrice(product.id, spec.amountUsdCents)
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: spec.amountUsdCents,
        currency: 'usd',
        recurring: { interval: 'month' },
      })
      console.log(`Price creado: ${spec.key} → ${price.id} (USD ${spec.amountUsdCents / 100}/mes)`)
    } else {
      console.log(`Price ya existía: ${spec.key} → ${price.id} (USD ${spec.amountUsdCents / 100}/mes)`)
    }
    result[spec.key] = price.id
  }
  console.log('\n--- RESULTADO (para .env) ---')
  console.log(`STRIPE_PRICE_PRO=${result.PRO}`)
  console.log(`STRIPE_PRICE_ENTERPRISE=${result.ENTERPRISE}`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
