import { useNavigate, Link } from 'react-router-dom'
import {
  Zap, Box, Check, X, ArrowRight,
  FileText, ChevronRight, PlayCircle, Users
} from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

// I18N Inline Helper for Landing Page (to avoid polluting global i18n unnecessarily, keeping it contained)
const t = (key, lang, defaultText = '') => {
  const dict = {
    hero_headline: {
      PT: 'Projete e orce qualquer armário em 30 segundos — sem instalar nada',
      ES: 'Diseña y presupuesta cualquier armario en 30 segundos — sin instalar nada',
      EN: 'Design and quote any cabinet in 30 seconds — without installing anything'
    },
    hero_sub: {
      PT: 'O único motor web paramétrico com IA que gera vistas 3D, custos e listas de corte instantaneamente.',
      ES: 'El único motor web paramétrico con IA que genera vistas 3D, costos y listas de corte instantáneamente.',
      EN: 'The only web-based parametric AI engine that instantly generates 3D views, costs, and cut lists.'
    },
    hero_cta1: { PT: 'Criar meu projeto grátis →', ES: 'Crear mi proyecto gratis →', EN: 'Create my free project →' },
    hero_cta2: { PT: 'Ver demo em 90 segundos', ES: 'Ver demo en 90 segundos', EN: 'Watch 90s demo' },
    social_proof: { PT: 'Usado por marceneiros em São Paulo, Curitiba e Santiago', ES: 'Usado por carpinteros en São Paulo, Curitiba y Santiago', EN: 'Used by carpenters in São Paulo, Curitiba, and Santiago' },
    
    // Problem/Solution
    prob_1_pain: { PT: 'Software atual (Promob/KD Max) custa R$8.000-20.000/ano e só funciona no Windows.', ES: 'Software antiguo, caro y atado a Windows.', EN: 'Old, expensive software tied to Windows.' },
    prob_1_sol: { PT: 'Orbin é 100% web. Rode no Mac, PC ou Celular sem instalar nada.', ES: 'Orbin es 100% web. Funciona en Mac, PC o Celular.', EN: 'Orbin is 100% web-based. Runs on Mac, PC, or Mobile.' },
    prob_2_pain: { PT: 'Fazer orçamento manual leva 2-3 horas por projeto.', ES: 'Presupuestar manualmente toma 2-3 horas.', EN: 'Manual quoting takes 2-3 hours.' },
    prob_2_sol: { PT: 'Motor de preços em tempo real, gera o custo na hora.', ES: 'Motor de precios en tiempo real con precisión de 1mm.', EN: 'Real-time pricing engine with 1mm precision.' },
    prob_3_pain: { PT: 'Cliente não consegue visualizar o projeto antes de aprovar.', ES: 'El cliente no visualiza el proyecto antes de cerrar.', EN: 'Client cannot visualize the project before buying.' },
    prob_3_sol: { PT: 'Mostre o 3D interativo + AR direto no celular do cliente.', ES: 'Muestra el 3D interactivo directo en el celular del cliente.', EN: 'Show interactive 3D directly on the client phone.' },

    // Features
    feat1_title: { PT: 'Design com IA: Do Chat ao Projeto 3D', ES: 'Diseño con IA: Del Chat al Proyecto 3D', EN: 'AI Design: From Chat to 3D Project' },
    feat1_desc: { PT: 'Converse com a IA para desenhar e modificar móveis em tempo real. Orbin gera instantaneamente o modelo 3D paramétrico, a lista de corte e o custo.', ES: 'Chatea con la IA para diseñar y modificar muebles en tiempo real. Orbin genera al instante el modelo 3D paramétrico, la lista de corte y el costo.', EN: 'Chat with the AI to design and modify furniture in real-time. Orbin instantly generates the parametric 3D model, cut list, and cost.' },
    feat2_title: { PT: 'Lista de Corte CNC automática', ES: 'Lista de Corte y CNC Automática', EN: 'Auto Cut List & CNC' },
    feat2_desc: { PT: 'Geração instantânea de PDF de corte, CSV, G-code e BOM. Precisão industrial impecável na sua fábrica.', ES: 'Generación instantánea de PDF, CSV, G-code y BOM con precisión industrial.', EN: 'Instant generation of PDF, CSV, G-code, and BOM with industrial precision.' },
    feat3_title: { PT: 'Colaboração em tempo real', ES: 'Colaboración en Tiempo Real', EN: 'Real-Time Collaboration' },
    feat3_desc: { PT: 'Compartilhe um link seguro com seu cliente ou equipe. Qualquer alteração de material reflete no custo e 3D instantaneamente.', ES: 'Comparte un link seguro con tu cliente o fábrica. Los cambios reflejan en el costo al instante.', EN: 'Share a secure link with your client or team. Material changes reflect instantly.' },

    // Pricing
    pricing_title: { PT: 'Planos e Preços', ES: 'Planes y Precios', EN: 'Plans & Pricing' },
    plan_subtitle: { PT: 'Comece grátis — upgrade quando precisar', ES: 'Empieza gratis — upgrade cuando lo necesites', EN: 'Start free — upgrade when needed' },
    promo_banner: { PT: 'Use o código KIRA2080 e ganhe o plano Industrial GRÁTIS por 30 dias!', ES: '¡Usa el código KIRA2080 y obtén el plan Industrial GRATIS por 30 días!', EN: 'Use code KIRA2080 and get the Enterprise plan FREE for 30 days!' },
    
    faq_title: { PT: 'Perguntas Frequentes', ES: 'Preguntas Frecuentes', EN: 'Frequently Asked Questions' },
    cta_footer: { PT: 'Pronto para projetar com inteligência?', ES: '¿Listo para diseñar con inteligencia?', EN: 'Ready to design intelligently?' },
  };
  return dict[key]?.[lang] || dict[key]?.PT || defaultText;
}

