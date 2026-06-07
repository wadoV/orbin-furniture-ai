/**
 * Orbin AI — Express Server
 * Motor paramétrico de design de móveis com IA.
 */

require('dotenv').config()

// ─── JWT_SECRET Guard ─────────────────────────────────────────────────────────
// Must run BEFORE the server binds to any port.
// Skipped in test environments so unit/integration suites can run without a real secret.
if (process.env.NODE_ENV !== 'test') {
  const JWT_PLACEHOLDER = 'orbin-dev-secret-change-in-production'
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret || jwtSecret.trim() === '') {
    throw new Error(
      '[Orbin] FATAL: JWT_SECRET is not set.\n' +
      '  Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      '  Then set it in server/.env (never commit the real value).'
    )
  }
  if (jwtSecret === JWT_PLACEHOLDER) {
    throw new Error(
      '[Orbin] FATAL: JWT_SECRET is still the placeholder value.\n' +
      '  Generate a production secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      '  Then replace the value in server/.env.'
    )
  }
  if (jwtSecret.length < 32) {
    throw new Error(
      `[Orbin] FATAL: JWT_SECRET is too short (${jwtSecret.length} chars, minimum 32).\n` +
      '  Use a 64-char hex string: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
}

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

const allowedOrigins = [
  'https://orbin.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
]

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL)
}
if (process.env.N8N_URL) {
  allowedOrigins.push(process.env.N8N_URL)
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    if (/\.vercel\.app$/.test(origin)) {
      return callback(null, true)
    }
    
    if (/\.railway\.app$/.test(origin)) {
      return callback(null, true)
    }
    
    if (/\.ngrok(-free)?\.app$/.test(origin) || /\.loca\.lt$/.test(origin)) {
      return callback(null, true)
    }
    
    return callback(new Error(`CORS blocked: ${origin} (Orbin Strict Policy)`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
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
app.use('/design',           aiLimiter, designRouter)
app.get('/api/prices',       designRouter.getPrices)
app.get('/prices',           designRouter.getPrices)
app.use('/api/chat',         aiLimiter, chatRouter)
app.use('/chat',             aiLimiter, chatRouter)
app.use('/api/projects',     projectsRouter)
app.use('/projects',         projectsRouter)
app.use('/api/vision',       aiLimiter, visionRouter)
app.use('/vision',           aiLimiter, visionRouter)
// ⚠ Stress-test endpoint: development/QA only — NEVER exposed in production
if (stressTestRouter) {
  app.use('/api/v1/stress-test', stressTestRouter)
  app.use('/v1/stress-test',     stressTestRouter)
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
  // Railway uses HTTP/1.1 — WebSocket upgrades work but polling must be available as fallback.
  // Order matters: try WebSocket first (lower latency), fall back to long-polling if the
  // Railway proxy or client network blocks the upgrade (corporate firewalls, etc.).
  transports: ['websocket', 'polling'],
  // Required for Railway: allow the proxy to forward the upgrade request.
  allowEIO3: true,
  // Ping/pong tuning for Railway's 30s idle timeout on the shared pooler.
  pingInterval: 25000,
  pingTimeout:  20000,
})

io.on('connection', (socket) => {
  // Join a collaborative room (hardened: validate room token, cap size, sanitize)
  socket.on('join-room', (roomId, userProfile) => {
    // ── Room id must be a strong, unguessable capability token ──
    const ROOM_RE = /^orbin-[A-Za-z0-9]{12,64}$/
    if (typeof roomId !== 'string' || !ROOM_RE.test(roomId)) {
      socket.emit('join-error', { reason: 'invalid_room' })
      return
    }
    // ── Cap participants per room to prevent abuse / resource exhaustion ──
    const MAX_PER_ROOM = 12
    const current = io.sockets.adapter.rooms.get(roomId)
    if (current && current.size >= MAX_PER_ROOM) {
      socket.emit('join-error', { reason: 'room_full' })
      return
    }
    // ── Sanitize user profile ──
    const name = (userProfile && typeof userProfile.name === 'string')
      ? (userProfile.name.trim().slice(0, 40) || 'Invitado')
      : 'Invitado'

    socket.join(roomId)
    socket.roomId = roomId
    socket.userProfile = { name }

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
// trigger-reload
