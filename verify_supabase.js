/**
 * Orbin AI — Verificación Supabase
 * Ejecutar: node verify_supabase.js (desde la carpeta Orbin)
 */

require('./server/node_modules/dotenv').config({ path: './server/.env' })
const { createClient } = require('./server/node_modules/@supabase/supabase-js')

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

console.log('\n🪵 Orbin AI — Verificação Supabase\n')
console.log('URL   :', url)
console.log('Key   :', key ? key.slice(0, 20) + '...' : 'NÃO CONFIGURADA')

if (!url || !key || key.includes('PASTE')) {
  console.log('\n❌ Credenciais não configuradas em server/.env')
  process.exit(1)
}

const sb = createClient(url, key)

async function run() {
  const testId = 'VERIFY-' + Date.now()

  // 1. SELECT (lista projetos existentes)
  const { data: list, error: listErr } = await sb
    .from('projects')
    .select('id, label, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (listErr) {
    console.log('\n❌ SELECT falhou:', listErr.message)
    process.exit(1)
  }
  console.log('\n✅ SELECT OK — Projetos no banco:', list.length)

  // 2. INSERT
  const { error: insErr } = await sb.from('projects').upsert({
    id:      testId,
    label:   '🧪 Projeto Verificação Orbin',
    modules: [{ tipo: 'guarda-roupa', largura: 2400, altura: 2200, profundidade: 600 }]
  })
  if (insErr) { console.log('\n❌ INSERT falhou:', insErr.message); process.exit(1) }
  console.log('✅ INSERT OK —', testId)

  // 3. GET
  const { data: row, error: getErr } = await sb
    .from('projects').select('*').eq('id', testId).single()
  if (getErr) { console.log('\n❌ GET falhou:', getErr.message); process.exit(1) }
  console.log('✅ GET OK —', row.label)

  // 4. DELETE (limpa o teste)
  const { error: delErr } = await sb.from('projects').delete().eq('id', testId)
  if (delErr) { console.log('\n⚠️  DELETE falhou:', delErr.message) }
  else { console.log('✅ DELETE OK — registro de teste removido') }

  console.log('\n🎉 SUPABASE 100% OPERACIONAL — Orbin pode persistir projetos!\n')
}

run().catch(e => {
  console.log('\n❌ FATAL:', e.message)
  process.exit(1)
})
