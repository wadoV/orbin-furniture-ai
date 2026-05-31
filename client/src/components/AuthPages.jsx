/**
 * Orbin AI — AuthPages v1.0 COMMERCIAL_READY_V4.5
 * Login + Register with plan injection.
 * Flow: Landing → plan selection → register → /app
 */

import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, Zap, ArrowRight, Check } from 'lucide-react'
import { useUser } from '../context/UserContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ─── Shared Layout ────────────────────────────────────────────────────────────
function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/4 rounded-full blur-[100px] pointer-events-none" />

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-10 group">
        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(245,166,35,0.4)] group-hover:brightness-110 transition-all">
          <span className="text-[12px] font-black text-black">O</span>
        </div>
        <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="card space-y-6 relative overflow-hidden">
          {/* Gold top accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="space-y-1.5">
            <h1 className="text-xl font-black text-white">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function InputField({ label, type = 'text', value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="input-field w-full pr-10 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Plan Pill ────────────────────────────────────────────────────────────────
const PLAN_META = {
  free:       { label: 'Free', color: 'bg-white/10 text-white/60', icon: null },
  pro:        { label: 'Marceneiro Pro — R$99/mês', color: 'bg-primary/15 text-primary border-primary/30', icon: Zap },
  enterprise: { label: 'Industrial — R$249/mês', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Check },
}

function PlanPill({ planId }) {
  const meta = PLAN_META[planId] || PLAN_META.free
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
      {meta.icon && <meta.icon size={10} />}
      {meta.label}
    </div>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useUser()
  const { lang } = usePreferences()
  const L = lang || 'ES'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const labels = {
    title:    { ES: 'Bienvenido de vuelta', PT: 'Bem-vindo de volta', EN: 'Welcome back' },
    sub:      { ES: 'Accede a tu workspace de diseño paramétrico', PT: 'Acesse seu workspace de design paramétrico', EN: 'Access your parametric design workspace' },
    email:    { ES: 'Correo electrónico', PT: 'E-mail', EN: 'Email' },
    pass:     { ES: 'Contraseña', PT: 'Senha', EN: 'Password' },
    btn:      { ES: 'Iniciar Sesión', PT: 'Entrar', EN: 'Log In' },
    noAcc:    { ES: '¿No tienes cuenta?', PT: 'Não tem conta?', EN: "Don't have an account?" },
    signup:   { ES: 'Registrarse', PT: 'Cadastrar', EN: 'Sign Up' },
    demoHint: { ES: 'Demo Pro: pro@orbin.ai / cualquier contraseña', PT: 'Demo Pro: pro@orbin.ai / qualquer senha', EN: 'Demo Pro: pro@orbin.ai / any password' },
  }
  const l = k => labels[k]?.[L] || labels[k]?.ES || k

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Complete todos los campos'); return }
    setLoading(true)
    setError('')
    try {
      await new Promise(r => setTimeout(r, 600)) // simulate network
      const user = login(email, password)
      navigate('/app')
    } catch {
      setError('Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={l('title')} subtitle={l('sub')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label={l('email')}   type="email"    value={email}    onChange={setEmail}    placeholder="tu@email.com" required />
        <InputField label={l('pass')}    type="password" value={password} onChange={setPassword} placeholder="••••••••"     required />

        {error && (
          <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            : <><Zap size={14} /> {l('btn')}</>
          }
        </button>

        <p className="text-[10px] text-muted text-center">{l('demoHint')}</p>

        <div className="text-center text-[11px] text-muted">
          {l('noAcc')} {' '}
          <Link to="/register" className="text-primary hover:underline font-bold">{l('signup')}</Link>
        </div>
      </form>
    </AuthLayout>
  )
}

// ─── Register Page ────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useUser()
  const { lang } = usePreferences()
  const L = lang || 'ES'

  const initialPlan = searchParams.get('plan') || 'free'

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [plan,     setPlan]     = useState(initialPlan)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const labels = {
    title:    { ES: 'Crea tu cuenta', PT: 'Crie sua conta', EN: 'Create your account' },
    sub:      { ES: 'Empieza a diseñar muebles con precisión industrial', PT: 'Comece a projetar móveis com precisão industrial', EN: 'Start designing furniture with industrial precision' },
    name:     { ES: 'Nombre completo', PT: 'Nome completo', EN: 'Full name' },
    email:    { ES: 'Correo electrónico', PT: 'E-mail', EN: 'Email' },
    pass:     { ES: 'Contraseña', PT: 'Senha', EN: 'Password' },
    planLbl:  { ES: 'Plan seleccionado', PT: 'Plano selecionado', EN: 'Selected plan' },
    changePlan: { ES: 'Cambiar plan', PT: 'Mudar plano', EN: 'Change plan' },
    btn:      { ES: 'Crear Cuenta', PT: 'Criar Conta', EN: 'Create Account' },
    hasAcc:   { ES: '¿Ya tienes cuenta?', PT: 'Já tem conta?', EN: 'Already have an account?' },
    login:    { ES: 'Iniciar Sesión', PT: 'Entrar', EN: 'Log In' },
    terms:    { ES: 'Al registrarte aceptas los Términos de Uso de Orbin AI.', PT: 'Ao se cadastrar você aceita os Termos de Uso da Orbin AI.', EN: 'By signing up you agree to Orbin AI Terms of Use.' },
  }
  const l = k => labels[k]?.[L] || labels[k]?.ES || k

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError('Complete todos los campos'); return }
    if (password.length < 6) { setError('Contraseña mínimo 6 caracteres'); return }
    setLoading(true)
    setError('')
    try {
      await new Promise(r => setTimeout(r, 700))
      register(name, email, plan)
      navigate('/app')
    } catch {
      setError('Error al registrarse. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={l('title')} subtitle={l('sub')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label={l('name')}  type="text"     value={name}     onChange={setName}     placeholder="Eduardo Ventura" required />
        <InputField label={l('email')} type="email"    value={email}    onChange={setEmail}    placeholder="tu@email.com"    required />
        <InputField label={l('pass')}  type="password" value={password} onChange={setPassword} placeholder="Mín. 6 caracteres" required />

        {/* Plan display */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest">{l('planLbl')}</p>
          <div className="flex items-center justify-between p-3 bg-surface-3/50 rounded-xl border border-white/5">
            <PlanPill planId={plan} />
            <Link
              to="/#pricing"
              onClick={() => navigate('/')}
              className="text-[10px] text-primary hover:underline font-bold"
            >
              {l('changePlan')}
            </Link>
          </div>
        </div>

        {/* Plan selector quick buttons */}
        <div className="grid grid-cols-3 gap-2">
          {['free', 'pro', 'enterprise'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                plan === p
                  ? 'bg-primary text-black border-primary'
                  : 'bg-surface-3/50 text-muted border-white/5 hover:border-primary/30 hover:text-white'
              }`}
            >
              {p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Enterprise'}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            : <><ArrowRight size={14} /> {l('btn')}</>
          }
        </button>

        <p className="text-[10px] text-muted/60 text-center leading-relaxed">{l('terms')}</p>

        <div className="text-center text-[11px] text-muted">
          {l('hasAcc')} {' '}
          <Link to="/login" className="text-primary hover:underline font-bold">{l('login')}</Link>
        </div>
      </form>
    </AuthLayout>
  )
}
