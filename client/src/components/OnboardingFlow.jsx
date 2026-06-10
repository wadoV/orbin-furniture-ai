/**
 * Orbin AI — OnboardingFlow
 * Flujo guiado "60 segundos al primer módulo".
 * Activa solo en la primera visita (localStorage: orbin-onboarding-done).
 * Props:
 *   onComplete(payload) — callback con los parámetros para handleGenerate
 *   onSkip()            — omitir onboarding
 */

import { useState } from 'react'
import { Zap, ArrowRight, ArrowLeft, X, Check, Layers } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ─── Preset templates (labels/hints resolved via i18n by id) ────────────────────
const FURNITURE_TYPES = [
  { id: 'wardrobe', icon: '🚪' },
  { id: 'kitchen',  icon: '🍳' },
  { id: 'shelf',    icon: '📚' },
  { id: 'drawer',   icon: '🗄️' },
  { id: 'custom',   icon: '⚙️' },
]

const SIZE_PRESETS = [
  { id: 'small',  hint: '60×220 cm',  w: 600,  h: 2200, d: 500 },
  { id: 'medium', hint: '120×220 cm', w: 1200, h: 2200, d: 580 },
  { id: 'large',  hint: '180×220 cm', w: 1800, h: 2200, d: 600 },
  { id: 'custom', hint: '---',        w: null, h: null, d: null },
]

const STEP_IDS = ['type', 'size', 'finish']

