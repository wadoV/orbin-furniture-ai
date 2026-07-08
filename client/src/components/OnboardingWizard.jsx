import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles, Sliders, MessageSquare, Camera, X, Box } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { trackEvent, EVENTS } from '../lib/analytics.js'

// ─── Step 1 Presets ──────────────────────────────────────────────────────────
const FURNITURE_TYPES = [
  {
    id: 'wardrobe',
    titleKey: 'onboard_wardrobe',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="2" width="18" height="20" rx="2" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="3" y1="18" x2="21" y2="18" />
        <circle cx="8" cy="10" r="1" />
        <circle cx="16" cy="10" r="1" />
      </svg>
    ),
    params: {
      moduleType: 'standard',
      width: 1200,
      height: 2200,
      depth: 580,
      thickness: 18,
      backThickness: 6,
      numShelves: 2,
      numDrawers: 2,
      drawerLayout: 'vertical',
      hasDoors: true,
      numDoors: 2,
      doorType: 'hinged',
      baseboard: true,
      baseboardHeight: 100,
      hasCountertop: false,
      materialBody: 'oak_light',
      materialFront: 'white',
    }
  },
  {
    id: 'kitchen',
    titleKey: 'onboard_kitchen',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="15" rx="1" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="12" y1="10" x2="12" y2="21" />
        <circle cx="7.5" cy="8" r="0.75" />
        <circle cx="16.5" cy="8" r="0.75" />
      </svg>
    ),
    params: {
      moduleType: 'base',
      width: 800,
      height: 900,
      depth: 600,
      thickness: 18,
      backThickness: 6,
      numShelves: 1,
      numDrawers: 1,
      drawerLayout: 'vertical',
      hasDoors: true,
      numDoors: 2,
      doorType: 'hinged',
      baseboard: true,
      baseboardHeight: 100,
      hasCountertop: true,
      materialBody: 'oak_light',
      materialFront: 'white',
    }
  },
  {
    id: 'bathroom',
    titleKey: 'onboard_bathroom',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="16" height="12" rx="1" />
        <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
        <circle cx="12" cy="14" r="1.5" />
      </svg>
    ),
    params: {
      moduleType: 'base',
      width: 600,
      height: 750,
      depth: 500,
      thickness: 18,
      backThickness: 6,
      numShelves: 0,
      numDrawers: 2,
      drawerLayout: 'vertical',
      hasDoors: false,
      numDoors: 0,
      baseboard: true,
      baseboardHeight: 100,
      hasCountertop: true,
      materialBody: 'oak_light',
      materialFront: 'white',
    }
  },
  {
    id: 'custom',
    titleKey: 'onboard_custom',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    params: {
      moduleType: 'standard',
      width: 1000,
      height: 2000,
      depth: 500,
      thickness: 18,
      backThickness: 6,
      numShelves: 3,
      numDrawers: 0,
      drawerLayout: 'vertical',
      hasDoors: true,
      numDoors: 2,
      doorType: 'hinged',
      baseboard: true,
      baseboardHeight: 100,
      hasCountertop: false,
      materialBody: 'oak_light',
      materialFront: 'white',
    }
  }
]

// ─── Step 2 Options ──────────────────────────────────────────────────────────
const STARTING_METHODS = [
  {
    id: 'params',
    titleKey: 'onboard_method_input',
    descKey: 'onboard_method_input_desc',
    icon: <Sliders className="w-6 h-6 text-primary" />,
    previewType: 'input'
  },
  {
    id: 'chat',
    titleKey: 'onboard_method_chat',
    descKey: 'onboard_method_chat_desc',
    icon: <MessageSquare className="w-6 h-6 text-primary" />,
    previewType: 'chat'
  },
  {
    id: 'vision',
    titleKey: 'onboard_method_vision',
    descKey: 'onboard_method_vision_desc',
    icon: <Camera className="w-6 h-6 text-primary" />,
    previewType: 'vision'
  }
]

