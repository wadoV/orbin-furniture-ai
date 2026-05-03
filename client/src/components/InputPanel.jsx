import { useState, useEffect, useId, useCallback, useRef } from 'react'
import { Sliders, MessageSquare, RotateCcw, Zap, Box, Info, Bot } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ─── FIELD ────────────────────────────────────────────────────────────────────
// Flexible numeric input: allows clearing and re-typing without state locking.
// Uses a local string state; syncs to model only on blur or valid entry.

const FIELD = ({ label, name, value, onChange, type = 'number', min, max, step = 1, suffix = '' }) => {
  const id = useId()
  const isFocused = useRef(false)
  // Local draft value as string so user can freely clear and retype
  const [draft, setDraft] = useState(String(value ?? ''))

  // Sync from parent when value changes externally (e.g. reset, load project)
  // BUT: skip if we are currently typing to avoid "snapping" or "cursor jumping"
  useEffect(() => {
    if (!isFocused.current) {
      setDraft(String(value ?? ''))
    }
  }, [value])

  const handleChange = (e) => {
    setDraft(e.target.value)
    if (type === 'number') {
      const num = parseFloat(e.target.value)
      if (!isNaN(num)) {
        onChange(name, num)
      }
    } else {
      onChange(name, e.target.value)
    }
  }

  const handleBlur = () => {
    isFocused.current = false
    if (type === 'number') {
      const num = parseFloat(draft)
      if (isNaN(num)) {
        // Restore last valid value from parent
        setDraft(String(value ?? ''))
      } else {
        const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, num))
        setDraft(String(clamped))
        onChange(name, clamped)
      }
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label flex justify-between">
        {label}
        {suffix && <span className="text-primary/60 text-[9px] font-black uppercase tracking-tighter" aria-hidden="true">{suffix}</span>}
      </label>
      <input
        id={id}
        className="input-field w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
        type={type === 'number' ? 'text' : type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        name={name}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        onFocus={() => { isFocused.current = true }}
        onBlur={handleBlur}
      />
    </div>
  )
}

// ─── SELECT ───────────────────────────────────────────────────────────────────

const SELECT = ({ label, name, value, onChange, options }) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <select
          id={id}
          className="input-field w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none appearance-none cursor-pointer pr-8"
          name={name} value={value}
          onChange={e => onChange(name, e.target.value)}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── TOGGLE ───────────────────────────────────────────────────────────────────

