/**
 * Orbin AI — Logo (fuente única de verdad de la marca en la app)
 * ADN: órbita (anillo R=33u, abierta a 45°) + nodo ámbar.
 *
 * variant:
 *   'isotipo'   → solo símbolo (default). Máximo reconocimiento.
 *   'app'       → símbolo sobre cuadro grafito redondeado (hero / app-icon).
 *   'imagotipo' → símbolo + "orbin" separados (uso general).
 *   'isologo'   → símbolo fundido como la "o" de "orbin" (compacto, indivisible).
 *   'logotipo'  → solo tipografía "orbin".
 * theme: 'light' (anillo tinta) | 'dark' (anillo hueso, para fondos oscuros).
 *
 * PURO/ADITIVO: sin estado, sin efectos, sin dependencias. No rompe nada.
 */

const INK = '#16181D'
const PAPER = '#F5F3EF'
const AMBER = '#F5A623'
const ARC = 'M82.15 42.58 A33 33 0 1 1 57.42 17.85'
const DOTLESS_I = 'ı'

export default function OrbinLogo({ variant = 'isotipo', theme = 'light', className = '', title = 'Orbin', ...rest }) {
  const ring = theme === 'dark' ? PAPER : INK
  const txt = theme === 'dark' ? PAPER : INK
  const common = { className, role: 'img', 'aria-label': title, xmlns: 'http://www.w3.org/2000/svg', ...rest }

  const iso = (
    <>
      <path d={ARC} fill="none" stroke={ring} strokeWidth="11" strokeLinecap="round" />
      <circle cx="73.3" cy="26.7" r="8.2" fill={AMBER} />
    </>
  )

  if (variant === 'app') {
    return (
      <svg viewBox="0 0 100 100" {...common}>
        <rect x="0" y="0" width="100" height="100" rx="22" fill={INK} />
        <g transform="translate(50 50) scale(0.82) translate(-50 -50)">
          <path d={ARC} fill="none" stroke={PAPER} strokeWidth="11" strokeLinecap="round" />
          <circle cx="73.3" cy="26.7" r="8.2" fill={AMBER} />
        </g>
      </svg>
    )
  }

  if (variant === 'logotipo') {
    return (
      <svg viewBox="0 0 300 170" {...common}>
        <text fontFamily="Poppins, Inter, sans-serif" fontWeight="600" fontSize="120" fill={txt}>
          <tspan x="8" y="125">o</tspan><tspan x="76.5">r</tspan><tspan x="118.5">b</tspan><tspan x="188.1">{DOTLESS_I}</tspan><tspan x="215.2">n</tspan>
        </text>
        <circle cx="204" cy="37" r="7" fill={AMBER} />
      </svg>
    )
  }

  if (variant === 'imagotipo') {
    return (
      <svg viewBox="0 0 470 150" {...common}>
        <g transform="translate(10 22) scale(1.06)">{iso}</g>
        <text fontFamily="Poppins, Inter, sans-serif" fontWeight="600" fontSize="95" fill={txt}>
          <tspan x="140" y="98">o</tspan><tspan x="194.4">r</tspan><tspan x="227.8">b</tspan><tspan x="283">{DOTLESS_I}</tspan><tspan x="304.6">n</tspan>
        </text>
        <circle cx="295" cy="29" r="6" fill={AMBER} />
      </svg>
    )
  }

  if (variant === 'isologo') {
    return (
      <svg viewBox="0 0 290 130" {...common}>
        <g transform="translate(3.45 23.45) scale(0.831)">{iso}</g>
        <text fontFamily="Poppins, Inter, sans-serif" fontWeight="600" fontSize="110" fill={txt}>
          <tspan x="74" y="95">r</tspan><tspan x="112.1">b</tspan><tspan x="175.5">{DOTLESS_I}</tspan><tspan x="200">n</tspan>
        </text>
        <circle cx="190" cy="15" r="6.5" fill={AMBER} />
      </svg>
    )
  }

  // isotipo (default)
  return (
    <svg viewBox="0 0 100 100" {...common}>{iso}</svg>
  )
}
