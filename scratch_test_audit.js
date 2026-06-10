const { chatAudit } = require('./server/src/ai/aiOrchestrator')
require('./server/node_modules/dotenv').config({ path: './server/.env' })
const { createClient } = require('./server/node_modules/@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

async function testRoute() {
  const req = {
    body: {
      message: 'Hola, audita mi productividad.',
      sessionId: 'test-1'
    },
    user: { id: null, plan: 'free' }
  }

  const res = {
    json: (data) => console.log('res.json:', data),
    status: (code) => {
      console.log('res.status:', code)
      return res
    }
  }

  try {
    const { message, sessionId, telemetry } = req.body
    const userId = req.user?.id || 'dev-local-user'
    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)

    if (telemetry && typeof telemetry === 'object') {
      const { source, metric_name, metric_value } = telemetry
      if (source && metric_name && metric_value) {
        if (supabase && isUuid(userId)) {
          const { error: dbErr } = await supabase
            .from('telemetry_logs')
            .insert({ user_id: userId, source, metric_name, metric_value })
          if (dbErr) console.error('DB Error:', dbErr.message)
        }
      }
    }

    let finalMessage = message
    if (telemetry && typeof telemetry === 'object') {
      const formattedTelemetry = `[TELEMETRÍA EN VIVO - Fuente: ${telemetry.source}, Métrica: ${telemetry.metric_name}] Datos: ${JSON.stringify(telemetry.metric_value)}`
      finalMessage = `${formattedTelemetry}\n\nUsuario: ${message}`
    }

    const sessions = new Map()
    const history = sessions.get(sessionId) || []
    const result = await chatAudit(history, finalMessage)

    res.json({
      success: true,
      reply:   result.message,
      source:  result.source,
    })
  } catch (err) {
    console.error('Route handler caught error:', err)
  }
}
testRoute()
