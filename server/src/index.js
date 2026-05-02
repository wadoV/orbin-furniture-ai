/**
 * Orbin AI — Express Server
 * Motor paramétrico de design de móveis com IA.
 */

require('dotenv').config()

const express        = require('express')
const cors           = require('cors')
const designRouter   = require('./routes/design')
const chatRouter     = require('./routes/chat')
const projectsRouter = require('./routes/projects')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || 'https://orbin.app'
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179', 'http://localhost:5180'],
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/design',    designRouter)
app.use('/api/chat',      chatRouter)
app.use('/api/projects',  projectsRouter)

app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'orbin-api',
    version:   '2.0.0',
    timestamp: new Date().toISOString(),
    supabase:  !!process.env.SUPABASE_URL,
    claude:    !!process.env.ANTHROPIC_API_KEY,
    gemini:    !!process.env.GEMINI_API_KEY,
  })
})

// ─── 404 & Error Handlers ────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Rota não encontrada: ${req.method} ${req.path}` })
})

app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err)
  res.status(500).json({ success: false, error: 'Erro interno do servidor.' })
})

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🪵 Orbin API v2 rodando em http://localhost:${PORT}`)
  console.log(`   Supabase: ${process.env.SUPABASE_URL         ? '✓ conectado'     : '✗ usando memória'}`)
  console.log(`   Claude:   ${process.env.ANTHROPIC_API_KEY    ? '✓ ativo'         : '✗ usando parser regex'}`)
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`)
})

module.exports = app
