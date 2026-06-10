const { createClient } = require('./server/node_modules/@supabase/supabase-js')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

const sb = createClient(url, key)

async function run() {
  const { data, error } = await sb.from('material_prices').select('*').limit(1)
  if (error) {
    console.error('Error fetching material_prices:', error.message)
  } else {
    console.log('Sample material_prices row:', data)
  }
}
run()