// ─── Barra de progreso ────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-400 ${
          i < step ? 'bg-primary' : i === step ? 'bg-primary/40' : 'bg-white/10'
        }`} />
      ))}
      <span className="text-[9px] font-black text-muted uppercase tracking-widest shrink-0 ml-1">
        {step + 1}/{total}
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingFlow({ onComplete, onSkip }) {
  const { t } = usePreferences()
  const [step, setStep]       = useState(0)
  const [furType, setFurType] = useState(null)
  const [sizePreset, setSizePreset] = useState(null)
  const [customW, setCustomW] = useState(1200)
  const [customH, setCustomH] = useState(2200)
  const [customD, setCustomD] = useState(580)

  const isCustomSize = sizePreset?.id === 'custom'

  const getWidth  = () => isCustomSize ? customW  : (sizePreset?.w ?? 1200)
  const getHeight = () => isCustomSize ? customH  : (sizePreset?.h ?? 2200)
  const getDepth  = () => isCustomSize ? customD  : (sizePreset?.d ?? 580)

  const canNext = () => {
    if (step === 0) return !!furType
    if (step === 1) return !!sizePreset
    return true
  }

  const handleNext = () => {
    if (step < STEP_IDS.length - 1) { setStep(s => s + 1); return }
    // Generar
    handleGenerate()
  }

  const handleGenerate = () => {
    // Mapear tipo de mueble a parámetros del motor
    const typeMap = {
      wardrobe: { moduleType: 'standard', hasDoors: true,  numDrawers: 2, numShelves: 2 },
      kitchen:  { moduleType: 'base',     hasDoors: true,  numDrawers: 1, numShelves: 1, hasCountertop: true },
      shelf:    { moduleType: 'standard', hasDoors: false, numDrawers: 0, numShelves: 4 },
      drawer:   { moduleType: 'standard', hasDoors: false, numDrawers: 5, numShelves: 0 },
      custom:   { moduleType: 'standard', hasDoors: true,  numDrawers: 2, numShelves: 2 },
    }
    const preset = typeMap[furType?.id] || typeMap.wardrobe

    const payload = {
      params: {
        ...preset,
        width:    getWidth(),
        height:   getHeight(),
        depth:    getDepth(),
        thickness: 18,
        backThickness: 6,
        baseboard: true,
        baseboardHeight: 100,
        materialBody: 'oak_light',
        materialFront: 'white',
      }
    }

    // Marcar onboarding como completado
    try { localStorage.setItem('orbin-onboarding-done', '1') } catch {}
    onComplete(payload)
  }

  const handleSkip = () => {
    try { localStorage.setItem('orbin-onboarding-done', '1') } catch {}
    onSkip()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-md"
         role="dialog" aria-modal="true" aria-label="Flujo de onboarding de Orbin">

      <div className="relative bg-surface-2 border border-white/8 rounded-3xl p-7 w-full max-w-md mx-4 shadow-[0_32px_80px_rgba(0,0,0,0.7)] animate-in">

        {/* Botón cerrar / saltar */}
        <button onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-white hover:bg-surface-3 transition-all"
          title={t('ob_skip_title')} aria-label={t('ob_skip_title')}>
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-glow-sm shrink-0"
               style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)' }}>
            <Layers size={16} className="text-black" />
          </div>
          <div>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.25em]">
              {t('ob_badge')}
            </p>
            <h2 className="text-sm font-black text-white leading-tight">
              {t(`ob_step_${STEP_IDS[step]}_title`)}
            </h2>
          </div>
        </div>

        {/* Progress */}
        <ProgressBar step={step} total={STEP_IDS.length} />

        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-4">
          {t(`ob_step_${STEP_IDS[step]}_sub`)}
        </p>

        {/* ── Step 0: Tipo de mueble ────────────────────────────────── */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-2">
            {FURNITURE_TYPES.map(ft => (
              <button key={ft.id}
                onClick={() => setFurType(ft)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                  furType?.id === ft.id
                    ? 'bg-primary/12 border-primary/50 shadow-glow-sm'
                    : 'bg-surface-3/50 border-white/6 hover:border-white/15'
                }`}
              >
                <span className="text-2xl shrink-0" aria-hidden="true">{ft.icon}</span>
                <div>
                  <p className="text-[12px] font-black text-white">{t('ob_type_' + ft.id)}</p>
                  <p className="text-[10px] text-muted">{t('ob_type_' + ft.id + '_hint')}</p>
                </div>
                <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center" style={{ visibility: furType?.id === ft.id ? 'visible' : 'hidden' }}>
                  <Check size={10} className="text-black" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 1: Tamaño ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {SIZE_PRESETS.map(s => (
                <button key={s.id}
                  onClick={() => setSizePreset(s)}
                  className={`p-3 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                    sizePreset?.id === s.id
                      ? 'bg-primary/12 border-primary/50'
                      : 'bg-surface-3/50 border-white/6 hover:border-white/15'
                  }`}
                >
                  <p className="text-[11px] font-black text-white">{t('ob_size_' + s.id)}</p>
                  <p className="text-[10px] text-muted font-mono mt-0.5">{s.hint}</p>
                  {sizePreset?.id === s.id && s.id !== 'custom' && (
                    <Check size={11} className="text-primary mt-1" />
                  )}
                </button>
              ))}
            </div>

            {/* Campos custom */}
            {isCustomSize && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: t('ob_w'), val: customW, set: setCustomW, min: 200, max: 3000 },
                  { label: t('ob_h'), val: customH, set: setCustomH, min: 400, max: 2800 },
                  { label: t('ob_d'), val: customD, set: setCustomD, min: 300, max: 800  },
                ].map(f => (
                  <div key={f.label}>
                    <label className="label">{f.label}</label>
                    <input
                      type="number"
                      min={f.min} max={f.max}
                      value={f.val}
                      onChange={e => f.set(Number(e.target.value))}
                      className="input-field text-center font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Resumen ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            {[
              { label: t('ob_row_type'),     val: furType ? t('ob_type_' + furType.id) : '—' },
              { label: t('ob_row_width'),    val: `${getWidth()} mm` },
              { label: t('ob_row_height'),   val: `${getHeight()} mm` },
              { label: t('ob_row_depth'),    val: `${getDepth()} mm` },
              { label: t('ob_row_material'), val: 'MDF 18mm · Oak Light' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-white/5">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">{row.label}</span>
                <span className="text-[12px] font-black text-white font-mono">{row.val}</span>
              </div>
            ))}

            <div className="mt-3 p-3 bg-primary/8 border border-primary/20 rounded-2xl flex items-center gap-3">
              <Zap size={16} className="text-primary shrink-0" />
              <p className="text-[11px] text-white/80 leading-snug">
                {t('ob_summary_note')}
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <button key="back" onClick={() => setStep(s => s - 1)}
              className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-[11px] font-black uppercase tracking-widest">
              <ArrowLeft size={13} />
              <span>{t('ob_back')}</span>
            </button>
          )}
          <button
            key="next"
            onClick={handleNext}
            disabled={!canNext()}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40"
          >
            {step === STEP_IDS.length - 1
              ? <span className="flex items-center gap-2"><Zap size={14} /><span>{t('ob_generate_now')}</span></span>
              : <span className="flex items-center gap-2"><span>{t('ob_continue')}</span><ArrowRight size={13} /></span>
            }
          </button>
        </div>

        {/* Skip link */}
        <button onClick={handleSkip}
          className="block w-full text-center text-[9px] text-muted hover:text-white mt-3 transition-colors uppercase tracking-widest font-bold">
          {t('ob_skip_manual')}
        </button>
      </div>
    </div>
  )
}
