import { useState, useEffect, useMemo } from 'react'
import { LayoutGrid, Filter, Search, Copy, Check, X, PackageOpen, Loader2, ShieldCheck, Hammer, AlertTriangle, Trash2 } from 'lucide-react'
// (X ya estaba importado; se reutiliza para el botón cancelar de la confirmación inline)
import { WORKSHOP_TEMPLATES, auditWorkshopTemplate } from '../data/workshopTemplates.js'
import { api } from '../api/client.js'
import { listViable, removeViable } from '../api/viableStore.js'
import { DEMO_MODE } from '../config/demoMode.js'
import { GALLERY_CATEGORIES, CATEGORY_LABELS } from '../data/galleryCategories.js'

/**
 * GalleryCatalog — Verified Templates Catalog (Fase 1).
 * Overlay charcoal que lista la biblioteca `viable_designs` (solo diseños
 * VALIDADO) con búsqueda por nombre + filtro por categoría, y expone el
 * pipeline Copiar (Ctrl+C → portapapeles) / Usar (hidrata el workspace).
 *
 * Props:
 *   onClose()            — cierra el overlay.
 *   onUseTemplate(params)— inyecta los params en el workspace (dispara generateProject).
 *   onLoadWorkshopTemplate(id) — ★ 2026-10-10: carga una plantilla de TALLER (despiece
 *                          literal, sin motor) en el visor. Local: no depende de Supabase.
 */
