const { createClient } = require('./server/node_modules/@supabase/supabase-js')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

const sb = createClient(url, key)

async function run() {
  const { data, error } = await sb.from('projects').select('*').limit(1)
  if (error) {
    console.error('Error fetching project:', error.message)
  } else {
    console.log('Sample project row:', data)
  }
}
run()
