require('./server/node_modules/dotenv').config({ path: './server/.env' })
// Force in-memory fallback for projects storage during tests to bypass database foreign key constraints
process.env.SUPABASE_SERVICE_KEY = ''

// Conditional Auth Mocking
let mockUser = null
const auth = require('./server/src/middleware/auth')
const originalRequireAuth = auth.requireAuth
const originalOptionalAuth = auth.optionalAuth

auth.requireAuth = (req, res, next) => {
  if (mockUser) {
    req.user = mockUser
    return next()
  }
  return originalRequireAuth(req, res, next)
}

auth.optionalAuth = (req, res, next) => {
  if (mockUser) {
    req.user = mockUser
    return next()
  }
  return originalOptionalAuth(req, res, next)
}

const app = require('./server/src/index')
const http = require('http')

const PORT = 3009
let server

async function runTests() {
  console.log('--- STARTING ORBIN BACKEND ROUTE TESTS ---')
  
  // 1. Test /api/billing/plans
  console.log('\n1. Testing GET /api/billing/plans...')
  const plansRes = await makeRequest('GET', '/api/billing/plans')
  console.log('Status:', plansRes.status)
  console.log('Data:', JSON.stringify(plansRes.data, null, 2))
  if (plansRes.status === 200 && plansRes.data.success && plansRes.data.plans.free.maxModules === 3) {
    console.log('✅ PASS: Plans endpoint works and contains correct Free limit.')
  } else {
    console.error('❌ FAIL: Plans endpoint check failed.')
  }

  // 2. Test /api/projects auth gating
  console.log('\n2. Testing GET /api/projects (unauthorized)...')
  mockUser = null // Normal auth check (should return 401 without token)
  const projectsRes = await makeRequest('GET', '/api/projects')
  console.log('Status:', projectsRes.status)
  console.log('Data:', JSON.stringify(projectsRes.data, null, 2))
  if (projectsRes.status === 401) {
    console.log('✅ PASS: /api/projects rejects unauthorized request.')
  } else {
    console.error('❌ FAIL: /api/projects did not reject unauthorized request.')
  }

  // 3. Test /api/projects/save limits (4 modules -> should be blocked for Free user)
  console.log('\n3. Testing POST /api/projects/save (Free limit check - 4 modules)...')
  mockUser = { id: 'd86b8bfa-cb32-475c-b17a-594270d1e573', email: 'free@test.com', plan: 'free' }
  const savePayload4 = {
    design: {
      id: 'TEST-DESIGN-4',
      modules: [
        { id: 'M1', name: 'Módulo 1' },
        { id: 'M2', name: 'Módulo 2' },
        { id: 'M3', name: 'Módulo 3' },
        { id: 'M4', name: 'Módulo 4' }
      ]
    },
    label: 'Proyecto Prueba 4 Módulos'
  }
  const saveRes4 = await makeRequest('POST', '/api/projects/save', savePayload4)
  console.log('Status:', saveRes4.status)
  console.log('Data:', JSON.stringify(saveRes4.data, null, 2))
  if (saveRes4.status === 403 && saveRes4.data.error.includes('Límite de plan gratuito superado')) {
    console.log('✅ PASS: /api/projects/save correctly blocked > 3 modules for free user.')
  } else {
    console.error('❌ FAIL: /api/projects/save did not block > 3 modules for free user.')
  }

  // 4. Test /api/projects/save limits (2 modules -> should be allowed for Free user)
  console.log('\n4. Testing POST /api/projects/save (Free limit check - 2 modules)...')
  const savePayload2 = {
    design: {
      id: 'TEST-DESIGN-2',
      modules: [
        { id: 'M1', name: 'Módulo 1' },
        { id: 'M2', name: 'Módulo 2' }
      ]
    },
    label: 'Proyecto Prueba 2 Módulos'
  }
  const saveRes2 = await makeRequest('POST', '/api/projects/save', savePayload2)
  console.log('Status:', saveRes2.status)
  console.log('Data:', JSON.stringify(saveRes2.data, null, 2))
  if (saveRes2.status === 200 && saveRes2.data.success) {
    console.log('✅ PASS: /api/projects/save correctly allowed 2 modules for free user.')
  } else {
    console.error('❌ FAIL: /api/projects/save did not allow 2 modules for free user.')
  }
}

function makeRequest(method, path, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : ''
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`)
      resolve({ status: 500, data: null })
    })

    if (body) {
      req.write(postData)
    }
    req.end()
  })
}

// Start server and run tests
server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`)
  try {
    await runTests()
  } catch (err) {
    console.error('Unexpected test run error:', err)
  } finally {
    console.log('\nClosing test server...')
    server.close(() => {
      console.log('Test server closed. Exiting.')
      process.exit(0)
    })
  }
})