const PRICING = [
  {
    id:    'free',
    badge: null,
    name:  { ES: 'Gratuito', PT: 'Gratuito', EN: 'Free' },
    target: { ES: 'Para conocer Orbin', PT: 'Para conhecer o Orbin', EN: 'To know Orbin' },
    price: { ES: 'R$ 0', PT: 'R$ 0', EN: 'R$ 0' },
    cta:   { ES: 'Empezar Gratis', PT: 'Começar Grátis', EN: 'Start Free' },
    route: '/register?plan=free',
    highlight: false,
    features: [
      { key: 'modules',   label: { ES: '3 módulos', PT: '3 módulos', EN: '3 modules' }, ok: true },
      { key: 'vis3d',     label: { ES: 'Visor 3D interactivo', PT: 'Visor 3D interativo', EN: 'Interactive 3D viewer' }, ok: true },
      { key: 'export',    label: { ES: 'Exportar listas', PT: 'Sem exportação', EN: 'No exports' }, ok: false },
    ],
  },
  {
    id:    'pro',
    badge: { ES: 'MÁS POPULAR', PT: 'MAIS POPULAR', EN: 'MOST POPULAR' },
    name:  { ES: 'Marceneiro Pro', PT: 'Marceneiro Pro', EN: 'Pro' },
    target: { ES: 'Para carpinteros activos', PT: 'Para marceneiros ativos', EN: 'For active carpenters' },
    price: { ES: 'R$ 99 / mes', PT: 'R$ 99 / mês', EN: 'R$ 99 / mo' },
    cta:   { ES: 'Empezar Pro', PT: 'Começar Pro', EN: 'Start Pro' },
    route: '/register?plan=pro',
    highlight: true,
    features: [
      { key: 'modules',   label: { ES: 'Módulos ilimitados', PT: 'Módulos ilimitados', EN: 'Unlimited modules' }, ok: true },
      { key: 'export',    label: { ES: 'Exportar PDF / CSV', PT: 'Exportar PDF / CSV', EN: 'Export PDF / CSV' }, ok: true },
      { key: 'chatai',    label: { ES: 'Chat con IA', PT: 'Chat AI', EN: 'AI Chat' }, ok: true },
    ],
  },
  {
    id:    'enterprise',
    badge: { ES: 'INDUSTRIAL', PT: 'INDUSTRIAL', EN: 'INDUSTRIAL' },
    name:  { ES: 'Industrial', PT: 'Enterprise', EN: 'Enterprise' },
    target: { ES: 'Para tiendas y fábricas', PT: 'Para lojas e equipes', EN: 'For stores and teams' },
    price: { ES: 'R$ 249 / mes', PT: 'R$ 249 / mês', EN: 'R$ 249 / mo' },
    cta:   { ES: 'Empezar Enterprise', PT: 'Começar Enterprise', EN: 'Start Enterprise' },
    route: '/register?plan=enterprise',
    highlight: false,
    features: [
      { key: 'allpro',    label: { ES: 'Todo lo de Pro', PT: 'Tudo do Pro', EN: 'Everything in Pro' }, ok: true },
      { key: 'etiquetas', label: { ES: 'Etiquetas térmicas', PT: 'Etiquetas térmicas', EN: 'Thermal labels' }, ok: true },
      { key: 'cnc',       label: { ES: 'Archivo CNC', PT: 'CNC', EN: 'CNC' }, ok: true },
      { key: 'bom',       label: { ES: 'Lista BOM', PT: 'BOM', EN: 'BOM' }, ok: true },
    ],
  },
]

