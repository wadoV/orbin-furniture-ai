/**
 * Orbin AI — LandingPage v1.0 COMMERCIAL_READY_V4.5
 * Dark premium aesthetic, industrial identity, 3-plan pricing table.
 */

import { useNavigate } from 'react-router-dom'
import {
  Zap, Box, Ruler, Layers, Check, X, ArrowRight,
  Shield, Cpu, FileText, Download, Star, ChevronRight
} from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ─── Plan Table Data ──────────────────────────────────────────────────────────
const PRICING = [
  {
    id:    'free',
    badge: null,
    name:  { ES: 'Gratuito', PT: 'Gratuito', EN: 'Free' },
    price: { ES: 'R$ 0 / mes', PT: 'R$ 0 / mês', EN: 'R$ 0 / mo' },
    cta:   { ES: 'Empezar Gratis', PT: 'Começar Grátis', EN: 'Start Free' },
    route: '/register?plan=free',
    highlight: false,
    features: [
      { key: 'modules',   label: { ES: 'Hasta 3 módulos', PT: 'Até 3 módulos', EN: 'Up to 3 modules' }, ok: true },
      { key: 'vis3d',     label: { ES: 'Visor 3D interactivo', PT: 'Visor 3D interativo', EN: 'Interactive 3D viewer' }, ok: true },
      { key: 'chatai',    label: { ES: 'Chat con IA', PT: 'Chat com IA', EN: 'AI Chat' }, ok: false },
      { key: 'thk',       label: { ES: 'Solo 18mm MDF', PT: 'Apenas 18mm MDF', EN: '18mm MDF only' }, ok: 'partial' },
      { key: 'export',    label: { ES: 'Exportar PDF / CSV', PT: 'Exportar PDF / CSV', EN: 'Export PDF / CSV' }, ok: false },
      { key: 'cnc',       label: { ES: 'Archivo CNC (G-code)', PT: 'Arquivo CNC (G-code)', EN: 'CNC File (G-code)' }, ok: false },
      { key: 'bom',       label: { ES: 'Lista de Herrajes (BOM)', PT: 'Lista de Ferragens (BOM)', EN: 'Hardware List (BOM)' }, ok: false },
    ],
  },
  {
    id:    'pro',
    badge: { ES: 'MÁS POPULAR', PT: 'MAIS POPULAR', EN: 'MOST POPULAR' },
    name:  { ES: 'Marceneiro Pro', PT: 'Marceneiro Pro', EN: 'Pro' },
    price: { ES: 'R$ 99 / mes', PT: 'R$ 99 / mês', EN: 'R$ 99 / mo' },
    cta:   { ES: 'Empezar Pro', PT: 'Começar Pro', EN: 'Start Pro' },
    route: '/register?plan=pro',
    highlight: true,
    features: [
      { key: 'modules',   label: { ES: 'Módulos ilimitados', PT: 'Módulos ilimitados', EN: 'Unlimited modules' }, ok: true },
      { key: 'vis3d',     label: { ES: 'Visor 3D interactivo', PT: 'Visor 3D interativo', EN: 'Interactive 3D viewer' }, ok: true },
      { key: 'chatai',    label: { ES: 'Chat IA — Gemini 1.5 Pro', PT: 'Chat IA — Gemini 1.5 Pro', EN: 'AI Chat — Gemini 1.5 Pro' }, ok: true },
      { key: 'thk',       label: { ES: '15mm, 18mm y 25mm', PT: '15mm, 18mm e 25mm', EN: '15mm, 18mm & 25mm' }, ok: true },
      { key: 'export',    label: { ES: 'Exportar PDF / CSV', PT: 'Exportar PDF / CSV', EN: 'Export PDF / CSV' }, ok: true },
      { key: 'cnc',       label: { ES: 'Archivo CNC (G-code)', PT: 'Arquivo CNC (G-code)', EN: 'CNC File (G-code)' }, ok: false },
      { key: 'bom',       label: { ES: 'Lista de Herrajes (BOM)', PT: 'Lista de Ferragens (BOM)', EN: 'Hardware List (BOM)' }, ok: false },
    ],
  },
  {
    id:    'enterprise',
    badge: { ES: 'INDUSTRIAL', PT: 'INDUSTRIAL', EN: 'INDUSTRIAL' },
    name:  { ES: 'Industrial / Empresa', PT: 'Industrial / Empresa', EN: 'Enterprise' },
    price: { ES: 'R$ 249 / mes', PT: 'R$ 249 / mês', EN: 'R$ 249 / mo' },
    cta:   { ES: 'Empezar Enterprise', PT: 'Começar Enterprise', EN: 'Start Enterprise' },
    route: '/register?plan=enterprise',
    highlight: false,
    features: [
      { key: 'modules',   label: { ES: 'Módulos ilimitados + prioridad', PT: 'Módulos ilimitados + prioridade', EN: 'Unlimited modules + priority' }, ok: true },
      { key: 'vis3d',     label: { ES: 'Visor 3D interactivo', PT: 'Visor 3D interativo', EN: 'Interactive 3D viewer' }, ok: true },
      { key: 'chatai',    label: { ES: 'Chat IA — Gemini 1.5 Pro', PT: 'Chat IA — Gemini 1.5 Pro', EN: 'AI Chat — Gemini 1.5 Pro' }, ok: true },
      { key: 'thk',       label: { ES: '15mm, 18mm y 25mm', PT: '15mm, 18mm e 25mm', EN: '15mm, 18mm & 25mm' }, ok: true },
      { key: 'export',    label: { ES: 'Exportar PDF / CSV', PT: 'Exportar PDF / CSV', EN: 'Export PDF / CSV' }, ok: true },
      { key: 'cnc',       label: { ES: 'Archivo CNC (G-code)', PT: 'Arquivo CNC (G-code)', EN: 'CNC File (G-code)' }, ok: true },
      { key: 'bom',       label: { ES: 'Lista de Herrajes (BOM)', PT: 'Lista de Ferragens (BOM)', EN: 'Hardware List (BOM)' }, ok: true },
    ],
  },
]

