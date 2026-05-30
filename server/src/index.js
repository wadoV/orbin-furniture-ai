/**
 * Orbin AI — Express Server
 * Motor paramétrico de design de móveis com IA.
 */

require('dotenv').config()

const express        = require('express')
const cors           = require('cors')
const http           = require('http')
const { Server }     = require('socket.io')
const rateLimit      = require('express-rate-limit')
const designRouter     = require('./routes/design')
const chatRouter       = require('./routes/chat')
const projectsRouter   = require('./routes/projects')
const visionRouter     = require('./routes/vision')
// stressTest loaded only in non-production environments
const stressTestRouter = process.env.NODE_ENV !== 'production' ? require('./routes/stressTest') : null

const app  = express()
const server = http.createServer(app)

const PORT = process.env.PORT || 3003

// ─── Rate Limiters ──────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { success: false, error: 'Demasiadas solicitudes desde esta IP, intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Limit each IP to 15 AI generations per minute to prevent heavy cost/abuse
  message: { success: false, error: 'Has superado el límite de peticiones de IA. Por favor, espera un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── Middleware ───────────────────────────────────────────────────────────────

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || 'https://orbin.app'
    : (origin, callback) => {
        // Allow localhost clients and ngrok/localtunnel tunnels for QA agents
        const allowed = [
          'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
          'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178',
          'http://localhost:5179', 'http://localhost:5180',
        ]
        if (!origin) return callback(null, true) // server-to-server (no Origin header)
        if (allowed.includes(origin)) return callback(null, true)
        if (/\.ngrok(-free)?\.app$/.test(origin)) return callback(null, true)
        if (/\.loca\.lt$/.test(origin)) return callback(null, true)
        return callback(new Error(`CORS blocked: ${origin}`))
      },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(apiLimiter) // Apply global rate limiting to all requests

app.use(express.json({ limit: '5' + 'mb' })) // 5mb maximum for payloads (reduced from 50mb to prevent DoS, yet sufficient for spatial images)
app.use(express.urlencoded({ extended: true, limit: '5' + 'mb' }))

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/design',       aiLimiter, designRouter)
app.use('/api/chat',         aiLimiter, chatRouter)
app.use('/api/projects',     projectsRouter)
app.use('/api/vision',       aiLimiter, visionRouter)
// ⚠ Stress-test endpoint: development/QA only — NEVER exposed in production
if (stressTestRouter) {
  app.use('/api/v1/stress-test', stressTestRouter)
  console.log('[Dev] Stress-test route active at /api/v1/stress-test')
}

app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'orbin-api',
    version:   '3.0.0',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
    supabase:  !!process.env.SUPABASE_URL,
    gemini:    !!process.env.GEMINI_API_KEY,
    ollama:    !!process.env.OLLAMA_BASE_URL,
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

// ─── Socket.IO Collaboration ───────────────────────────────────────────────────

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'], // websocket first, polling as fallback for proxies
})

io.on('connection', (socket) => {
  // Join a collaborative room
  socket.on('join-room', (roomId, userProfile) => {
    socket.join(roomId)
    socket.roomId = roomId
    socket.userProfile = userProfile || { name: 'Anónimo' }
    
    // Broadcast to others in room that a user joined
    socket.to(roomId).emit('user-joined', { id: socket.id, profile: socket.userProfile })
  })

  // Broadcast cursor movement
  socket.on('cursor-move', (data) => {
    if (!socket.roomId) return
    socket.to(socket.roomId).emit('cursor-update', {
      id: socket.id,
      x: data.x,
      y: data.y,
      name: socket.userProfile?.name
    })
  })

  // Broadcast state changes (parametric modifications)
  socket.on('state-change', (modulesState) => {
    if (!socket.roomId) return
    socket.to(socket.roomId).emit('state-change', modulesState)
  })

  // Disconnect cleanup
  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-left', socket.id)
    }
  })
})

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🪵 Orbin API v2 rodando em http://localhost:${PORT}`)
  console.log(`   Supabase: ${process.env.SUPABASE_URL         ? '✓ conectado'     : '✗ usando memória'}`)
  console.log(`   Gemini:   ${process.env.GEMINI_API_KEY        ? '✓ ativo'         : '✗ usando parser regex'}`)
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`)
})

module.exports = app
