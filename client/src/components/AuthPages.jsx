/**
 * Orbin AI - AuthPages v2.0
 * Real Supabase Auth + promo code field.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff, Zap, ArrowRight, Check, Tag, Loader2 } from 'lucide-react'
import { useUser } from '../context/UserContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center px-4 py-12">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/4 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed top-4 right-4 z-20"><LanguageSwitcher /></div>
      <Link to="/" className="flex items-center gap-2 mb-10 group">
        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(245,166,35,0.4)] group-hover:brightness-110 transition-all">
          <svg viewBox="0 0 300 360" className="w-5 h-5" fill="none" aria-hidden="true">
            <g transform="rotate(35 150 180)">
              <path fill="none" stroke="#0E0E0E" strokeWidth="7" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
              <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
            </g>
          </svg>
        </div>
        <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
      </Link>
      <div className="w-full max-w-md">
        <div className="card space-y-6 relative overflow-hidden">
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

function InputField({ label, type = 'text', value, onChange, placeholder, required, disabled }) {
  const [show, setShow] = useState(false)
  const isPwd = type === 'password'
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input type={isPwd && show ? 'text' : type} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder}
          required={required} disabled={disabled}
          className="input-field w-full pr-10 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none disabled:opacity-50" />
        {isPwd && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  )
}

const PLAN_META = {
  free:       { label: 'Free',                     color: 'bg-white/10 text-white/60 border-white/10', icon: null },
  pro:        { label: 'Marceneiro Pro - R$99/mes', color: 'bg-primary/15 text-primary border-primary/30', icon: Zap },
  enterprise: { label: 'Industrial - R$249/mes',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Check },
}
function PlanPill({ planId }) {
  const m = PLAN_META[planId] || PLAN_META.free
  return (
    <div className={"inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest " + m.color}>
      {m.icon && <m.icon size={10} />}{m.label}
    </div>
  )
}

function PromoCodeField({ onApply }) {
  const [code, setCode]       = useState('')
  const [status, setStatus]   = useState(null)
  const [message, setMessage] = useState('')

  const handle = () => {
    if (!code.trim()) return
    const r = onApply(code)
    setStatus(r.success ? 'success' : 'error')
    setMessage(r.message)
    if (r.success) setCode('')
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
        <Tag size={10} className="text-primary/70" />Codigo Promocional
      </p>
      <div className="flex gap-2">
        <input type="text" value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setStatus(null) }}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handle())}
          placeholder="ej. KIRA2080"
          className="input-field flex-1 text-[11px] uppercase tracking-widest" />
        <button type="button" onClick={handle} disabled={!code.trim()}
          className="px-4 py-2 bg-primary/15 text-primary border border-primary/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/25 transition-all disabled:opacity-40">
          Aplicar
        </button>
      </div>
      {status === 'success' && (
        <p className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <Check size={10} />{message}
        </p>
      )}
      {status === 'error' && (
        <p className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">{message}</p>
      )}
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login, signInWithGoogle } = useUser()
  const { lang } = usePreferences()
  const L = lang || 'ES'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const T = {
    title: { ES: 'Bienvenido de vuelta', PT: 'Bem-vindo de volta', EN: 'Welcome back' },
    sub:   { ES: 'Accede a tu workspace de diseno parametrico', PT: 'Acesse seu workspace', EN: 'Access your workspace' },
    email: { ES: 'Correo electronico', PT: 'E-mail', EN: 'Email' },
    pass:  { ES: 'Contrasena', PT: 'Senha', EN: 'Password' },
    btn:   { ES: 'Iniciar Sesion', PT: 'Entrar', EN: 'Log In' },
    noAcc: { ES: 'No tienes cuenta?', PT: 'Nao tem conta?', EN: "Don't have an account?" },
    reg:   { ES: 'Registrarse', PT: 'Cadastrar', EN: 'Sign Up' },
  }
  const t = k => T[k]?.[L] || T[k]?.ES || k

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Complete todos los campos'); return }
    setLoading(true); setError('')
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      const m = err?.message || ''
      if (m.includes('Invalid login')) setError('Email o contrasena incorrectos')
      else if (m.includes('not confirmed')) setError('Confirma tu email antes de ingresar')
      else setError(m || 'Error al iniciar sesion')
    } finally { setLoading(false) }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true); setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Error al iniciar sesion con Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('title')} subtitle={t('sub')}>
      <div className="space-y-4">
        {/* Google OAuth 2.0 SignIn Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="relative w-full h-12 flex items-center justify-center gap-3 bg-[#111111] hover:bg-[#151515] border border-zinc-800 hover:border-blue-500/50 active:border-emerald-500 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,0,0,0.35)] disabled:opacity-50 group overflow-hidden"
        >
          {/* Subtle tech electric blue overlay on hover */}
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Google Multi-color Icon */}
          <svg className="w-4 h-4 shrink-0 relative z-10" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-1.14 2.77-2.4 3.61v3h3.86c2.26-2.08 3.59-5.15 3.59-8.74z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1C3.26 21.8 7.37 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.29C.47 8.23 0 10.06 0 12s.47 3.77 1.29 5.4l3.98-3.11z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.2 1.29 5.4l3.98 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-white relative z-10">
            {L === 'PT' ? 'Entrar com Google' : L === 'EN' ? 'Sign In with Google' : 'Iniciar sesión con Google'}
          </span>
        </button>

        {/* Separator */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-zinc-800/40" />
          <span className="text-[9px] font-bold text-muted uppercase tracking-widest">
            {L === 'PT' ? 'ou entrar com e-mail' : L === 'EN' ? 'or sign in with email' : 'o iniciar con correo'}
          </span>
          <div className="flex-1 h-px bg-zinc-800/40" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label={t('email')} type="email"    value={email}    onChange={setEmail}    placeholder="tu@email.com" required disabled={loading} />
          <InputField label={t('pass')}  type="password" value={password} onChange={setPassword} placeholder="..." required disabled={loading} />
          {error && <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} />{t('btn')}</>}
          </button>
          <div className="text-center text-[11px] text-muted">
            {t('noAcc')} <Link to="/register" className="text-primary hover:underline font-bold">{t('reg')}</Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register, applyPromoCode } = useUser()
  const { lang } = usePreferences()
  const L = lang || 'ES'
  const initialPlan = searchParams.get('plan') || 'free'

  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [plan,      setPlan]      = useState(initialPlan)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const T = {
    title:  { ES: 'Crea tu cuenta', PT: 'Crie sua conta', EN: 'Create your account' },
    sub:    { ES: 'Disena muebles con precision industrial', PT: 'Projete moveis com precisao industrial', EN: 'Design furniture with industrial precision' },
    name:   { ES: 'Nombre completo', PT: 'Nome completo', EN: 'Full name' },
    email:  { ES: 'Correo electronico', PT: 'E-mail', EN: 'Email' },
    pass:   { ES: 'Contrasena (min 6 chars)', PT: 'Senha (min 6)', EN: 'Password (min 6)' },
    plan:   { ES: 'Plan', PT: 'Plano', EN: 'Plan' },
    btn:    { ES: 'Crear Cuenta', PT: 'Criar Conta', EN: 'Create Account' },
    hasAcc: { ES: 'Ya tienes cuenta?', PT: 'Ja tem conta?', EN: 'Already have an account?' },
    login:  { ES: 'Iniciar Sesion', PT: 'Entrar', EN: 'Log In' },
    terms:  { ES: 'Al registrarte aceptas los Terminos de Uso de Orbin AI.', PT: 'Ao se cadastrar aceita os Termos de Uso.', EN: 'By signing up you agree to Orbin AI Terms of Use.' },
    check:  { ES: 'Revisa tu email para confirmar tu cuenta.', PT: 'Verifique seu e-mail.', EN: 'Check your email to confirm.' },
  }
  const t = k => T[k]?.[L] || T[k]?.ES || k

  const handlePromo = (code) => {
    const r = applyPromoCode(code)
    if (r.success) setPlan(r.plan)
    return r
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError('Complete todos los campos'); return }
    if (password.length < 6) { setError('Contrasena minimo 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const { needsVerification } = await register(name, email, password, plan)
      if (needsVerification) navigate('/verify')   // enviar al ingreso del código OTP
      else navigate('/app')                        // confirmación desactivada → sesión activa
    } catch (err) {
      const m = err?.message || ''
      if (m.includes('already registered')) setError('Este email ya tiene cuenta. Inicia sesion.')
      else setError(m || 'Error al registrarse.')
    } finally { setLoading(false) }
  }

  if (confirmed) {
    return (
      <AuthLayout title="Casi listo!" subtitle={t('check')}>
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
            <Check size={24} className="text-emerald-400 mx-auto" />
            <p className="text-[11px] text-muted">Enviamos un link a <span className="text-white font-bold">{email}</span></p>
          </div>
          <Link to="/login" className="btn-primary w-full h-10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            Ir al Login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('title')} subtitle={t('sub')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label={t('name')}  type="text"     value={name}     onChange={setName}     placeholder="Eduardo Ventura"   required disabled={loading} />
        <InputField label={t('email')} type="email"    value={email}    onChange={setEmail}    placeholder="tu@email.com"      required disabled={loading} />
        <InputField label={t('pass')}  type="password" value={password} onChange={setPassword} placeholder="Min. 6 caracteres" required disabled={loading} />

        <div className="space-y-2">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest">{t('plan')}</p>
          <div className="grid grid-cols-3 gap-2">
            {['free','pro','enterprise'].map(p => (
              <button key={p} type="button" onClick={() => setPlan(p)}
                className={"py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all " + (
                  plan === p ? 'bg-primary text-black border-primary'
                             : 'bg-surface-3/50 text-muted border-white/5 hover:border-primary/30 hover:text-white'
                )}>
                {p === 'free' ? 'Free' : p === 'pro' ? 'Pro' : 'Industrial'}
              </button>
            ))}
          </div>
          <div className="flex items-center px-3 py-2 bg-surface-3/40 rounded-xl border border-white/5">
            <PlanPill planId={plan} />
          </div>
        </div>

        <PromoCodeField onApply={handlePromo} />

        {error && <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading}
          className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><ArrowRight size={14} />{t('btn')}</>}
        </button>
        <p className="text-[10px] text-muted/60 text-center leading-relaxed">
          Al registrarte aceptas los <Link to="/terms" className="text-primary hover:underline">Términos de Uso</Link> y la <Link to="/privacy" className="text-primary hover:underline">Política de Privacidad (LGPD)</Link> de Orbin AI.
        </p>
        <div className="text-center text-[11px] text-muted">
          {t('hasAcc')} <Link to="/login" className="text-primary hover:underline font-bold">{t('login')}</Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export function VerifyOTPPage() {
  const navigate = useNavigate()
  const { user, verifyCode, resendCode } = useUser()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const pendingEmail = (() => { try { return localStorage.getItem('orbin-pending-email') || '' } catch { return '' } })()

  const handleResend = async () => {
    setResending(true); setResendMsg(''); setError('')
    const r = await resendCode()
    setResending(false)
    setResendMsg(r.success ? 'Código reenviado. Revisa tu correo.' : (r.error || 'No se pudo reenviar el código.'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const otpString = code.trim().replace(/\s+/g, '')
    if (otpString.length < 6 || otpString.length > 8) {
      setError('Ingrese un código válido de 6 a 8 dígitos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await verifyCode(otpString)
      if (r.success) {
        navigate('/app')
      } else {
        setError(r.error)
      }
    } catch (err) {
      setError(err.message || 'Error de verificación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Verificación de Cuenta" subtitle={`Hemos enviado un código de verificación (OTP) a su correo ${user?.email || pendingEmail || ''}.`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setCode(val);
            }}
            className="w-full h-12 text-center text-xl font-mono font-bold tracking-[0.2em] bg-white/5 border border-white/10 rounded-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-white transition-all"
            disabled={loading}
            required
            autoFocus
          />
        </div>
        {error && <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Verificar Código'}
        </button>
        {resendMsg && <p className="text-[10px] text-center text-emerald-400">{resendMsg}</p>}
        <p className="text-[10px] text-center text-muted">
          ¿No recibiste el código?{' '}
          <button type="button" onClick={handleResend} disabled={resending}
            className="text-primary hover:underline disabled:opacity-50">
            {resending ? 'Reenviando…' : 'Reenviar'}
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
                                                                                                                                                                                                                                                                                                                                                