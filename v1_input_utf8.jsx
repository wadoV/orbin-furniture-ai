import { useState, useEffect, useId } from 'react'
import { Sliders, MessageSquare, RotateCcw, Zap, Rows2, Columns2, DoorOpen, SquareStack } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

const FIELD = ({ label, name, value, onChange, type = 'number', min, max, step = 1, suffix = '' }) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}{suffix && <span className="text-primary ml-1" aria-hidden="true">{suffix.toUpperCase()}</span>}
      </label>
      <input
        id={id}
        className="input-field w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
        type={type} name={name} value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(name, type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    </div>
  )
}

const SELECT = ({ label, name, value, onChange, options }) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select
        id={id}
        className="input-field w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none appearance-none"
        name={name} value={value}
        onChange={e => onChange(name, e.target.value)}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

const TOGGLE = ({ label, name, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-white font-medium" id={`label-${name}`}>{label}</span>
    <button
      role="switch"
      aria-checked={value}
      aria-labelledby={`label-${name}`}
      onClick={() => onChange(name, !value)}
      className={`w-10 h-6 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${value ? 'bg-primary' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  </div>
)

const DEFAULTS = {
  width: 2400, height: 2400, depth: 600,
  thickness: 18, backThickness: 6,
  numShelves: 3, numDrawers: 2, drawerHeight: 180,
  numDividers: 0,
  drawerLayout: 'vertical',
  hasDoors: false, doorType: 'hinged',
  edgeBandingType: 'thin', baseboard: true, baseboardHeight: 100,
}

export default function InputPanel({ onGenerate, loading, currentConfig, onUpdateConfig }) {
  const { t, unit } = usePreferences()
  const [mode,   setMode]   = useState('manual')
  const [nlText, setNlText] = useState('')
  const [params, setParams] = useState({ ...DEFAULTS })

  useEffect(() => {
    if (currentConfig) {
      setParams(p => ({ ...p, ...currentConfig }))
    }
  }, [currentConfig])

  const setParam = (k, v) => {
    const newParams = { ...params, [k]: v }
    setParams(newParams)
    if (currentConfig && onUpdateConfig) {
      onUpdateConfig({ [k]: v })
    }
  }

  const reset = () => { setParams({ ...DEFAULTS }); setNlText('') }

  const handleSubmit = () => {
    if (mode === 'nl') {
      if (!nlText.trim()) return
      onGenerate({ naturalLanguage: nlText })
    } else {
      onGenerate({ params })
    }
  }

  const m = unit === 'm' ? 1000 : 1
  const setDimParam = (k, v) => setParam(k, Math.round(v * m))

  return (
    <div className="card space-y-6">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface-3 p-1 rounded-xl" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'nl'}
          onClick={() => setMode('nl')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'nl' ? 'bg-primary text-black shadow-lg scale-[1.02]' : 'text-muted hover:text-white'}`}
        >
          <MessageSquare size={14} aria-hidden="true" /> {t('nl_input')}
        </button>
        <button
          role="tab"
          aria-selected={mode === 'manual'}
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'manual' ? 'bg-primary text-black shadow-lg scale-[1.02]' : 'text-muted hover:text-white'}`}
        >
          <Sliders size={14} aria-hidden="true" /> {t('tab_parameters')}
        </button>
      </div>

      {/* Manual Parameters */}
      {mode === 'manual' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">

          {/* ÔöÇÔöÇ Dimensiones ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">{t('external_dimensions')}</legend>
            <div className="grid grid-cols-3 gap-3">
              <FIELD label={t('width')}  name="width"  value={params.width/m}  onChange={setDimParam} min={400/m}  max={6000/m} step={unit==='m'?0.01:1} suffix={unit} />
              <FIELD label={t('height')} name="height" value={params.height/m} onChange={setDimParam} min={400/m}  max={3500/m} step={unit==='m'?0.01:1} suffix={unit} />
              <FIELD label={t('depth')}  name="depth"  value={params.depth/m}  onChange={setDimParam} min={200/m}  max={1000/m} step={unit==='m'?0.01:1} suffix={unit} />
            </div>
          </fieldset>

          {/* ÔöÇÔöÇ Interior ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">{t('interior')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <FIELD label={t('fixed_shelves')} name="numShelves"  value={params.numShelves}  onChange={setParam} min={0} max={20} />
              <FIELD label={t('num_dividers')}  name="numDividers" value={params.numDividers} onChange={setParam} min={0} max={10} />
            </div>
          </fieldset>

          {/* ÔöÇÔöÇ Frentes de Gaveta ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <SquareStack size={11} /> {t('drawer_front_label')}
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <FIELD label={t('drawers')}      name="numDrawers"  value={params.numDrawers}  onChange={setParam} min={0} max={20} />
              <FIELD label={t('drawer_height')} name="drawerHeight" value={params.drawerHeight/m} onChange={setDimParam} min={80/m} max={500/m} step={unit==='m'?0.01:1} suffix={unit} />
            </div>

            {params.numDrawers > 0 && (
              <div className="bg-surface-2 p-4 rounded-2xl border border-white/5 space-y-3">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{t('drawer_layout')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setParam('drawerLayout', 'vertical')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all
                      ${params.drawerLayout === 'vertical'
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(245,166,35,0.15)]'
                        : 'bg-surface-3 border-transparent text-muted hover:border-white/20'}`}
                  >
                    <Rows2 size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('drawer_layout_vertical')}</span>
                  </button>
                  <button
                    onClick={() => setParam('drawerLayout', 'horizontal')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all
                      ${params.drawerLayout === 'horizontal'
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(245,166,35,0.15)]'
                        : 'bg-surface-3 border-transparent text-muted hover:border-white/20'}`}
                  >
                    <Columns2 size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('drawer_layout_horizontal')}</span>
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          {/* ÔöÇÔöÇ Puertas ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <DoorOpen size={11} /> {t('standard_door_label')}
            </legend>

            <TOGGLE label={t('with_doors')} name="hasDoors" value={params.hasDoors} onChange={setParam} />

            {params.hasDoors && (
              <div className="bg-surface-2 p-4 rounded-2xl border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <SELECT
                  label={t('door_type')}
                  name="doorType"
                  value={params.doorType}
                  onChange={setParam}
                  options={[
                    { value: 'hinged',  label: t('hinged') },
                    { value: 'sliding', label: t('sliding') },
                  ]}
                />
              </div>
            )}
          </fieldset>

          {/* ÔöÇÔöÇ Material ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">{t('material')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <SELECT
                label={t('thickness')}
                name="thickness"
                value={params.thickness}
                onChange={setParam}
                options={[
                  { value: 15, label: '15mm' },
                  { value: 18, label: t('thickness_default') },
                  { value: 25, label: '25mm' }
                ]}
              />
              <SELECT
                label={t('edge_banding')}
                name="edgeBandingType"
                value={params.edgeBandingType}
                onChange={setParam}
                options={[
                  { value: 'thin',  label: 'PVC 0.45mm' },
                  { value: 'thick', label: 'PVC/ABS 2mm' }
                ]}
              />
            </div>

            <TOGGLE label={t('baseboard')} name="baseboard" value={params.baseboard} onChange={setParam} />

            {params.baseboard && (
              <div className="bg-surface-2 p-3 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                <FIELD
                  label={t('baseboard_height')}
                  name="baseboardHeight"
                  value={params.baseboardHeight/m}
                  onChange={setDimParam}
                  min={60/m} max={150/m}
                  step={unit==='m'?0.001:1}
                  suffix={unit}
                />
              </div>
            )}
          </fieldset>
        </div>
      ) : (
        /* ÔöÇÔöÇ NL Mode ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <label htmlFor="nl-input" className="label">{t('describe_furniture')}</label>
          <textarea
            id="nl-input"
            className="input-field resize-none min-h-[12rem] text-sm leading-relaxed w-full focus-visible:ring-2 focus-visible:ring-primary focus:outline-none p-4"
            placeholder={t('nl_placeholder')}
            value={nlText}
            onChange={e => setNlText(e.target.value)}
          />
          <div className="flex items-start gap-2 bg-primary/5 p-3 rounded-xl border border-primary/10">
            <Zap size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted leading-normal">{t('nl_hint')}</p>
          </div>
        </div>
      )}

      {/* ÔöÇÔöÇ Actions ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="flex gap-3 pt-4 border-t border-white/5 mt-2">
        <button
          onClick={reset}
          className="p-3 bg-surface-3 hover:bg-surface-4 text-white rounded-xl transition-all border border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t('reset')}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || (mode === 'nl' && !nlText.trim())}
          className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest h-12 shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
          aria-busy={loading}
        >
          {loading
            ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" aria-hidden="true" /> {t('generating')}</>
            : <><Zap size={16} aria-hidden="true" /> {t('generate_project')}</>
          }
        </button>
      </div>
    </div>
  )
}