// ─── Visual Previews for Step 2 ──────────────────────────────────────────────
function PreviewComponent({ type }) {
  if (type === 'input') {
    return (
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-4 w-full h-[150px] flex flex-col justify-between text-[10px] select-none font-mono">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-zinc-500 font-bold uppercase tracking-wider text-[8px]">
            <span>Dimensões</span>
            <span className="text-primary font-black">Manual</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 border border-white/5 p-1 rounded-lg text-center">
              <span className="block text-[8px] text-zinc-600">Largura</span>
              <span className="text-white font-bold">1200 mm</span>
            </div>
            <div className="bg-zinc-900 border border-white/5 p-1 rounded-lg text-center">
              <span className="block text-[8px] text-zinc-600">Altura</span>
              <span className="text-white font-bold">2200 mm</span>
            </div>
            <div className="bg-zinc-900 border border-white/5 p-1 rounded-lg text-center">
              <span className="block text-[8px] text-zinc-600">Prof.</span>
              <span className="text-white font-bold">580 mm</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <div className="w-3 h-3 bg-primary rounded-full animate-ping shrink-0" />
          <span className="text-[9px] text-zinc-400">Precisão de mm em milissegundos</span>
        </div>
      </div>
    )
  }

  if (type === 'chat') {
    return (
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-3 w-full h-[150px] flex flex-col justify-between text-[9px] select-none">
        <div className="space-y-2 max-h-[105px] overflow-hidden">
          <div className="flex justify-end">
            <div className="bg-primary/10 border border-primary/20 text-primary-hover px-2.5 py-1 rounded-2xl rounded-tr-none font-medium max-w-[85%]">
              Quero um guarda-roupa com 2 gavetas.
            </div>
          </div>
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-white/5 text-zinc-300 px-2.5 py-1 rounded-2xl rounded-tl-none max-w-[85%] leading-relaxed">
              Compreendido! Montando projeto com 2 gavetas centrais e divisórias...
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-600 font-bold text-[8px] uppercase tracking-wider">
          <Sparkles size={10} className="text-primary animate-pulse" />
          <span>Orbin AI Orchestrator</span>
        </div>
      </div>
    )
  }

  if (type === 'vision') {
    return (
      <div className="bg-[#141414] border border-white/5 rounded-2xl w-full h-[150px] relative overflow-hidden flex items-center justify-center select-none">
        {/* Mock background room image representation */}
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 via-zinc-950 to-zinc-900 opacity-60" />
        <div className="absolute inset-4 border border-dashed border-primary/30 rounded-xl flex items-center justify-center flex-col">
          <div className="border border-primary bg-primary/10 px-2 py-1 rounded-md text-[8px] font-mono text-primary font-black uppercase tracking-widest animate-pulse">
            3D Box Bounding
          </div>
          <span className="text-[8px] text-zinc-500 font-mono mt-1">x: 0, y: 1.2m, z: -0.5m</span>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 border border-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-zinc-400">
          AI Vision
        </div>
      </div>
    )
  }

  return null
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OnboardingWizard({ onComplete, onSkip }) {
  const { t } = usePreferences()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState(FURNITURE_TYPES[0])
  const [selectedMethod, setSelectedMethod] = useState(STARTING_METHODS[0])
  // [2026-06-23] Recovered from orphaned OnboardingFlow.jsx: in-onboarding
  // dimension customization. OnboardingWizard previously shipped only fixed
  // preset dimensions per furniture type — this restores manual width/
  // height/depth control without losing analytics/i18n/method-selection.
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [customSize, setCustomSize] = useState({
    width:  FURNITURE_TYPES[0].params.width,
    height: FURNITURE_TYPES[0].params.height,
    depth:  FURNITURE_TYPES[0].params.depth,
  })

  const selectType = (type) => {
    setSelectedType(type)
    setUseCustomSize(false)
    setCustomSize({ width: type.params.width, height: type.params.height, depth: type.params.depth })
  }

  // Effective params actually sent downstream (recommended preset, or user-customized size)
  const finalParams = useCustomSize
    ? { ...selectedType.params, width: customSize.width, height: customSize.height, depth: customSize.depth }
    : selectedType.params

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1)
    } else {
      // Step 4 complete -> trigger payload generation
      trackEvent(EVENTS.ONBOARDING_COMPLETED)
      onComplete({ params: finalParams }, selectedMethod.id)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      
      {/* Background Decorative Glow Lines */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <div className="relative bg-[#111111]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-2xl mx-4 shadow-[0_32px_80px_rgba(0,0,0,0.8)] flex flex-col justify-between min-h-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin">
        
        {/* Top Header Controls */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Orbin AI Setup
            </span>
          </div>
          <button 
            onClick={onSkip}
            className="text-[10px] font-black text-muted hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1.5 focus:outline-none"
          >
            {t('onboard_skip') || 'Pular introdução'}
            <X size={12} />
          </button>
        </div>

        {/* Step Indicator & Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <span>Passo {step} de 4</span>
            <span className="text-primary">{Math.round((step / 4) * 100)}% Concluído</span>
          </div>
          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-hover rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content Area */}
        <div className="flex-1 my-6 flex flex-col justify-center">
          
          {/* STEP 1: Furniture Category selection */}
          {step === 1 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  {t('onboard_step1_title') || 'O que você quer projetar?'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {t('onboard_step1_subtitle') || 'Selecione uma categoria para começar com um modelo pré-configurado.'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {FURNITURE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => selectType(type)}
                    className={`flex flex-col items-center justify-between p-5 rounded-2xl border text-center transition-all duration-300 active:scale-[0.98] focus:outline-none select-none group min-h-[140px] ${
                      selectedType.id === type.id
                        ? 'bg-primary/10 border-primary shadow-[0_0_24px_rgba(245,166,35,0.15)] text-primary'
                        : 'bg-zinc-900/40 border-white/5 hover:border-white/15 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <span className="group-hover:scale-110 transition-transform duration-300">
                        {type.icon}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest mt-3 leading-tight">
                      {t(type.titleKey) || type.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Dimension customization (recovered from OnboardingFlow.jsx) */}
          {step === 2 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  {t('onboard_step_size_title') || 'Quais as medidas do seu projeto?'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {t('onboard_step_size_subtitle') || 'Use o tamanho recomendado ou personalize agora.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setUseCustomSize(false)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] focus:outline-none select-none ${
                    !useCustomSize
                      ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(245,166,35,0.10)] text-primary'
                      : 'bg-zinc-900/40 border-white/5 hover:border-white/15 text-zinc-400 hover:text-white'
                  }`}
                >
                  <p className="text-[11px] font-black uppercase tracking-wider">
                    {t('onboard_size_recommended') || 'Tamanho recomendado'}
                  </p>
                  <p className="text-[10px] font-mono mt-1 opacity-80">
                    {selectedType.params.width}×{selectedType.params.height}×{selectedType.params.depth} mm
                  </p>
                </button>
                <button
                  onClick={() => setUseCustomSize(true)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] focus:outline-none select-none ${
                    useCustomSize
                      ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(245,166,35,0.10)] text-primary'
                      : 'bg-zinc-900/40 border-white/5 hover:border-white/15 text-zinc-400 hover:text-white'
                  }`}
                >
                  <p className="text-[11px] font-black uppercase tracking-wider">
                    {t('onboard_size_custom') || 'Personalizar medidas'}
                  </p>
                  <p className="text-[10px] mt-1 opacity-80">
                    {t('onboard_size_custom_hint') || 'Defina largura, altura e profundidade'}
                  </p>
                </button>
              </div>

              {useCustomSize && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[
                    { key: 'width',  label: t('onboard_size_width')  || 'Largura mm', min: 200, max: 3000 },
                    { key: 'height', label: t('onboard_size_height') || 'Altura mm',  min: 400, max: 2800 },
                    { key: 'depth',  label: t('onboard_size_depth')  || 'Prof. mm',   min: 300, max: 800  },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label">{f.label}</label>
                      <input
                        type="number"
                        min={f.min} max={f.max}
                        value={customSize[f.key]}
                        onChange={e => setCustomSize(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                        className="input-field text-center font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Entry method selection */}
          {step === 3 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  {t('onboard_step2_title') || 'Como prefere começar?'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {t('onboard_step2_subtitle') || 'Escolha o método que melhor se adapta ao seu fluxo de trabalho.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-6 items-center pt-2">
                {/* Method Options list */}
                <div className="space-y-2.5">
                  {STARTING_METHODS.map(method => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method)}
                      className={`flex items-start gap-4 p-4 w-full rounded-2xl border text-left transition-all duration-300 active:scale-[0.98] focus:outline-none select-none ${
                        selectedMethod.id === method.id
                          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(245,166,35,0.10)]'
                          : 'bg-zinc-900/40 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl border shrink-0 ${
                        selectedMethod.id === method.id ? 'bg-primary/15 border-primary/30' : 'bg-zinc-950 border-white/5'
                      }`}>
                        {method.icon}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-black text-white uppercase tracking-wider">
                          {t(method.titleKey) || method.id}
                        </p>
                        <p className="text-[10px] text-zinc-400 leading-snug">
                          {t(method.descKey) || ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Previews based on selection */}
                <div className="hidden sm:flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-white/5 rounded-3xl min-h-[200px]">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                    Preview do Painel
                  </span>
                  <PreviewComponent type={selectedMethod.previewType} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Automated preview & CTA */}
          {step === 4 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  {t('onboard_step3_title') || 'Seu primeiro projeto em 30 segundos'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {t('onboard_step3_subtitle') || 'Geramos um design inicial com base na sua escolha do Passo 1.'}
                </p>
              </div>

              {/* Vector Blueprint outline container */}
              <div className="flex flex-col items-center justify-center py-6 bg-zinc-950/60 border border-white/5 rounded-3xl max-w-sm mx-auto shadow-inner relative overflow-hidden select-none">
                <div className="absolute inset-0 bg-hero-glow pointer-events-none opacity-40" />
                
                {/* Floating Blueprint SVG outline of chosen template */}
                <div className="w-32 h-32 text-primary drop-shadow-[0_0_15px_rgba(245,166,35,0.3)] transform transition-transform hover:scale-105 duration-700 animate-[bounce_4s_infinite_ease-in-out]">
                  {selectedType.id === 'wardrobe' && (
                    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="25" y="10" width="50" height="80" rx="4" />
                      <line x1="50" y1="10" x2="50" y2="90" />
                      <line x1="25" y1="70" x2="75" y2="70" />
                      <line x1="25" y1="50" x2="50" y2="50" />
                      <circle cx="42" cy="35" r="1.5" />
                      <circle cx="58" cy="35" r="1.5" />
                      <line x1="37" y1="78" x2="37" y2="82" />
                      <line x1="63" y1="78" x2="63" y2="82" />
                    </svg>
                  )}
                  {selectedType.id === 'kitchen' && (
                    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="20" y="25" width="60" height="50" rx="3" />
                      <line x1="20" y1="35" x2="80" y2="35" />
                      <line x1="50" y1="35" x2="50" y2="75" />
                      <circle cx="35" cy="30" r="1.5" />
                      <circle cx="65" cy="30" r="1.5" />
                      <line x1="32" y1="52" x2="38" y2="52" />
                      <line x1="62" y1="52" x2="68" y2="52" />
                    </svg>
                  )}
                  {selectedType.id === 'bathroom' && (
                    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="25" y="30" width="50" height="40" rx="3" />
                      <path d="M35 30V22a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v8" />
                      <circle cx="50" cy="50" r="3" />
                      <line x1="35" y1="62" x2="65" y2="62" />
                    </svg>
                  )}
                  {selectedType.id === 'custom' && (
                    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="20" y="15" width="60" height="70" rx="4" />
                      <line x1="40" y1="15" x2="40" y2="85" />
                      <line x1="60" y1="15" x2="60" y2="85" />
                      <line x1="20" y1="38" x2="80" y2="38" />
                      <line x1="20" y1="60" x2="80" y2="60" />
                    </svg>
                  )}
                </div>

                <div className="mt-4 text-center font-mono text-[9px] text-zinc-500 font-bold uppercase tracking-wider space-y-0.5">
                  <p>{t(selectedType.titleKey)} · {finalParams.width}x{finalParams.height}x{finalParams.depth} mm</p>
                  <p className="text-[8px] text-[#00FF99]">100% Validado por Orbin Guard</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="btn-secondary h-11 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <ArrowLeft size={14} />
              <span>{t('onboard_btn_back') || 'Voltar'}</span>
            </button>
          )}

          <button
            onClick={handleNext}
            className="btn-primary h-11 flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <span>
              {step === 4
                ? (t('onboard_btn_finish') || 'Ver meu projeto completo →')
                : (t('onboard_btn_continue') || 'Continuar')}
            </span>
            {step < 4 && <ArrowRight size={14} />}
          </button>
        </div>

      </div>
    </div>
  )
}
