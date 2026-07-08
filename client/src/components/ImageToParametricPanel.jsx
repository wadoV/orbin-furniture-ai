import React, { useState, useRef } from 'react'
import { UploadCloud, Camera, Wand2, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../api/client'
import { usePreferences } from '../context/PreferencesContext'

export default function ImageToParametricPanel({ onApplyDesign }) {
  const { t } = usePreferences()
  const [image, setImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona un archivo de imagen válido.')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit on frontend
      setError('La imagen no debe superar los 10MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setImage(e.target.result)
      setPreviewUrl(e.target.result)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    if (!image) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.analyzeSpace(
        image,
        prompt || 'Analiza este espacio y sugiere una configuración de mueble adecuada.'
      )

      if (response.success && response.analysis) {
        onApplyDesign(response.analysis)
      } else {
        throw new Error(response.error || 'Error desconocido al analizar la imagen.')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'No se pudo conectar con el servidor de IA Visión.')
    } finally {
      setLoading(false)
    }
  }

  const resetImage = () => {
    setImage(null)
    setPreviewUrl(null)
    setPrompt('')
    setError(null)
  }

  return (
    <div className="flex flex-col h-full bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-surface-2 flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
          <Camera size={20} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">AI Spatial Architect</h2>
          <p className="text-xs text-muted">Sube una foto de tu espacio para generar un diseño paramétrico.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {error && (
          <div className="flex gap-2 items-start p-3 bg-red-500/10 text-red-400 text-xs rounded-lg border border-red-500/20">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!previewUrl ? (
          <div 
            className="flex-1 min-h-[200px] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center p-6 text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileSelect}
            />
            <UploadCloud size={40} className="text-muted mb-3" />
            <p className="text-sm text-white font-medium mb-1">Haz clic o arrastra una imagen</p>
            <p className="text-xs text-muted max-w-[200px]">Formatos: JPG, PNG, WebP (Máx 10MB)</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black">
              <img src={previewUrl} alt="Space Preview" className="w-full h-auto max-h-[300px] object-contain" />
              {!loading && (
                <button 
                  onClick={resetImage}
                  className="absolute top-2 right-2 bg-black/60 backdrop-blur text-xs text-white px-2 py-1 rounded hover:bg-red-500/80 transition"
                >
                  Cambiar foto
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wider">
                Instrucción (Opcional)
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: Quiero un mueble de TV que ocupe toda la pared"
                className="w-full bg-surface-2 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 transition-colors"
                disabled={loading}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-surface-2">
        <button
          onClick={handleAnalyze}
          disabled={!image || loading}
          className="w-full relative overflow-hidden group flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-white/10"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Analizando espacio...</span>
            </>
          ) : (
            <>
              <Wand2 size={16} />
              <span>Generar Diseño Paramétrico</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
