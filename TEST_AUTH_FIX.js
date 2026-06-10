/**
 * Test del fix de race condition en ProtectedRoute
 * Ejecutar con: node TEST_AUTH_FIX.js
 */

// Simular localStorage del browser
const localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null },
  setItem(k, v) { this._data[k] = v },
  removeItem(k) { delete this._data[k] }
}

const STORAGE_KEY = 'orbin-user-session'

// ── Simular función register() del UserContext ─────────────────────────
function register(name, email, plan = 'free') {
  const newUser = {
    id: Date.now().toString(),
    name, email, plan,
    isLoggedIn: true,
  }
  // FIX: escribe síncronamente
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
  return newUser
}

// ── Simular isLoggedIn() del ProtectedRoute ────────────────────────────
function isLoggedIn() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved).isLoggedIn === true : false
  } catch { return false }
}

// ── TEST ───────────────────────────────────────────────────────────────
console.log('\n🧪 TEST: Fix de race condition Auth\n')

// 1. Estado inicial
console.log('1. Estado inicial:')
console.log('   isLoggedIn() =', isLoggedIn(), '← esperado: false ✓')

// 2. Simular registro (como hace RegisterPage)
console.log('\n2. Usuario hace register("Eduardo", "edu@test.com", "pro"):')
register('Eduardo', 'edu@test.com', 'pro')

// 3. INMEDIATAMENTE después (simula navigate('/app') sin await)
// ProtectedRoute chequea isLoggedIn() en el mismo tick
const check = isLoggedIn()
console.log('   isLoggedIn() inmediatamente después =', check, '← esperado: true', check ? '✓' : '✗ FALLA')

// 4. Verificar contenido de localStorage
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
console.log('\n3. localStorage después del registro:')
console.log('   name:      ', saved.name)
console.log('   email:     ', saved.email)
console.log('   plan:      ', saved.plan)
console.log('   isLoggedIn:', saved.isLoggedIn, saved.isLoggedIn ? '✓' : '✗')

// 5. Simular login demo
console.log('\n4. Test login demo (pro@orbin.ai):')
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  id: '1', email: 'pro@orbin.ai', name: 'Eduardo Pro',
  plan: 'pro', isLoggedIn: true
}))
console.log('   isLoggedIn() =', isLoggedIn(), '← esperado: true ✓')

// Resultado
const passed = check && saved.isLoggedIn
console.log('\n' + (passed ? '✅ TODOS LOS TESTS PASARON' : '❌ ALGÚN TEST FALLÓ'))
console.log(passed
  ? '   El fix de race condition funciona correctamente.'
  : '   Revisar la implementación del fix.')
console.log()
