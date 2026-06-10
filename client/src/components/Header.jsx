/**
 * Orbin AI - Header v2.0
 * User dropdown + plan badge + real logout + promo code modal.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Ruler, Crown, LogOut, Settings, Zap, ChevronDown, Tag, Check, X, Globe, ArrowLeft } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useUser, PLANS } from '../context/UserContext.jsx'
import PricingDisplay from './PricingDisplay.jsx'

function UpgradeModal({ onClose }) {
  const { upgradePlan, applyPromoCode, plan } = useUser()
  const [code, setCode]       = useState('')
  const [status, setStatus]   = useState(null)
  const [message, setMessage] = useState('')

  const handlePromo = () => {
    if (!code.trim()) return
    const r = applyPromoCode(code)
    setStatus(r.success ? 'success' : 'error')
    setMessage(r.message)
    if (r.success) setCode('')
  }

  const COLORS = {
    free:       { border: 'border-white/10 hover:border-white/25',      accent: 'text-white/60' },
    pro:        { border: 'border-primary/30 hover:border-primary/60',   accent: 'text-primary' },
    enterprise: { border: 'border-blue-500/30 hover:border-blue-500/60', accent: 'text-blue-400' },
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 w-full max-w-sm mx-4 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-primary" />
            <h3 className="text-sm font-black text-white">Mejorar Plan</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <div className="space-y-2">
          {['free','pro','enterprise'].map(p => {
            const cfg    = PLANS[p]
            const active = plan === p
            const c      = COLORS[p]
            return (
              <button key={p} onClick={() => !active && upgradePlan(p)}
                className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-white/3 transition-all text-left " +
                  (active ? 'border-primary bg-primary/8 cursor-default' : c.border)}>
                <div>
                  <p className={"text-[11px] font-black uppercase tracking-widest " + (active ? 'text-primary' : c.accent)}>
                    {cfg.name.ES}{active && <span className="ml-2 text-[9px] opacity-60">activo</span>}
                  </p>
                  <p className="text-[9px] text-muted mt-0.5">
                    {p === 'free' ? 'Gratuito' : p === 'pro' ? 'R$99 / U$19 por mes' : 'R$249 / U$49 por mes'}
                  </p>
                </div>
                {!active && <ChevronDown size={12} className={c.accent + ' -rotate-90'} />}
              </button>
            )
          })}
        </div>

        <div className="h-px bg-white/5" />

        <div className="space-y-2">
          <p className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Tag size={10} className="text-primary/70" />Codigo Promocional
          </p>
          <div className="flex gap-2">
            <input type="text" value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setStatus(null) }}
              onKeyDown={e => e.key === 'Enter' && handlePromo()}
              placeholder="Ej. KIRA2080"
              className="input-field flex-1 text-[11px] uppercase tracking-widest" />
            <button type="button" onClick={handlePromo} disabled={!code.trim()}
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
      </div>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, accent, danger }) {
  return (
    <button onClick={onClick}
      className={"w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold transition-colors text-left " +
        (danger ? 'text-red-400 hover:bg-red-400/8' : accent ? 'text-primary hover:bg-primary/8' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
      <Icon size={13} />{label}
    </button>
  )
}

function UserDropdown({ onClose, onUpgrade, onSettings }) {
  const { user, plan, logout } = useUser()
  const { lang, setLang, t } = usePreferences()
  const navigate = useNavigate()

  const LABEL = { free: 'Free', pro: 'Pro', enterprise: 'Industrial' }
  const COLOR = { free: 'text-white/50', pro: 'text-primary', enterprise: 'text-blue-400' }

  const handleLogout = async () => {
    onClose()
    await logout()
    navigate('/')
  }

  const cycleLang = () => {
    const langs = ['ES','PT','EN']
    setLang(langs[(langs.indexOf(lang) + 1) % langs.length])
    onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-[220px] bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-[200]">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[10px] text-muted truncate">{user.email}</p>
        <p className={"text-[9px] font-black uppercase tracking-widest mt-0.5 " + COLOR[plan]}>
          Plan {LABEL[plan]}
        </p>
      </div>
      <div className="py-1">
        <MenuItem icon={Settings} label="Configuracion" onClick={() => { onClose(); onSettings() }} />
        <MenuItem icon={Globe}    label={"Idioma: " + lang} onClick={cycleLang} />
        <div className="h-px bg-white/5 my-1" />
        <MenuItem icon={Crown}  label="Mejorar Plan"   accent  onClick={() => { onClose(); onUpgrade() }} />
        <div className="h-px bg-white/5 my-1" />
        <MenuItem icon={LogOut} label="Cerrar Sesion"  danger  onClick={handleLogout} />
      </div>
    </div>
  )
}

function PlanBadge({ plan }) {
  const MAP = {
    free:       { label: 'Free',       cls: 'text-white/50 border-white/10 bg-white/3' },
    pro:        { label: 'Pro',        cls: 'text-primary border-primary/25 bg-primary/8' },
    enterprise: { label: 'Industrial', cls: 'text-blue-400 border-blue-400/25 bg-blue-400/8' },
  }
  const c = MAP[plan] || MAP.free
  return (
    <span className={"hidden sm:inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest " + c.cls}>
      {c.label}
    </span>
  )
}

function SettingsModal({ onClose }) {
  const { user, plan, companySettings, updateCompanySettings } = useUser()
  const [activeTab, setActiveTab] = useState('security')
  const [company, setCompany] = useState(companySettings?.name || '')
  const [phone, setPhone] = useState(companySettings?.phone || '')
  const [address, setAddress] = useState(companySettings?.address || '')
  const [saveAsDefault, setSaveAsDefault] = useState(true)

  const handleSaveCompany = (e) => {
    e.preventDefault()
    updateCompanySettings({
      ...companySettings,
      name: company,
      phone,
      address
    }, saveAsDefault)
    alert(t('company_saved_ok'))
  }

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#151518] border border-white/10 rounded-3xl p-6 w-full max-w-lg mx-4 space-y-6 shadow-2xl relative overflow-hidden text-white"
        onClick={e => e.stopPropagation()}>
        {/* Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Configuración del Sistema</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-white/5 p-1 rounded-xl gap-1">
          {['security', 'brand', 'billing'].map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === tab ? 'bg-primary text-black' : 'text-muted hover:text-white'
              }`}>
              {tab === 'security' ? 'Seguridad' : tab === 'brand' ? 'Marca Blanca' : 'Facturación'}
            </button>
          ))}
        </div>

        <div className="min-h-[220px] flex flex-col justify-between">
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Usuario activo</span>
                <p className="text-sm font-semibold text-white">{user?.email || 'theboy575@gmail.com'}</p>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider block">Suscripción</span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${
                    plan === 'enterprise' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : plan === 'pro' ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-white/5 text-muted border-white/10'
                  }`}>
                    {plan === 'enterprise' ? 'Enterprise' : plan === 'pro' ? 'Pro' : 'Gratuito'}
                  </span>
                  {plan === 'enterprise' && (
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      ★ Acceso Completo
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'brand' && (
            <form onSubmit={handleSaveCompany} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-muted tracking-wider block">Nombre de Empresa</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                    className="input-field w-full text-xs" placeholder="Mi Marcenaria Pro" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-muted tracking-wider block">Teléfono</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
                    className="input-field w-full text-xs" placeholder="+55 (11) 99999-9999" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-muted tracking-wider block">Dirección</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="input-field w-full text-xs" placeholder="Av. Principal 123, São Paulo" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={saveAsDefault} onChange={e => setSaveAsDefault(e.target.checked)}
                    className="rounded border-white/10 bg-white/5 text-primary focus:ring-0" />
                  <span className="text-[10px] text-muted uppercase tracking-wider">Guardar como predeterminado</span>
                </label>
                <button type="submit"
                  className="btn-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                  Guardar
                </button>
              </div>
            </form>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-4 text-center py-6">
              <p className="text-xs text-muted leading-relaxed">
                Administre sus detalles de facturación, métodos de pago y descargue sus facturas anteriores desde nuestro portal de Stripe seguro.
              </p>
              <button type="button" onClick={() => alert(t('stripe_redirect_sim'))}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10">
                <Zap size={12} /> Abrir Portal de Facturación
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Header({ modules, serverOnline = true }) {
  const { unit, setUnit, t } = usePreferences()
  const { user, plan, logout, isLoading } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropOpen,   setDropOpen]   = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ref = useRef(null)

  const handleHeaderLogout = async () => {
    await logout()
    navigate('/')
  }

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <>
      <header className="border-b border-white/5 glass sticky top-0 z-50">
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 min-h-[3.75rem] flex items-center justify-between gap-4">

          {/* Left side: Logo & Back Button */}
          <div className="flex items-center gap-4">
            <div onClick={() => navigate('/')} className="flex items-center gap-3 group cursor-pointer select-none">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300"
                   style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <rect x="2" y="3" width="20" height="18" rx="2.5" stroke="black" strokeWidth="1.8"/>
                  <line x1="2" y1="11" x2="22" y2="11" stroke="black" strokeWidth="1.4"/>
                  <rect x="5" y="14" width="5.5" height="5" rx="1" fill="black" opacity="0.55"/>
                  <rect x="13.5" y="14" width="5.5" height="5" rx="1" fill="black" opacity="0.55"/>
                </svg>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-black text-white text-[17px] tracking-tight leading-none">Orbin</span>
                  <span className="text-primary font-black text-[17px] tracking-tight leading-none">AI</span>
                </div>
                <span className="hidden sm:block text-[8px] text-muted font-bold tracking-[0.28em] uppercase opacity-50 leading-none">Furniture Engine</span>
              </div>
            </div>
            {location.pathname === '/app' && (
              <button onClick={() => navigate('/')}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/25 hover:bg-white/10 text-white transition-all duration-300 active:scale-95 shadow-sm"
                title="Volver">
                <ArrowLeft size={14} />
              </button>
            )}
          </div>

          {/* Center side: Technical Selectors */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <label className="flex items-center gap-2 bg-surface-3/60 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/5 group hover:border-primary/25 transition-all cursor-pointer">
              <Ruler size={13} className="text-muted group-hover:text-primary transition-colors shrink-0" />
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="bg-transparent text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
                <option value="mm">MM</option>
                <option value="cm">CM</option>
              </select>
            </label>

            {/* ★ Server status badge — switches between online/offline mode */}
            <div
              title={serverOnline ? 'Backend conectado — IA completa ativa' : 'Backend offline — modo paramétrico local ativo'}
              className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-500 ${
                serverOnline
                  ? 'bg-primary/6 border-primary/18'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-primary animate-pulse' : 'bg-amber-400'}`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${serverOnline ? 'text-primary' : 'text-amber-400'}`}>
                {serverOnline ? 'NUBE ULTRA PRO' : 'MODO OFFLINE'}
              </span>
            </div>
          </div>

          {/* Right side: Dropdown & Logout button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {location.pathname === '/app' && (
              <PricingDisplay modules={modules} currency="USD" />
            )}

            {!isLoading && user.isLoggedIn && (
              <div className="relative" ref={ref}>
                <button onClick={() => setDropOpen(o => !o)}
                  className="flex items-center gap-2 bg-surface-3/60 px-3 py-1.5 rounded-xl border border-white/5 hover:border-primary/30 transition-all">
                  <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[9px] font-black text-primary uppercase">
                    {(user.name || user.email || '?')[0]}
                  </div>
                  <PlanBadge plan={plan} />
                  <ChevronDown size={11} className={"text-muted transition-transform " + (dropOpen ? 'rotate-180' : '')} />
                </button>
                {dropOpen && (
                  <UserDropdown onClose={() => setDropOpen(false)} onUpgrade={() => setUpgradeOpen(true)} onSettings={() => setSettingsOpen(true)} />
                )}
              </div>
            )}

            {!isLoading && !user.isLoggedIn && (
              <button onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/25 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                <Zap size={11} />Entrar
              </button>
            )}

            {location.pathname === '/app' && (
              <button onClick={handleHeaderLogout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-950/40 backdrop-blur-md border border-red-900/30 hover:border-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300 active:scale-95"
                title="Cerrar Sesión / Sair">
                <LogOut size={11} /> Salir
              </button>
            )}
          </div>
        </div>
      </header>
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