const FAQS = [
  {
    q: { PT: 'Orbin substitui o Promob?', ES: '¿Orbin reemplaza a Promob?', EN: 'Does Orbin replace Promob?' },
    a: { PT: 'Sim, o Orbin foi desenhado exatamente para ser uma alternativa web mais rápida e acessível. Você projeta e gera tudo sem instalação pesada.', ES: 'Sí, Orbin fue hecho para reemplazar softwares pesados y caros.', EN: 'Yes, Orbin was built to replace heavy and expensive software.' }
  },
  {
    q: { PT: 'Funciona sem instalar nada?', ES: '¿Funciona sin instalar nada?', EN: 'Does it work without installing anything?' },
    a: { PT: 'Exatamente. O Orbin roda 100% no seu navegador de internet (Chrome, Safari, Edge), seja no computador, macbook ou no tablet.', ES: 'Exactamente. Orbin corre 100% en el navegador web.', EN: 'Exactly. Orbin runs 100% in your web browser.' }
  },
  {
    q: { PT: 'A IA entende português e espanhol?', ES: '¿La IA entiende portugués y español?', EN: 'Does the AI understand natural language?' },
    a: { PT: 'Sim. Descreva o móvel em português ou espanhol e o Orbin interpreta dimensões, gavetas, portas e divisórias, gerando o 3D paramétrico na hora.', ES: 'Sí. Describe el mueble en español o portugués y Orbin interpreta dimensiones, cajones, puertas y divisiones, generando el 3D paramétrico al instante.', EN: 'Yes. Describe the furniture in Portuguese, Spanish, or English and Orbin parses dimensions, drawers, doors, and dividers to generate the parametric 3D instantly.' }
  },
  {
    q: { PT: 'Posso exportar para CNC?', ES: '¿Puedo exportar para CNC?', EN: 'Can I export to CNC?' },
    a: { PT: 'Sim. No plano Enterprise, você pode exportar arquivos CSV e G-code para as principais máquinas CNC do mercado, além de listas de corte.', ES: 'Sí, en el plan Enterprise puedes exportar CSV y G-code.', EN: 'Yes, on the Enterprise plan you can export CSV and G-code.' }
  },
  {
    q: { PT: 'Como funciona a colaboração em tempo real?', ES: '¿Cómo funciona la colaboración en tiempo real?', EN: 'How does real-time collaboration work?' },
    a: { PT: 'Você gera um link único do seu projeto. Ao enviar para o cliente, eles conseguem visualizar o móvel 3D, ver o orçamento em tempo real e aprovar direto no celular.', ES: 'Generas un link único y tu cliente puede ver y aprobar el proyecto en su celular.', EN: 'You generate a unique link and your client can view and approve the project on their phone.' }
  }
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { lang } = usePreferences()
  const L = lang || 'PT'

  const l = (obj) => obj[L] || obj.PT || Object.values(obj)[0]

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white overflow-x-hidden">
      
      {/* ── JSON-LD Schema ── */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQS.map(f => ({
            "@type": "Question",
            "name": l(f.q),
            "acceptedAnswer": {
              "@type": "Answer",
              "text": l(f.a)
            }
          }))
        })}
      </script>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-white/5 bg-[#0D0D0D]/80 backdrop-blur-md">
        <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 cursor-pointer select-none">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(245,166,35,0.4)]">
            <svg viewBox="0 0 300 360" className="w-5 h-5" fill="none" aria-hidden="true">
              <g transform="rotate(35 150 180)">
                <path fill="none" stroke="#0E0E0E" strokeWidth="7" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
                <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
              </g>
            </svg>
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button onClick={() => navigate('/login')} className="text-[11px] font-bold text-muted hover:text-white uppercase tracking-widest transition-colors">
            { L === 'PT' ? 'Entrar' : L === 'EN' ? 'Log In' : 'Iniciar Sesión' }
          </button>
        </div>
      </nav>

      {/* ── Section 1: Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mx-auto max-w-4xl">
            {t('hero_headline', L)}
          </h1>
          
          <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed font-medium">
            {t('hero_sub', L)}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <button
              onClick={() => navigate('/register?plan=free')}
              className="btn-primary px-8 py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all"
            >
              <Zap size={18} />
              {t('hero_cta1', L)}
            </button>
            <a
              href="https://youtube.com"
              target="_blank" rel="noreferrer"
              className="px-8 py-4 text-sm font-black uppercase tracking-widest border border-white/10 rounded-2xl hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} />
              {t('hero_cta2', L)}
            </a>
          </div>

          <div className="pt-12 flex items-center justify-center gap-2 text-sm text-white/40 font-medium">
            <Users size={16} />
            <span>{t('social_proof', L)}</span>
          </div>
        </div>
      </section>

      {/* ── Section 2: Problem/Solution (3 Columns) ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-4 p-6 bg-black/40 rounded-2xl border border-white/5">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <X size={24} className="text-red-400" />
            </div>
            <h3 className="text-base font-medium text-white/50">{t('prob_1_pain', L)}</h3>
            <div className="flex items-start gap-3 pt-2">
              <Check size={20} className="text-primary shrink-0 mt-0.5" />
              <p className="text-white/90 font-bold">{t('prob_1_sol', L)}</p>
            </div>
          </div>
          <div className="space-y-4 p-6 bg-black/40 rounded-2xl border border-white/5">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <X size={24} className="text-red-400" />
            </div>
            <h3 className="text-base font-medium text-white/50">{t('prob_2_pain', L)}</h3>
            <div className="flex items-start gap-3 pt-2">
              <Check size={20} className="text-primary shrink-0 mt-0.5" />
              <p className="text-white/90 font-bold">{t('prob_2_sol', L)}</p>
            </div>
          </div>
          <div className="space-y-4 p-6 bg-black/40 rounded-2xl border border-white/5">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
              <X size={24} className="text-red-400" />
            </div>
            <h3 className="text-base font-medium text-white/50">{t('prob_3_pain', L)}</h3>
            <div className="flex items-start gap-3 pt-2">
              <Check size={20} className="text-primary shrink-0 mt-0.5" />
              <p className="text-white/90 font-bold">{t('prob_3_sol', L)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Feature Demo ────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto space-y-32">
          
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                <Zap size={14} /> { L === 'PT' ? 'Design com IA' : L === 'EN' ? 'AI Design' : 'Diseño con IA' }
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">{t('feat1_title', L)}</h2>
              <p className="text-lg text-white/60 leading-relaxed font-medium">
                {t('feat1_desc', L)}
              </p>
              <button onClick={() => navigate('/register')} className="text-primary font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest text-xs">
                { L === 'PT' ? 'Ver na prática' : L === 'EN' ? 'See in practice' : 'Ver en la práctica' } <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 w-full relative">
              <div className="aspect-[4/3] bg-surface-2 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                <img
                  src="/orbin_chat_3d_render.png"
                  alt="Diseño con IA Demo"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  id="landing-feat-parametric-img"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                <FileText size={14} /> Exportação CNC
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">{t('feat2_title', L)}</h2>
              <p className="text-lg text-white/60 leading-relaxed font-medium">
                {t('feat2_desc', L)}
              </p>
              <button onClick={() => navigate('/register')} className="text-primary font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest text-xs">
                Gerar minha lista <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 w-full relative">
              <div className="aspect-[4/3] bg-surface-2 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                <img
                  src="/orbin_day2_cutlist_mockup.png"
                  alt="Lista de Corte & CNC Demo"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  id="landing-feat-cutlist-img"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                <Zap size={14} /> Real-Time
              </div>
              <h2 className="text-3xl md:text-4xl font-black leading-tight">{t('feat3_title', L)}</h2>
              <p className="text-lg text-white/60 leading-relaxed font-medium">
                {t('feat3_desc', L)}
              </p>
              <button onClick={() => navigate('/register')} className="text-primary font-bold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest text-xs">
                Experimentar agora <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex-1 w-full relative">
              <div className="aspect-[4/3] bg-surface-2 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                <img
                  src="/orbin_day3_collab_mockup.png"
                  alt="Colaboración en Tiempo Real Demo"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  id="landing-feat-collab-img"
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Section 4: Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-black/40 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-4xl font-black">{t('pricing_title', L)}</h2>
            <p className="text-white/50 text-lg font-medium">{t('plan_subtitle', L)}</p>
          </div>

          <div className="max-w-3xl mx-auto bg-primary/10 border border-primary/30 rounded-2xl p-5 mb-12 text-center flex flex-col md:flex-row items-center justify-center gap-4">
            <Zap className="text-primary shrink-0" size={24} />
            <p className="font-bold text-white text-sm md:text-base">{t('promo_banner', L)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PRICING.map(plan => (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-8 space-y-6 transition-all ${
                  plan.highlight
                    ? 'bg-primary/5 border-primary/40 shadow-[0_0_50px_rgba(245,166,35,0.1)] scale-100 md:scale-105 z-10'
                    : 'bg-surface-2/50 border-white/5 hover:border-white/10'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      plan.highlight ? 'bg-primary text-black' : 'bg-white/10 text-white'
                    }`}>
                      {l(plan.badge)}
                    </span>
                  </div>
                )}

                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black text-white">{l(plan.name)}</h3>
                  <p className="text-sm text-white/50 mt-1 font-medium">{l(plan.target)}</p>
                  <p className={`text-4xl font-black mt-6 ${plan.highlight ? 'text-primary' : 'text-white'}`}>
                    {l(plan.price)}
                  </p>
                </div>

                <ul className="space-y-4 pt-6 border-t border-white/10">
                  {plan.features.map(f => (
                    <li key={f.key} className="flex items-center gap-3">
                      {f.ok === true
                        ? <Check size={18} className="text-primary shrink-0" />
                        : <X size={18} className="text-white/20 shrink-0" />
                      }
                      <span className={`text-sm font-medium ${
                        f.ok ? 'text-white/90' : 'text-white/25 line-through'
                      }`}>
                        {l(f.label)}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate(plan.route)}
                  className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-6 ${
                    plan.highlight
                      ? 'bg-primary text-black hover:brightness-110 shadow-lg shadow-primary/20'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {l(plan.cta)} <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: FAQ ───────────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center">
            <h2 className="text-4xl font-black">{t('faq_title', L)}</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="bg-surface-2 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                <h3 className="text-lg font-bold text-white mb-3 flex items-start gap-3">
                  <span className="text-primary mt-1"><Check size={16} /></span> {l(faq.q)}
                </h3>
                <p className="text-white/60 leading-relaxed font-medium pl-7">{l(faq.a)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Footer CTA ───────────────────────────────────────────────────── */}
      <section className="py-32 px-6 text-center relative overflow-hidden bg-primary/5 border-t border-primary/10">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none opacity-50" />
        <div className="max-w-3xl mx-auto space-y-8 relative z-10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">{t('cta_footer', L)}</h2>
          <button
            onClick={() => navigate('/register?plan=free')}
            className="btn-primary px-10 py-5 text-sm font-black uppercase tracking-widest inline-flex items-center gap-3 shadow-[0_0_40px_rgba(245,166,35,0.3)] hover:shadow-[0_0_60px_rgba(245,166,35,0.5)] transition-all"
          >
            <Zap size={20} />
            {t('hero_cta1', L)}
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-muted">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary to-[#C47A0F]">
            <svg viewBox="0 0 300 360" className="w-5 h-5" fill="none" aria-hidden="true">
              <g transform="rotate(35 150 180)">
                <path fill="none" stroke="#0E0E0E" strokeWidth="7" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
                <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
              </g>
            </svg>
          </div>
          <span className="text-xs font-bold tracking-widest uppercase text-white/80">Orbin Technologies</span>
        </div>
        <div className="flex gap-6 text-[10px] uppercase tracking-widest font-bold">
          <Link to="/terms" className="hover:text-primary transition-colors">Termos</Link>
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacidade (LGPD)</Link>
        </div>
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">
          © 2026 Orbin Technologies · Todos os direitos reservados
        </p>
      </footer>
    </div>
  )
}
