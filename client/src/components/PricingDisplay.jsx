/**
 * Orbin AI — PricingDisplay v1.0
 * ────────────────────────────────────────────────────────────────
 * Widget de cotización en tiempo real.
 * Posición: esquina superior izquierda (fixed overlay).
 * Animación CountUp tipo odómetro en cada cambio de precio.
 *
 * PROPS:
 *   modules  {Array}   - Array de módulos del estado de App.jsx
 *   margin   {number}  - Margen comercial override (opcional, 0–1)
 *   currency {string}  - 'USD' | 'BRL' | 'CLP' (default: 'USD')
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { calculateQuote, getLatestPriceUpdateDate } from '../engine/PricingEngine.js'
import { ChevronDown, ChevronUp, DollarSign, Package, Wrench, Layers } from 'lucide-react'
import { trackEvent, EVENTS } from '../lib/analytics.js'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ─── HOOK: CountUp animado ────────────────────────────────────────
/**
 * Anima un número desde el valor anterior al nuevo.
 * Usa requestAnimationFrame para máxima suavidad (60fps).
 *
 * @param {number} target  - Valor destino
 * @param {number} duration - ms de animación (default 600ms)
 */
function useCountUp(target, duration = 600) {
  const [display, setDisplay]   = useState(target)
  const prevRef                 = useRef(target)
  const frameRef                = useRef(null)
  const startRef                = useRef(null)

  useEffect(() => {
    const from = prevRef.current
    const to   = target

    if (from === to) return

    // Cancela cualquier animación previa
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    startRef.current = null

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed  = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing: easeOutExpo — se desacelera suavemente al final
      const eased = progress === 1
        ? 1
        : 1 - Math.pow(2, -10 * progress)

      setDisplay(from + (to - from) * eased)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = to
        setDisplay(to)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return display
}

// ─── FORMATEADOR ─────────────────────────────────────────────────
const CURRENCY_SYMBOLS = { USD: '$', BRL: 'R$', CLP: '$' }
const CURRENCY_LOCALES = { USD: 'en-US', BRL: 'pt-BR', CLP: 'es-CL' }

function formatPrice(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] || 'en-US', {
      style:    'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${CURRENCY_SYMBOLS[currency] || '$'}${Math.round(value).toLocaleString()}`
  }
}

// ─── FILA DE DETALLE ─────────────────────────────────────────────
function DetailRow({ label, value, currency, sub = false, highlight = false }) {
  const animated = useCountUp(value, 400)
  return (
    <div
      className={`flex justify-between items-center py-0.5 ${
        sub ? 'pl-3 text-xs text-muted' : 'text-sm'
      } ${highlight ? 'text-[#F5A623] font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span className={sub ? 'tabular-nums' : 'tabular-nums font-medium'}>
        {formatPrice(animated, currency)}
      </span>
    </div>
  )
}

// ─── CHIP DE HERRAJE ─────────────────────────────────────────────
function HardwareChip({ icon, label, qty, unit }) {
  if (!qty) return null
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded px-2 py-0.5 text-xs text-muted">
      {icon}
      <span className="tabular-nums text-white font-medium">{qty}</span>
      <span>{unit} {label}</span>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────
export default function PricingDisplay({ modules = [], margin, currency = 'USD' }) {
  const { t } = usePreferences()
  const [quote,    setQuote]    = useState(() => calculateQuote(modules, margin))
  const [expanded, setExpanded] = useState(false)
  const [flash,    setFlash]    = useState(false)
  const [updateDate, setUpdateDate] = useState(() => getLatestPriceUpdateDate())
  const prevPriceRef            = useRef(0)
  const dropdownRef             = useRef(null)

  // Listen for live-prices-loaded event from PricingEngine
  useEffect(() => {
    const handlePricesLoaded = () => {
      setUpdateDate(getLatestPriceUpdateDate())
      setQuote(calculateQuote(modules, margin))
    }

    window.addEventListener('live-prices-loaded', handlePricesLoaded)

    // In case prices loaded before mount
    const currentUpdateDate = getLatestPriceUpdateDate()
    if (currentUpdateDate && currentUpdateDate !== updateDate) {
      setUpdateDate(currentUpdateDate)
      setQuote(calculateQuote(modules, margin))
    }

    return () => {
      window.removeEventListener('live-prices-loaded', handlePricesLoaded)
    }
  }, [modules, margin, updateDate])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Analytics tracking when expanded
  useEffect(() => {
    if (expanded) {
      trackEvent(EVENTS.PRICING_MODAL_VIEWED, { currency });
    }
  }, [expanded, currency])

  // Recalcula cotización cuando cambian los módulos
  useEffect(() => {
    const newQuote = calculateQuote(modules, margin)
    setQuote(newQuote)

    // Dispara flash visual si el precio cambió
    if (newQuote.finalPrice !== prevPriceRef.current) {
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
      prevPriceRef.current = newQuote.finalPrice
    }
  }, [modules, margin])

  // Animación CountUp del precio principal
  const animatedPrice = useCountUp(quote.finalPrice, 700)

  // No renderiza si no hay módulos
  if (!modules || modules.length === 0) return null

  return (
    <div className="relative select-none flex items-center" ref={dropdownRef}>
      {/* Trigger Button inside Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`
          flex items-center gap-2 px-3 py-1.5 bg-surface-3/60 border rounded-xl hover:bg-surface-3 transition-all cursor-pointer select-none
          ${flash ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-500/5' : 'border-white/5 hover:border-primary/30'}
        `}
      >
        {/* Ícono */}
        <div className={`
          w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0
          ${flash ? 'bg-amber-500/20 animate-pulse' : 'bg-amber-500/10'}
        `}>
          <DollarSign size={12} className="text-amber-500" />
        </div>

        {/* Precio animado */}
        <span className="text-xs font-mono text-amber-500 font-bold leading-none tabular-nums">
          {formatPrice(animatedPrice, currency)}
        </span>

        {/* Módulos Count Badge */}
        <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider scale-90 shrink-0">
          {quote.moduleCount} {quote.moduleCount !== 1 ? t('pd_mods') : t('pd_mod')}
        </span>

        {/* Toggle expand */}
        <ChevronDown size={12} className={`text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Desglose expandible en formato Dropdown absoluto ───────────────────────────── */}
      {expanded && (
        <div
          className="absolute right-0 top-full mt-2 w-64 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-3 space-y-2 text-white z-[200] animate-in zoom-in-95 duration-200"
        >
          {/* Materiales */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest mb-1">
              <Layers size={10} />
              {t('pd_materials')} — {quote.totalMaterialM2} m²
            </div>
            {quote.materials.map(m => (
              <DetailRow
                key={m.id}
                label={`${m.name} (${m.m2}m²)`}
                value={m.cost}
                currency={currency}
                sub
              />
            ))}
          </div>

          {/* Herrajes */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest mb-1">
              <Wrench size={10} />
              {t('pd_hardware')}
            </div>
            <div className="flex flex-wrap gap-1 mb-1">
              <HardwareChip
                label={t('pd_hinges')}
                qty={quote.hardware.hinges.qty}
                unit={t('pd_un')}
              />
              <HardwareChip
                label={t('pd_slides')}
                qty={quote.hardware.drawerSlides.qty}
                unit={t('pd_par')}
              />
              <HardwareChip
                label={t('pd_handles')}
                qty={quote.hardware.handles.qty}
                unit={t('pd_un')}
              />
            </div>
            <DetailRow
              label={t('pd_hardware_total')}
              value={quote.hardware.total}
              currency={currency}
              sub
            />
          </div>

          {/* Mano de obra */}
          <DetailRow
            label={t('pd_labor')}
            value={quote.labor}
            currency={currency}
            sub
          />

          {/* Overhead */}
          <DetailRow
            label={t('pd_overhead')}
            value={quote.overhead}
            currency={currency}
            sub
          />

          {/* Divisor */}
          <div className="border-t border-white/8" />

          {/* Subtotal y margen */}
          <DetailRow label={t('pd_base_cost')}        value={quote.subtotal}     currency={currency} />
          <DetailRow
            label={`${t('pd_margin')} (${Math.round(quote.marginRate * 100)}%)`}
            value={quote.marginAmount}
            currency={currency}
            sub
          />

          {/* Total final destacado */}
          <div
            className="flex justify-between items-center pt-1 border-t border-[#F5A623]/20 mt-1"
          >
            <span className="text-sm font-bold text-white">{t('pd_sale_price')}</span>
            <span className="text-base font-mono text-amber-500 font-bold tabular-nums">
              {formatPrice(quote.finalPrice, currency)}
            </span>
          </div>

          {/* Encimera si aplica */}
          {quote.hardware.countertop.m2 > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted mt-1">
              <Package size={10} />
              {t('pd_countertop_incl')}: {quote.hardware.countertop.m2} m²
            </div>
          )}

          {/* Badge de precios actualizados */}
          {updateDate && (
            <div className="text-[9px] text-zinc-500 text-center pt-2 border-t border-zinc-800/55 mt-2 select-none">
              {t('pd_prices_updated')}: {updateDate}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