export default function GalleryCatalog({ onClose, onUseTemplate, onLoadWorkshopTemplate }) {
  const workshop = useMemo(() => WORKSHOP_TEMPLATES.filter(t => t.viewerReady).map(t => ({ t, audit: auditWorkshopTemplate(t) })), [])
  const [openAudit, setOpenAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [designs, setDesigns] = useState([])
  const [search, setSearch]   = useState('')
  const [activeCat, setActiveCat] = useState('todos')
  const [copiedId, setCopiedId]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)   // tarjeta en estado "¿eliminar?"

  useEffect(() => {
    let alive = true
    // ★ 2026-10-10 (piloto): la fuente es viableStore — en DEMO_MODE lee localStorage
    //   (offline-first, sin 503), en producción el server con fallback local. Así los
    //   diseños guardados desde el visor 3D aparecen aquí sin depender de Supabase.
    ;(async () => {
      try {
        const list = await listViable()
        if (alive) setDesigns(Array.isArray(list) ? list : [])
      } catch (err) {
        if (alive) setError(err?.message || 'No pudimos cargar la Galería.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Eliminación reactiva en DOS PASOS (confirmación inline, sin window.confirm nativo
  // que rompe la coherencia visual y bloquea la automatización). Quita la tarjeta al
  // instante (optimista) y revierte si el backend rechaza el borrado.
  async function doDelete(d) {
    setConfirmingId(null)
    setDeletingId(d.id)
    const prev = designs
    setDesigns(cur => cur.filter(x => x.id !== d.id))
    try {
      await removeViable(d.id)
    } catch (err) {
      setDesigns(prev)   // revertir si el backend rechaza el borrado
      setError(err?.message || 'No pudimos eliminar el diseño.')
    } finally {
      setDeletingId(null)
    }
  }

  // Escape para cerrar (mismo patrón que los modales del Header)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return designs.filter(d => {
      const matchCat = activeCat === 'todos' || d.category === activeCat
      const matchQ   = !q || (d.design_name || '').toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [designs, search, activeCat])

  async function handleCopy(design) {
    const params = design?.parametric_json
    if (!params) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(params))
      setCopiedId(design.id)
      setTimeout(() => setCopiedId(c => (c === design.id ? null : c)), 1600)
    } catch {
      // Clipboard API bloqueada (contexto no seguro / permisos) — degradar a "Usar".
      setCopiedId(null)
    }
  }

  const CHIPS = [{ value: 'todos', label: 'Todos' }, ...GALLERY_CATEGORIES]

  return (
    <div
      className="fixed inset-0 z-[340] flex items-start justify-center bg-black/75 backdrop-blur-md overflow-y-auto py-6 sm:py-10"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
        className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-5xl mx-4 shadow-2xl relative overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <LayoutGrid size={18} className="text-primary" aria-hidden="true" />
            <h2 id="gallery-title" className="text-sm font-black text-white uppercase tracking-widest">
              {'Galería'} <span className="text-muted font-bold normal-case tracking-normal text-[11px]">· Plantillas verificadas</span>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar galería" className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: búsqueda + chips de categoría */}
        <div className="px-5 sm:px-6 py-4 space-y-3 border-b border-white/5">
          <div className="flex items-center gap-2 bg-surface-3/50 px-3 py-2 rounded-xl border border-white/5 focus-within:border-primary/30 transition-colors">
            <Search size={14} className="text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
              className="flex-1 bg-transparent text-white text-[12px] font-medium placeholder:text-muted/50 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={12} className="text-muted shrink-0" />
            {CHIPS.map(c => (
              <button
                key={c.value}
                onClick={() => setActiveCat(c.value)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                  activeCat === c.value
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface-3/40 text-muted border-white/5 hover:text-white hover:border-white/15'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="px-5 sm:px-6 py-5 min-h-[240px] max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
          {/* ★ 2026-10-10 — Plantillas de TALLER (despiece literal del jefe de taller) */}
          {typeof onLoadWorkshopTemplate === 'function' && workshop.length > 0 && (
            <section className="mb-6">
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary mb-3">
                <Hammer size={13} /> Plantillas de taller · despiece real
              </h3>
              <div className="grid gap-3">
                {workshop.map(({ t, audit }) => {
                  const obs = audit.findings.filter(f => f.level !== 'info' || f.code !== 'NOT_ENGINE_READY')
                  const nPieces = (t.cutList || []).reduce((n, p) => n + (p.qty || 0), 0)
                  return (
                    <div key={t.id} className="p-4 rounded-2xl border border-primary/25 bg-primary/5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-black text-white">{t.name}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {t.declared?.overall ? `${t.declared.overall.width} × ${t.declared.overall.height} × ${t.declared.overall.depth} mm · ` : ''}
                            {(t.layout || []).length} módulos · {nPieces} piezas · {t.source}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLoadWorkshopTemplate(t.id)}
                          className="shrink-0 px-4 py-2 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                        >
                          Cargar en el visor
                        </button>
                      </div>
                      {/* Badge profesional de fabricación — las observaciones del taller son
                          preguntas al jefe de obra, NO errores del software. Se muestran
                          colapsadas para consulta técnica, sin alarma visual. */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/10 text-sky-300 text-[9px] font-black uppercase tracking-widest border border-sky-400/20">
                          <Hammer size={10} /> Plantilla en fabricación · Taller Brasil
                        </span>
                        {obs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenAudit(o => (o === t.id ? null : t.id))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-muted/70 text-[9px] font-bold border border-white/5 hover:text-white/80 hover:border-white/15 transition-all"
                          >
                            {obs.length} notas técnicas {openAudit === t.id ? '▴' : '▾'}
                          </button>
                        )}
                      </div>
                      {openAudit === t.id && obs.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {obs.map(f => (
                            <li key={f.code} className={`text-[11px] leading-snug pl-3 border-l-2 ${f.level === 'error' ? 'border-sky-400/60 text-sky-200/80' : f.level === 'warn' ? 'border-white/15 text-muted/80' : 'border-white/10 text-muted/60'}`}>
                              {f.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-widest">Cargando plantillas…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-[11px] font-black text-error uppercase tracking-widest">Error</p>
              <p className="text-[11px] text-muted/70 max-w-sm">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted text-center">
              <PackageOpen size={30} className="opacity-30" />
              <p className="text-[11px] font-bold uppercase tracking-widest">
                {designs.length === 0 ? 'Aún no hay plantillas verificadas' : 'Sin resultados para este filtro'}
              </p>
              {designs.length === 0 && (
                <p className="text-[10px] text-muted/60 max-w-xs">
                  Guardá un diseño VALIDADO con “Guardar como Diseño Viable” para poblarla.
                </p>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(d => {
                const p = d.parametric_json || {}
                const copied = copiedId === d.id
                return (
                  <div
                    key={d.id}
                    className="group flex flex-col gap-3 p-4 rounded-2xl bg-surface-3/40 border border-white/5 hover:border-primary/25 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[12px] font-black text-white leading-tight tracking-tight line-clamp-2">{d.design_name}</h3>
                      <ShieldCheck size={14} className="text-emerald-400/80 shrink-0 mt-0.5" aria-label="Verificado" />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/20">
                        {CATEGORY_LABELS[d.category] || 'Sin clasificar'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-muted text-[8px] font-black uppercase tracking-widest border border-white/5">
                        {d.module_type}
                      </span>
                    </div>

                    <p className="text-[10px] font-mono font-bold text-muted tracking-tight">
                      {(p.width ?? '—')} × {(p.height ?? '—')} × {(p.depth ?? '—')} <span className="text-muted/50">mm</span>
                    </p>

                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <button
                        onClick={() => handleCopy(d)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                          copied
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                            : 'bg-white/5 text-white/70 border-white/5 hover:text-white hover:border-white/15'
                        }`}
                        title="Copiar diseño (Ctrl+C) — pegalo con Ctrl+V en el lienzo"
                      >
                        {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                      </button>
                      {typeof onUseTemplate === 'function' && (
                        <button
                          onClick={() => onUseTemplate(p)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all"
                          title="Cargar esta plantilla en el lienzo"
                        >
                          Usar
                        </button>
                      )}
                      {/* ★ 2026-10-10: eliminar de la Galería — confirmación inline (2 pasos) + remoción reactiva */}
                      {confirmingId === d.id ? (
                        <>
                          <button
                            onClick={() => doDelete(d)}
                            disabled={deletingId === d.id}
                            className="shrink-0 flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border bg-rose-500/15 text-rose-300 border-rose-400/40 hover:bg-rose-500/25 transition-all text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                            title="Confirmar eliminación"
                            aria-label={`Confirmar eliminar ${d.design_name}`}
                          >
                            {deletingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={11} /> Sí</>}
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            disabled={deletingId === d.id}
                            className="shrink-0 flex items-center justify-center w-9 py-2 rounded-lg border bg-white/5 text-white/60 border-white/5 hover:text-white transition-all disabled:opacity-40"
                            title="Cancelar"
                            aria-label="Cancelar eliminación"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(d.id)}
                          className="shrink-0 flex items-center justify-center w-9 py-2 rounded-lg border bg-white/5 text-rose-300/70 border-white/5 hover:text-rose-300 hover:border-rose-400/40 hover:bg-rose-500/10 transition-all"
                          title="Eliminar de la Galería"
                          aria-label={`Eliminar ${d.design_name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && !error && (
          <div className="px-5 sm:px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest">
              {filtered.length} / {designs.length} plantilla{designs.length === 1 ? '' : 's'}
            </p>
            <p className="text-[9px] text-muted/50 font-medium hidden sm:block">Copiar → Ctrl+V en el lienzo</p>
          </div>
        )}
      </div>
    </div>
  )
}
