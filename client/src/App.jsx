import { useState, useEffect, Suspense, Component } from 'react'
import Header from './components/Header.jsx'
import InputPanel from './components/InputPanel.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ProjectsPanel from './components/ProjectsPanel.jsx'
import CarpentryAdvisor from './components/CarpentryAdvisor.jsx'
import Viewer3D from './components/Viewer3D.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import { api } from './api/client.js'
import { Sliders, MessageSquare, FolderOpen, Box, RotateCcw } from 'lucide-react'

import { usePreferences } from './context/PreferencesContext.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6 card border-danger/20">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto">
              <Box size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-white text-xl font-bold tracking-tight">Error en el Motor Visual</h2>
              <p className="text-muted text-sm leading-relaxed">
                {this.state.error?.message || 'Algo salió mal durante el renderizado 3D.'}
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full h-12 text-sm font-bold uppercase tracking-widest"
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { t } = usePreferences()
  const [activeTab, setActiveTab] = useState('params')
  const [loading,   setLoading]   = useState(false)
  const [modules,   setModules]   = useState([])
  const [history,   setHistory]   = useState([]) 
  const [redoStack, setRedoStack] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [selectedPieceIds, setSelectedPieceIds] = useState(new Set())
  const [error,     setError]     = useState(null)
  const [show3D,    setShow3D]    = useState(true)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  const TABS = [
    { id: 'params', label: t('tab_parameters'), icon: Sliders },
    { id: 'chat',   label: t('tab_chat'),    icon: MessageSquare },
    { id: 'saved',  label: t('tab_projects'),   icon: FolderOpen },
  ]

  const saveHistory = (newModules) => {
    setHistory(prev => [...prev, modules].slice(-20))
    setRedoStack([])
    setModules(newModules)
  }

  const handleGenerate = async (payload) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateDesign(payload)
      const design = data?.design || (data?.modules && data.modules[0])
      
      if (design && design.pieces) {
        const newModule = { ...design, id: design.id || `MOD-${Date.now()}` }
        saveHistory([...modules, newModule])
        setSelectedModuleId(newModule.id)
        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 100)
      } else if (data?.error) {
        setError(data.error)
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
    setActiveTab('params')
  }

  const handleSendMessage = async (text) => {
    if (!text.trim() || chatLoading) return
    setChatLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: text }])
    
    try {
      // Use a consistent session ID or derive one
      const data = await api.chatDesign(text, 'default-session')
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      
      if (data.design) {
        handleChatDesign({ design: data.design })
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleUpdateModule = (id, newConfig) => {
    if (!id) return;
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput) return;
        e.preventDefault();
        undo();
      }
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

  const currentResult = (modules || []).find(m => m.id === selectedModuleId)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0D0D0D]">
        <Header />

        <main className="max-w-screen-2xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6">

            <aside className="xl:sticky xl:top-20 xl:self-start space-y-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1 pb-4 scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">
                  {(t('title') || '').split('—')[0]}<br />
                  <span className="text-primary">— {(t('title') || '').split('—')[1]}</span>
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
                  <ChatPanel 
                    messages={chatMessages} 
                    onSendMessage={handleSendMessage} 
                    loading={chatLoading} 
                  />
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
              {currentResult && <CarpentryAdvisor design={currentResult} />}
              {currentResult && <ExportPanel design={currentResult} />}
            </aside>

            <div className="space-y-6">
              <div className="card p-0 overflow-hidden border-primary/10 shadow-2xl shadow-primary/5 min-h-[600px] relative">
                {show3D ? (
                  <Viewer3D 
                    designs={modules}
                    selectedModuleId={selectedModuleId}
                    selectedPieceIds={selectedPieceIds}
                    onSelectModule={setSelectedModuleId}
                    onSelectPieces={setSelectedPieceIds}
                    onDeleteModule={handleDeleteModule}
                    onAddModule={() => {
                      setActiveTab('params')
                      setTimeout(() => document.getElementById('panel-params')?.scrollIntoView({ behavior: 'smooth' }), 80)
                    }}
                  />
                ) : (
                  <div className="w-full h-[600px] flex flex-col items-center justify-center gap-4 text-muted bg-surface/50 backdrop-blur-sm border-dashed border-2 border-white/5">
                    <Box size={48} className="opacity-20" />
                    <p className="font-medium tracking-widest uppercase text-xs">Visualización 3D Desactivada</p>
                    <button onClick={() => setShow3D(true)} className="btn-primary px-6 py-2 mt-2">Activar Visor</button>
                  </div>
                )}
              </div>

              <div id="results">
                <ResultPanel 
                  design={currentResult} 
                  selectedPieceIds={selectedPieceIds}
                  onSelectPieces={setSelectedPieceIds}
                  onDeleteModule={handleDeleteModule}
                  onSave={() => console.log('Saving module', currentResult.id)}
                />
              </div>
            </div>
          </div>
        </main>

        {showUndoToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-4 border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 z-50">
            <span className="text-sm text-white">Módulo eliminado</span>
            <button onClick={undo} className="text-primary text-sm font-bold uppercase tracking-widest hover:underline flex items-center gap-1.5">
              <RotateCcw size={14} /> Deshacer
            </button>
          </div>
        )}

        <footer className="max-w-screen-2xl mx-auto px-4 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-muted">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <span className="text-[10px] font-black text-black">O</span>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase">Orbin Furniture AI — v2.2.0</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-50">© 2026 Orbin Technologies. Design for manufacture.</p>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
