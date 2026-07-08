/**
 * One-off admin script — set a Supabase user's plan via service_role.
 * No nuevo endpoint HTTP expuesto (eso sería superficie de ataque nueva sin
 * auth de admin real). Se corre a mano desde terminal cuando haga falta.
 *
 * Uso:
 *   node scripts/set-user-plan.js <email> <plan>
 *   node scripts/set-user-plan.js theboy575@gmail.com enterprise
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { createClient } = require('@supabase/supabase-js')

const [, , emailArg, planArg] = process.argv
const VALID_PLANS = ['free', 'pro', 'enterprise']

async function main() {
  if (!emailArg || !planArg) {
    console.error('Uso: node scripts/set-user-plan.js <email> <plan>')
    console.error(`Planes válidos: ${VALID_PLANS.join(', ')}`)
    process.exit(1)
  }
  if (!VALID_PLANS.includes(planArg)) {
    console.error(`Plan inválido: "${planArg}". Válidos: ${VALID_PLANS.join(', ')}`)
    process.exit(1)
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en server/.env')
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // supabase-js v2 no tiene un getUserByEmail directo en el admin client JS;
  // se pagina listUsers() y se filtra por email (case-insensitive).
  let user = null
  let page = 1
  const perPage = 200
  while (!user) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('Error listando usuarios:', error.message)
      process.exit(1)
    }
    user = data.users.find(u => u.email?.toLowerCase() === emailArg.toLowerCase())
    if (user) break
    if (data.users.length < perPage) break // última página, no se encontró
    page += 1
  }

  if (!user) {
    console.error(`No se encontró ningún usuario con email "${emailArg}".`)
    process.exit(1)
  }

  // SECURITY [2026-06-27]: el plan se escribe en app_metadata, NUNCA en
  // user_metadata (ver server/src/routes/billing.js: upgradeUserPlan). Este
  // script seguía escribiendo user_metadata.plan, que ya nadie lee — quedaba
  // silenciosamente inútil. app_metadata solo es escribible vía service_role,
  // igual que acá.
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, plan: planArg }
  })

  if (updateError) {
    console.error('Error actualizando plan:', updateError.message)
    process.exit(1)
  }

  console.log(`OK: ${emailArg} (${user.id}) → plan "${planArg}"`)
}

main()