// ─── Technical Features ───────────────────────────────────────────────────────
const TECH_FEATURES = [
  {
    icon: Ruler,
    title: { ES: 'Precisión Milimétrica', PT: 'Precisão Milimétrica', EN: 'Millimetric Precision' },
    desc:  { ES: 'Caja técnica de 13mm de holgura para correderas telescópicas. Laterales al suelo.', PT: 'Caixa técnica de 13mm de folga para corrediças telescópicas. Laterais ao chão.', EN: '13mm technical clearance for telescopic slides. Sides to the floor.' },
  },
  {
    icon: Box,
    title: { ES: 'Lista de Corte Automática', PT: 'Lista de Corte Automática', EN: 'Auto Cut List' },
    desc:  { ES: 'Genera la lista completa de piezas con dimensiones exactas, veta de madera y cantos por pieza.', PT: 'Gera a lista completa de peças com dimensões exatas, veio da madeira e bordas por peça.', EN: 'Full piece list with exact dimensions, grain direction and edge banding per piece.' },
  },
  {
    icon: Layers,
    title: { ES: 'Visor 3D Paramétrico', PT: 'Visor 3D Paramétrico', EN: 'Parametric 3D Viewer' },
    desc:  { ES: 'Renderizado en tiempo real con Three.js. Selección de piezas, vista explosionada y modo wireframe.', PT: 'Renderização em tempo real com Three.js. Seleção de peças, vista explodida e modo wireframe.', EN: 'Real-time Three.js rendering. Piece selection, exploded view and wireframe mode.' },
  },
  {
    icon: Cpu,
    title: { ES: 'Motor de IA con Gemini Pro', PT: 'Motor de IA com Gemini Pro', EN: 'AI Engine with Gemini Pro' },
    desc:  { ES: 'Describe el mueble en lenguaje natural. Orbin lo convierte en parámetros de fabricación exactos.', PT: 'Descreva o móvel em linguagem natural. Orbin converte em parâmetros de fabricação exatos.', EN: 'Describe the furniture in natural language. Orbin converts it to exact manufacturing parameters.' },
  },
  {
    icon: FileText,
    title: { ES: 'Exportación Industrial', PT: 'Exportação Industrial', EN: 'Industrial Export' },
    desc:  { ES: 'PDF de ficha técnica, CSV para CNC, G-code y lista de herrajes (BOM) para presupuestación.', PT: 'PDF de ficha técnica, CSV para CNC, G-code e lista de ferragens (BOM) para orçamentação.', EN: 'Technical sheet PDF, CNC CSV, G-code and hardware BOM list for quoting.' },
  },
  {
    icon: Shield,
    title: { ES: 'Ingeniería Verificada', PT: 'Engenharia Verificada', EN: 'Verified Engineering' },
    desc:  { ES: 'Validación estructural automática: ancho mínimo, zócalos verticales y distribución de cajones.', PT: 'Validação estrutural automática: largura mínima, rodapés verticais e distribuição de gavetas.', EN: 'Automatic structural validation: minimum width, vertical baseboards and drawer distribution.' },
  },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { lang } = usePreferences()
  const L = lang || 'ES'

  const l = (obj) => obj[L] || obj.ES || Object.values(obj)[0]

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0D0D0D]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(245,166,35,0.4)]">
            <span className="text-[11px] font-black text-black">O</span>
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="text-[11px] font-bold text-muted hover:text-white uppercase tracking-widest transition-colors"
          >
            { L === 'PT' ? 'Entrar' : L === 'EN' ? 'Log In' : 'Iniciar Sesión' }
          </button>
          <button
            onClick={() => navigate('/register?plan=free')}
            className="btn-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest"
          >
            { L === 'PT' ? 'Começar Grátis' : L === 'EN' ? 'Start Free' : 'Empezar Gratis' }
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-[10px] font-black text-primary uppercase tracking-widest">
            <Star size={10} fill="currentColor" />
            { L === 'PT' ? 'Lançamento Comercial v4.5' : L === 'EN' ? 'Commercial Launch v4.5' : 'Lanzamiento Comercial v4.5' }
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            { L === 'PT' ? 'Design Paramétrico com' : L === 'EN' ? 'Parametric Design with' : 'Diseño Paramétrico con' }
            <br />
            <span className="text-primary">
              { L === 'PT' ? 'Precisão Industrial' : L === 'EN' ? 'Industrial Precision' : 'Precisión Industrial' }
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed font-medium">
            { L === 'PT'
              ? 'Gere listas de corte e projetos 3D de móveis em segundos. Caixa técnica de 13mm para corrediças telescópicas, laterais ao chão, folha MDF/MDP com precisão de 1mm.'
              : L === 'EN'
              ? 'Generate cut lists and 3D furniture projects in seconds. 13mm technical box for telescopic slides, sides to the floor, MDF/MDP sheet with 1mm precision.'
              : 'Genera listas de corte y proyectos 3D de muebles en segundos. Caja técnica de 13mm para correderas telescópicas, laterales al suelo, placa MDF/MDP con precisión de 1mm.'
            }
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register?plan=free')}
              className="btn-primary px-8 py-4 text-sm font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              <Zap size={18} />
              { L === 'PT' ? 'Provar Orbin Grátis' : L === 'EN' ? 'Try Orbin Free' : 'Probar Orbin Gratis' }
            </button>
            <button
              onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 text-sm font-black uppercase tracking-widest border border-white/10 rounded-2xl hover:border-primary/30 hover:text-primary transition-all flex items-center gap-2"
            >
              { L === 'PT' ? 'Ver Planos' : L === 'EN' ? 'See Plans' : 'Ver Planes' }
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap justify-center gap-8 pt-4">
            {[
              { val: '1mm',    label: { ES: 'Precisión', PT: 'Precisão', EN: 'Precision' } },
              { val: '13mm',   label: { ES: 'Caja técnica', PT: 'Caixa técnica', EN: 'Tech box' } },
              { val: '3',      label: { ES: 'Espesores', PT: 'Espessuras', EN: 'Thicknesses' } },
              { val: '100%',   label: { ES: 'Fabricable', PT: 'Fabricável', EN: 'Buildable' } },
            ].map(s => (
              <div key={s.val} className="text-center">
                <div className="text-2xl font-black text-primary">{s.val}</div>
                <div className="text-[10px] text-muted font-bold uppercase tracking-widest">{l(s.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Features ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
              { L === 'PT' ? 'Engenharia de Fabricação Real' : L === 'EN' ? 'Real Manufacturing Engineering' : 'Ingeniería de Fabricación Real' }
            </p>
            <h2 className="text-3xl font-black">
              { L === 'PT' ? 'Construído para Marceneiros Profissionais' : L === 'EN' ? 'Built for Professional Carpenters' : 'Construido para Carpinteros Profesionales' }
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-sm">
              { L === 'PT' ? 'Cada cálculo segue as normas brasileiras de MDF/MDP (2750×1840mm).' : L === 'EN' ? 'Every calculation follows Brazilian MDF/MDP standards (2750×1840mm).' : 'Cada cálculo sigue los estándares brasileños de MDF/MDP (2750×1840mm).' }
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TECH_FEATURES.map((f, i) => (
              <div key={i} className="card group hover:border-primary/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,166,35,0.05)]">
                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-all">
                  <f.icon size={20} className="text-primary" />
                </div>
                <h3 className="text-sm font-black text-white mb-2">{l(f.title)}</h3>
                <p className="text-[12px] text-muted leading-relaxed font-medium">{l(f.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical specs callout ───────────────────────────────────────── */}
      <section className="py-16 px-6 bg-primary/5 border-y border-primary/10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            {
              icon: '📐',
              title: { ES: 'Caja de Gaveta Técnica', PT: 'Caixa de Gaveta Técnica', EN: 'Technical Drawer Box' },
              desc:  { ES: '13mm de holgura en cada lateral para correderas telescópicas estándar', PT: '13mm de folga em cada lateral para corrediças telescópicas padrão', EN: '13mm clearance on each side for standard telescopic slides' },
            },
            {
              icon: '⬇️',
              title: { ES: 'Laterales al Suelo', PT: 'Laterais ao Chão', EN: 'Sides to the Floor' },
              desc:  { ES: 'Los paneles laterales llegan hasta el suelo. El zócalo corre por dentro de las laterales.', PT: 'Os painéis laterais chegam até o chão. O rodapé passa por dentro das laterais.', EN: 'Side panels reach the floor. Baseboard runs inside the side panels.' },
            },
            {
              icon: '📋',
              title: { ES: 'Planos Brasileños', PT: 'Padrões Brasileiros', EN: 'Brazilian Standards' },
              desc:  { ES: 'Chapa 2750×1840mm. Costos por m² actualizados para el mercado local.', PT: 'Chapa 2750×1840mm. Custos por m² atualizados para o mercado local.', EN: '2750×1840mm sheet. Cost per m² updated for the local market.' },
            },
          ].map((s, i) => (
            <div key={i} className="space-y-3">
              <div className="text-4xl">{s.icon}</div>
              <h3 className="text-sm font-black text-primary">{l(s.title)}</h3>
              <p className="text-[12px] text-muted leading-relaxed">{l(s.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
              { L === 'PT' ? 'Planos e Preços' : L === 'EN' ? 'Plans & Pricing' : 'Planes y Precios' }
            </p>
            <h2 className="text-3xl font-black">
              { L === 'PT' ? 'Escolha seu Plano' : L === 'EN' ? 'Choose Your Plan' : 'Elige tu Plan' }
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PRICING.map(plan => (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-6 space-y-6 transition-all ${
                  plan.highlight
                    ? 'bg-primary/5 border-primary/40 shadow-[0_0_50px_rgba(245,166,35,0.1)]'
                    : 'bg-surface-2/50 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      plan.highlight ? 'bg-primary text-black' : 'bg-white/10 text-white'
                    }`}>
                      {l(plan.badge)}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div>
                  <h3 className="text-lg font-black text-white">{l(plan.name)}</h3>
                  <p className={`text-2xl font-black mt-2 ${plan.highlight ? 'text-primary' : 'text-white'}`}>
                    {l(plan.price)}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f.key} className="flex items-center gap-3">
                      {f.ok === true
                        ? <Check size={14} className="text-primary shrink-0" />
                        : f.ok === 'partial'
                        ? <Check size={14} className="text-yellow-400 shrink-0" />
                        : <X size={14} className="text-white/20 shrink-0" />
                      }
                      <span className={`text-[12px] font-medium ${
                        f.ok ? 'text-white/80' : 'text-white/25 line-through'
                      }`}>
                        {l(f.label)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => navigate(plan.route)}
                  className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    plan.highlight
                      ? 'bg-primary text-black hover:brightness-110 shadow-lg shadow-primary/20'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {l(plan.cta)} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Bottom ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-black">
            { L === 'PT' ? 'Pronto para fabricar com precisão?' : L === 'EN' ? 'Ready to build with precision?' : '¿Listo para fabricar con precisión?' }
          </h2>
          <p className="text-white/50 text-sm">
            { L === 'PT' ? 'Sem cartão de crédito. Sem instalação. Resultados imediatos.' : L === 'EN' ? 'No credit card. No installation. Instant results.' : 'Sin tarjeta de crédito. Sin instalación. Resultados inmediatos.' }
          </p>
          <button
            onClick={() => navigate('/register?plan=free')}
            className="btn-primary px-10 py-4 text-sm font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-2xl shadow-primary/20"
          >
            <Zap size={18} />
            { L === 'PT' ? 'Provar Grátis Agora' : L === 'EN' ? 'Try Free Now' : 'Probar Gratis Ahora' }
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-muted">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center">
            <span className="text-[8px] font-black text-black">O</span>
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase">Orbin Furniture AI</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest opacity-50">
          © 2026 Orbin Technologies · COMMERCIAL_READY_V4.5
        </p>
      </footer>
    </div>
  )
}