const TOGGLE = ({ label, name, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[11px] text-white/80 font-black uppercase tracking-widest" id={`label-${name}`}>{label}</span>
    <button
      role="switch"
      aria-checked={value}
      aria-labelledby={`label-${name}`}
      onClick={() => onChange(name, !value)}
      className={`w-10 h-6 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${value ? 'bg-primary shadow-[0_0_12px_rgba(245,166,35,0.4)]' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  </div>
)

// ─── DRAWER LAYOUT BUTTONS ────────────────────────────────────────────────────

const DrawerLayoutButtons = ({ value, onChange, t }) => {
  const options = [
    { value: 'left',     label: t('drawer_layout_left')   },
    { value: 'vertical', label: t('drawer_layout_center') },
    { value: 'right',    label: t('drawer_layout_right')  },
  ]
  return (
    <div>
      <p className="label mb-2">{t('drawer_layout')}</p>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange('drawerLayout', opt.value)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${value === opt.value
                ? 'bg-primary text-black border-primary shadow-[0_0_12px_rgba(245,166,35,0.35)]'
                : 'bg-surface-3 text-muted border-white/5 hover:border-primary/30 hover:text-white'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  moduleType: 'standard',
  width: 600, height: 720, depth: 580,
  thickness: 18, backThickness: 6,
  numShelves: 1, numDrawers: 0, drawerHeight: 180,
  numDividers: 0,
  drawerLayout: 'vertical',
  hasDoors: true, numDoors: 2, doorType: 'hinged',
  edgeBandingType: 'thin', baseboard: true, baseboardHeight: 100,
  hasCountertop: true
}

// ─── InputPanel ───────────────────────────────────────────────────────────────

export default function InputPanel({ onGenerate, loading, currentConfig, onUpdateConfig }) {
  const { t, unit, convert } = usePreferences()
  const [mode,   setMode]   = useState('manual')
  const [nlText, setNlText] = useState('')
  const [params, setParams] = useState({ ...DEFAULTS })

  // Sync from parent module selection
  useEffect(() => {
    if (currentConfig) {
      setParams(p => ({ ...p, ...currentConfig }))
    }
  }, [currentConfig])

  // Stable setter — avoids infinite loops: only propagates to parent if a module is loaded
  const setParam = useCallback((k, v) => {
    setParams(prev => {
      const next = { ...prev, [k]: v }
      if (currentConfig && onUpdateConfig) {
        onUpdateConfig({ [k]: v })
      }
      return next
    })
  }, [currentConfig, onUpdateConfig])

  const reset = () => { setParams({ ...DEFAULTS }); setNlText('') }

  const handleSubmit = () => {
    if (mode === 'nl') {
      if (!nlText.trim()) return
      onGenerate({ naturalLanguage: nlText })
    } else {
      onGenerate({ params })
    }
  }

  // Unit conversion: display value → internal mm value
  const m = unit === 'cm' ? 10 : 1
  const setDimParam = useCallback((k, v) => {
    const num = parseFloat(v)
    if (isNaN(num)) return
    const mmValue = Math.round(num * m)
    const minVal = k === 'width' ? 100 : (k === 'depth' ? 100 : 50)
    setParam(k, Math.max(mmValue, minVal))
  }, [m, setParam])

  const isAereo = params.moduleType === 'aereo'
  const isBase  = params.moduleType === 'base'

  return (
    <div className="card space-y-6">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface-3/50 p-1 rounded-2xl border border-white/5" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'nl'}
          onClick={() => setMode('nl')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'nl' ? 'bg-primary text-black shadow-lg' : 'text-muted hover:text-white'}`}
        >
          <MessageSquare size={14} aria-hidden="true" /> {t('nl_input')}
        </button>
        <button
          role="tab"
          aria-selected={mode === 'manual'}
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'manual' ? 'bg-primary text-black shadow-lg' : 'text-muted hover:text-white'}`}
        >
          <Sliders size={14} aria-hidden="true" /> {t('tab_parameters')}
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-400">

          {/* ── Typology ──────────────────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
               <Box size={12} /> {t('module_type')}
            </legend>
            <SELECT
              label={t('module_type')}
              name="moduleType"
              value={params.moduleType}
              onChange={setParam}
              options={[
                { value: 'standard', label: t('standard') },
                { value: 'base',     label: t('base') },
                { value: 'aereo',    label: t('aereo') },
              ]}
            />
            {isBase && (
              <div className="animate-in zoom-in-95 duration-200">
                <TOGGLE label={t('has_countertop')} name="hasCountertop" value={params.hasCountertop} onChange={setParam} />
                {!params.hasCountertop && (
                  <div className="mt-2 p-3 bg-primary/5 rounded-xl border border-primary/10 flex gap-3">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted font-medium leading-relaxed">
                      {t('tie_strip')}: {t('no_countertop_info')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* ── Dimensions ────────────────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">{t('external_dimensions')}</legend>
            <div className="grid grid-cols-3 gap-3">
              <FIELD label={t('width')}  name="width"  value={convert(params.width)}  onChange={setDimParam} min={convert(300)} max={convert(3000)} step={unit === 'cm' ? 0.1 : 1} suffix={unit} />
              <FIELD label={t('height')} name="height" value={convert(params.height)} onChange={setDimParam} min={convert(300)} max={convert(2800)} step={unit === 'cm' ? 0.1 : 1} suffix={unit} />
              <FIELD label={t('depth')}  name="depth"  value={convert(params.depth)}  onChange={setDimParam} min={convert(150)} max={convert(1000)} step={unit === 'cm' ? 0.1 : 1} suffix={unit} />
            </div>
            {params.width < params.thickness * 2 + 50 && (
              <p className="text-[9px] text-error font-bold uppercase animate-pulse">
                ⚠ {t('width_too_small')}
              </p>
            )}
          </fieldset>

          {/* ── Interior & Dividers ───────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">{t('interior')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <FIELD label={t('fixed_shelves')} name="numShelves"  value={params.numShelves}  onChange={setParam} type="number" min={0} max={10} />
              <FIELD label={t('num_dividers')}  name="numDividers" value={params.numDividers} onChange={setParam} type="number" min={0} max={10} />
              <FIELD label={t('drawers')}        name="numDrawers"  value={params.numDrawers}  onChange={setParam} type="number" min={0} max={10} />
            </div>

            {params.numDividers > 0 && (
              <div className="px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 animate-in zoom-in-95 duration-200">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest">
                  {params.numDividers}× {t('internal_divider')}
                </p>
              </div>
            )}

            {params.numDrawers > 0 && (
              <div className="space-y-4 animate-in zoom-in-95 duration-200">
                <FIELD
                  label={t('drawer_height')}
                  name="drawerHeight"
                  value={convert(params.drawerHeight)}
                  onChange={setDimParam}
                  min={convert(100)} max={convert(450)}
                  step={unit === 'cm' ? 0.1 : 1}
                  suffix={unit}
                />
                <DrawerLayoutButtons
                  value={params.drawerLayout}
                  onChange={setParam}
                  t={t}
                />

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between group/row">
                    <label className="text-[10px] font-black text-muted uppercase tracking-wider group-hover/row:text-primary transition-colors flex items-center gap-2">
                      <Bot size={12} className="text-primary/60" />
                      {t('divide_drawers')}
                    </label>
                    <button
                      onClick={() => setParam('divideDrawers', !params.divideDrawers)}
                      className={`w-10 h-5 rounded-full relative transition-all duration-300 ${params.divideDrawers ? 'bg-primary shadow-[0_0_10px_rgba(245,166,35,0.4)]' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-black transition-all duration-300 ${params.divideDrawers ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {params.divideDrawers && params.numDividers > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-muted uppercase tracking-wider mb-2 block">
                        {t('drawer_column')}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: params.numDividers + 1 }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setParam('drawerColumnIndex', idx)}
                            className={`p-2 rounded-lg border text-[10px] font-bold transition-all ${
                              params.drawerColumnIndex === idx 
                                ? 'bg-primary border-primary text-black' 
                                : 'bg-white/5 border-white/5 text-muted hover:border-white/20'
                            }`}
                          >
                            Col {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Doors & Baseboard ─────────────────────────────────────────── */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">{t('doors_and_baseboard')}</legend>
            <TOGGLE label={t('with_doors')} name="hasDoors" value={params.hasDoors} onChange={setParam} />
            {params.hasDoors && (
              <div className="space-y-4 animate-in zoom-in-95 duration-200">
                <div className="grid grid-cols-2 gap-4">
                  <FIELD label={t('num_doors')} name="numDoors" value={params.numDoors} onChange={setParam} type="number" min={1} max={4} />
                  <SELECT
                    label={t('handle_type')}
                    name="handleType"
                    value={params.handleType}
                    onChange={setParam}
                    options={[
                      { value: 'standard', label: t('standard_handle') },
                      { value: 'gola',     label: t('gola_handle') },
                      { value: 'push',     label: t('push_handle') },
                    ]}
                  />
                </div>
              </div>
            )}

            {!isAereo && (
              <div className="animate-in fade-in duration-300">
                <TOGGLE label={t('baseboard')} name="baseboard" value={params.baseboard} onChange={setParam} />
                {params.baseboard && (
                  <div className="mt-2 pl-4 border-l border-white/5">
                    <FIELD
                      label={t('baseboard_height')}
                      name="baseboardHeight"
                      value={convert(params.baseboardHeight)}
                      onChange={setDimParam}
                      min={convert(50)} max={convert(200)}
                      step={unit === 'cm' ? 0.1 : 1}
                      suffix={unit}
                    />
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <label htmlFor="nl-input" className="label">{t('describe_furniture')}</label>
          <textarea
            id="nl-input"
            className="input-field resize-none min-h-[14rem] text-sm leading-relaxed w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none p-4"
            placeholder={t('nl_placeholder')}
            value={nlText}
            onChange={e => setNlText(e.target.value)}
          />
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-6 border-t border-white/5">
        <button
          onClick={reset}
          className="p-3 bg-surface-3 hover:bg-surface-4 text-white rounded-2xl transition-all border border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t('reset')}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || (mode === 'nl' && !nlText.trim())}
          className="btn-primary flex-1 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em] h-14 shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98]"
          aria-busy={loading}
        >
          {loading
            ? <><span className="w-5 h-5 border-3 border-black/30 border-t-black rounded-full animate-spin" aria-hidden="true" /> {t('generating')}</>
            : <><Zap size={18} aria-hidden="true" /> {t('generate_project')}</>
          }
        </button>
      </div>
    </div>
  )
}
