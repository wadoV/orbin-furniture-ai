import { useState, useEffect, lazy, Suspense } from 'react'
import Header from './components/Header.jsx'
import InputPanel from './components/InputPanel.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ProjectsPanel from './components/ProjectsPanel.jsx'
import CarpentryAdvisor from './components/CarpentryAdvisor.jsx'
import { api } from './api/client.js'
import { Sliders, MessageSquare, FolderOpen, Box, Loader, Bot, RotateCcw, RotateCw } from 'lucide-react'

import { usePreferences } from './context/PreferencesContext.jsx'

// Lazy-load 3D viewer (Three.js is large)
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'))

export default function App() {
  const { t } = usePreferences()
  const [activeTab, setActiveTab] = useState('params')
  const [loading,   setLoading]   = useState(false)
  const [modules,   setModules]   = useState([])
  const [history,   setHistory]   = useState([]) // Stack of previous modules states
  const [redoStack, setRedoStack] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [selectedPieceIds, setSelectedPieceIds] = useState(new Set())
  const [error,     setError]     = useState(null)
  const [show3D,    setShow3D]    = useState(true)
  const [showUndoToast, setShowUndoToast] = useState(false)

  const TABS = [
    { id: 'params', label: t('tab_parameters'), icon: Sliders },
    { id: 'chat',   label: t('tab_chat'),    icon: MessageSquare },
    { id: 'saved',  label: t('tab_projects'),   icon: FolderOpen },
  ]

  const saveHistory = (newModules) => {
    setHistory(prev => [...prev, modules].slice(-20)) // Keep last 20 steps
    setRedoStack([])
    setModules(newModules)
  }

  const handleGenerate = async (payload) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateDesign(payload)
      if (data?.design) {
        const newModule = { ...data.design, id: data.design.id || `MOD-${Date.now()}` }
        saveHistory([...modules, newModule])
        setSelectedModuleId(newModule.id)
        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server.')
    } finally {
      setLoading(false)
    }
  }

  const handleChatDesign = ({ design }) => {
    const newModule = { ...design, id: design.id || `MOD-${Date.now()}` }
    saveHistory([...modules, newModule])
    setSelectedModuleId(newModule.id)
    setActiveTab('viewer')
  }

  const handleUpdateModule = (id, newConfig) => {
    saveHistory(modules.map(m => m.id === id ? { ...m, configuration: { ...m.configuration, ...newConfig } } : m))
  }

  const handleDeleteModule = (id) => {
    const target = modules.find(m => m.id === id)
    if (!target) return
    
    saveHistory(modules.filter(m => m.id !== id))
    setShowUndoToast(true)
    setTimeout(() => setShowUndoToast(false), 5000)
    
    if (selectedModuleId === id) {
      setSelectedModuleId(null)
      setSelectedPieceIds(new Set())
    }
  }

  const undo = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setRedoStack(rs => [...rs, modules])
    setHistory(h => h.slice(0, -1))
    setModules(prev)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setHistory(h => [...h, modules])
    setRedoStack(rs => rs.slice(0, -1))
    setModules(next)
  }

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      
      // Ctrl+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput) return;
        e.preventDefault();
        undo();
      }
      
      // Ctrl+Y or Ctrl+Shift+Z (Redo)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        if (isInput) return;
        e.preventDefault();
        redo();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        if (selectedPieceIds.size > 0) {
          setSelectedPieceIds(new Set());
        } else if (selectedModuleId) {
          handleDeleteModule(selectedModuleId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modules, history, redoStack, selectedModuleId, selectedPieceIds]);

  const currentResult = modules.find(m => m.id === selectedModuleId)

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">

          {/* ── Left column ─────────────────────────────────────────── */}
          <aside className="xl:sticky xl:top-20 xl:self-start space-y-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1 pb-4 scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">

            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {t('title').split('—')[0]}<br />
                <span className="text-primary">— {t('title').split('—')[1]}</span>
              </h1>
            </div>

            <div className="flex gap-1 bg-surface-3 p-1 rounded-lg" role="tablist">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all
                    ${activeTab === id ? 'bg-primary text-black shadow-sm' : 'text-muted hover:text-white hover:bg-surface-2'}`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`}>
              {activeTab === 'params' && (
                <>
                  <InputPanel 
                    onGenerate={handleGenerate} 
                    loading={loading} 
                    currentConfig={currentResult?.configuration}
                    onUpdateConfig={(newConfig) => handleUpdateModule(selectedModuleId, newConfig)}
                  />
                  {error && (
                    <div className="mt-4 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger" role="alert">
                      ⚠ {error}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'chat' && (
                <ChatPanel onDesignGenerated={handleChatDesign} />
              )}

              {activeTab === 'saved' && (
                <ProjectsPanel
                  modules={modules}
                  onLoadDesign={(data) => {
                    if (data.modules) setModules(data.modules)
                    else if (data.design) setModules([data.design])
                  }}
                />
              )}
            </div>

            {/* Always show advisor if a module is selected */}
            {currentResult && <CarpentryAdvisor design={currentResult} />}
          </aside>

          {/* ── Right column ────────────────────────────────────────── */}
          <section className="space-y-5 min-w-0">

            {/* 3D Viewer Container */}
            <div className="card p-0 overflow-hidden relative">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2 text-sm">
                  <Box size={14} className="text-primary" /> {t('d_view')}
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-muted uppercase tracking-widest">{modules.length} Módulos</span>
                  <div className="w-[1px] h-4 bg-white/10" />
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={undo} 
                      disabled={history.length === 0}
                      className={`p-1.5 rounded-md transition-all ${history.length > 0 ? 'text-white hover:bg-surface-3' : 'text-muted opacity-30 cursor-not-allowed'}`}
                      title="Desfazer (Ctrl+Z)"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button 
                      onClick={redo} 
                      disabled={redoStack.length === 0}
                      className={`p-1.5 rounded-md transition-all ${redoStack.length > 0 ? 'text-white hover:bg-surface-3' : 'text-muted opacity-30 cursor-not-allowed'}`}
                      title="Refazer (Ctrl+Y)"
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="h-[520px] relative">
                <Suspense fallback={
                  <div className="h-full flex items-center justify-center text-muted gap-2">
                    <Loader size={16} className="animate-spin" /> ...
                  </div>
                }>
                  <Viewer3D 
                    designs={modules} 
                    selectedModuleId={selectedModuleId}
                    selectedPieceIds={selectedPieceIds}
                    onSelectModule={(id) => {
                      setSelectedModuleId(id)
                      if (!id) setSelectedPieceIds(new Set())
                    }}
                    onSelectPieces={setSelectedPieceIds}
                    onDeleteModule={handleDeleteModule}
                  />
                </Suspense>
              </div>
            </div>

            {/* Results Section */}
            <div id="results">
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted">
                  <div className="w-10 h-10 border-2 border-border border-t-primary rounded-full animate-spin" />
                  <p className="text-sm">{t('generating')}</p>
                </div>
              )}

              {!loading && modules.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center card">
                  <span className="text-6xl opacity-20">🪵</span>
                  <p className="text-muted text-sm max-w-[200px]">Comece descrevendo um móvel no painel ao lado para iniciar seu projeto modular.</p>
                </div>
              )}

              {!loading && currentResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-6 bg-primary rounded-full"></span>
                      Módulo: <span className="text-primary">{currentResult.id}</span>
                    </h2>
                    <button 
                      onClick={() => handleDeleteModule(currentResult.id)}
                      className="btn-danger flex items-center gap-2 text-xs py-1.5 px-3"
                    >
                      Eliminar Módulo
                    </button>
                  </div>
                  <ResultPanel 
                    result={{ design: currentResult }} 
                    selectedPieceIds={selectedPieceIds}
                    onUpdateConfig={(newConfig) => handleUpdateModule(currentResult.id, newConfig)}
                  />
                </div>
              )}

              {!loading && !selectedModuleId && modules.length > 0 && (
                <div className="card p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2 border-border opacity-60">
                  <div className="p-4 bg-surface-3 rounded-full">
                    <Bot size={32} className="text-muted" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Ningún módulo seleccionado</h3>
                    <p className="text-muted text-sm max-w-xs mx-auto">Haz clic en un módulo en el visor 3D para ver sus detalles técnicos.</p>
                  </div>
                </div>
              )}
            </div>

          </section>
        </div>
      </main>

      {/* Undo Toast */}
      {showUndoToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-surface/90 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
            <span className="text-sm text-white font-medium">Módulo removido</span>
            <button 
              onClick={() => { undo(); setShowUndoToast(false); }}
              className="text-xs font-bold text-primary uppercase tracking-widest hover:underline"
            >
              Desfazer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
