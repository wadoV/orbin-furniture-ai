const { createClient } = require('./server/node_modules/@supabase/supabase-js')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

const sb = createClient(url, key)

async function run() {
  const { data, error } = await sb.rpc('get_tables') // check if RPC exists
  if (error) {
    // try direct SQL if we can, or select from pg_class. Since rpc might not exist, let's try a common table like projects.
    console.error('RPC get_tables failed:', error.message)
    
    // Let's do a simple request using fetch or pg metadata if possible
    // Wait, let's just query projects to see if it works
    const { data: projData, error: projError } = await sb.from('projects').select('*').limit(1)
    console.log('projects table exists:', !projError, projError?.message || '')
  } else {
    console.log('Tables:', data)
  }
}
run()
