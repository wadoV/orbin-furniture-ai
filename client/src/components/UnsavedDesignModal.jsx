/**
 * Orbin AI — Unsaved Design Modal  (ADITIVO 2026-10-11)
 * ─────────────────────────────────────────────────────────────────────────────
 * Se dispara cada vez que el usuario pide empezar un diseño nuevo (desde la
 * pantalla de bienvenida o desde el botón "Nuevo Diseño" del visor 3D) mientras
 * hay módulos sin guardar en el lienzo actual.
 *
 * Antes de esto, `orbin-autosave` restauraba silenciosamente el último proyecto
 * en cada apertura de sesión — el usuario nunca veía una pregunta explícita de
 * "¿guardar o descartar?". Este modal cierra ese hueco de producto.
 *
 * El guardado real pasa por POST /api/projects/save, que ahora exige que el
 * diseño sea VALIDADO (ver server/src/routes/projects.js) — si el servidor
 * rechaza por errores estructurales, se muestra el detalle aquí y el usuario
 * puede optar por descartar en vez de perder tiempo reintentando un guardado
 * que nunca va a pasar.
 */

import { Save, Trash2, X, Loader2, AlertTriangle } from 'lucide-react'

export default function UnsavedDesignModal({
  open,
  moduleCount = 0,
  saving = false,
  error = null,
  onSave,
  onDiscard,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111113] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border border-white/10">
        <button
          onClick={onCancel}
          disabled={saving}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-7 space-y-5">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>

          <div>
            <h2 className="text-lg font-black text-white mb-1.5">Tenés un diseño sin guardar</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Hay {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'} en el lienzo actual que todavía no
              están en tu galería. Si empezás un diseño nuevo sin guardarlo, se pierde.
            </p>
          </div>

          {error && (
            <p className="text-[12px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5 whitespace-pre-line">
              {error}
            </p>
          )}

          <div className="space-y-2.5">
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-black font-bold py-3 px-4 rounded-xl transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando…' : 'Guardar y continuar'}
            </button>
            <button
              onClick={onDiscard}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-danger/10 hover:bg-danger/20 disabled:opacity-60 text-danger font-bold py-3 px-4 rounded-xl transition-all border border-danger/20"
            >
              <Trash2 className="w-4 h-4" />
              Descartar y empezar de nuevo
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="w-full text-center text-zinc-400 hover:text-white text-sm font-semibold py-2 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
