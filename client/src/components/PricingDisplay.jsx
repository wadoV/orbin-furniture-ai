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
import { calculateQuote } from '../engine/PricingEngine.js'
import { ChevronDown, ChevronUp, DollarSign, Package, Wrench, Layers } from 'lucide-react'

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
  const [quote,    setQuote]    = useState(() => calculateQuote(modules, margin))
  const [expanded, setExpanded] = useState(false)
  const [flash,    setFlash]    = useState(false)
  const prevPriceRef            = useRef(0)

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
    <div
      style={{
        position:   'fixed',
        top:        '72px',   // debajo del Header
        left:       '12px',
        zIndex:     500,
        minWidth:   '240px',
        maxWidth:   '300px',
      }}
      className="select-none"
    >
      {/* ── Tarjeta principal ─────────────────────────────────── */}
      <div
        className={`
          rounded-xl border backdrop-blur-md transition-all duration-300
          ${flash
            ? 'border-[#F5A623]/60 shadow-lg shadow-[#F5A623]/10'
            : 'border-white/10 shadow-lg shadow-black/40'
          }
        `}
        style={{ background: 'rgba(15,15,18,0.88)' }}
      >
        {/* Header del widget */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/4 rounded-t-xl transition-colors"
        >
          {/* Ícono con pulso si flash */}
          <div className={`
            w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
            ${flash ? 'bg-[#F5A623]/20 animate-pulse' : 'bg-[#F5A623]/10'}
          `}>
            <DollarSign size={14} className="text-[#F5A623]" />
          </div>

          {/* Precio animado */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-muted uppercase tracking-widest leading-none mb-0.5">
              Cotización · {quote.moduleCount} módulo{quote.moduleCount !== 1 ? 's' : ''}
            </div>
            <div
              className={`
                text-lg font-bold tabular-nums leading-none transition-colors duration-300
                ${flash ? 'text-[#F5A623]' : 'text-white'}
              `}
            >
              {formatPrice(animatedPrice, currency)}
            </div>
          </div>

          {/* Toggle expand */}
          <div className="text-muted">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* ── Desglose expandible ───────────────────────────── */}
        <div
          className={`
            overflow-hidden transition-all duration-300 ease-in-out
            ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="px-3 pb-3 space-y-2">
            {/* Divisor */}
            <div className="border-t border-white/8" />

            {/* Materiales */}
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest mb-1">
                <Layers size={10} />
                Materiales — {quote.totalMaterialM2} m²
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
                Herrajes
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                <HardwareChip
                  label="Bisagras"
                  qty={quote.hardware.hinges.qty}
                  unit="un"
                />
                <HardwareChip
                  label="Correderas"
                  qty={quote.hardware.drawerSlides.qty}
                  unit="par"
                />
                <HardwareChip
                  label="Manijas"
                  qty={quote.hardware.handles.qty}
                  unit="un"
                />
              </div>
              <DetailRow
                label="Total herrajes"
                value={quote.hardware.total}
                currency={currency}
                sub
              />
            </div>

            {/* Mano de obra */}
            <DetailRow
              label="Mano de obra"
              value={quote.labor}
              currency={currency}
              sub
            />

            {/* Overhead */}
            <DetailRow
              label="Overhead (12%)"
              value={quote.overhead}
              currency={currency}
              sub
            />

            {/* Divisor */}
            <div className="border-t border-white/8" />

            {/* Subtotal y margen */}
            <DetailRow label="Costo base"        value={quote.subtotal}     currency={currency} />
            <DetailRow
              label={`Margen (${Math.round(quote.marginRate * 100)}%)`}
              value={quote.marginAmount}
              currency={currency}
              sub
            />

            {/* Total final destacado */}
            <div
              className="flex justify-between items-center pt-1 border-t border-[#F5A623]/20 mt-1"
            >
              <span className="text-sm font-bold text-white">PRECIO VENTA</span>
              <span className="text-base font-bold text-[#F5A623] tabular-nums">
                {formatPrice(quote.finalPrice, currency)}
              </span>
            </div>

            {/* Encimera si aplica */}
            {quote.hardware.countertop.m2 > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted mt-1">
                <Package size={10} />
                Encimera incluida: {quote.hardware.countertop.m2} m²
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
