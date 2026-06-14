// Orbin AI - Main App
import { useState, useEffect, Suspense, Component, lazy, useRef, useCallback } from 'react'
import Header from './components/Header.jsx'
import InputPanel from './components/InputPanel.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ProjectsPanel from './components/ProjectsPanel.jsx'
import CarpentryAdvisor from './components/CarpentryAdvisor.jsx'
const Viewer3D = lazy(() => import('./components/Viewer3D.jsx'))
import ExportPanel from './components/ExportPanel.jsx'
import MemoryPanel from './components/MemoryPanel.jsx'
import DesignHealthPanel from './components/DesignHealthPanel.jsx'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import OnboardingFlow from './components/OnboardingFlow.jsx'
import OnboardingWizard from './components/OnboardingWizard.jsx'
import MultiplayerLayer from './components/MultiplayerLayer.jsx'
import ImageToParametricPanel from './components/ImageToParametricPanel.jsx'
import { api } from './api/client.js'
import { parseNaturalLanguage, buildOfflineReply } from './engine/offlineParser.js'
import { initCollaboration, getSocket, disconnectCollaboration } from './engine/collaboration.js'
import {
  loadMemory, saveMemory, saveVersion, revertToVersion,
  getVersionHistory, logPrompt, logAction, logExport,
  getRecentActions, generateProjectSummary, clearMemory
} from './engine/projectMemory.js'
import { Sliders, MessageSquare, FolderOpen, Box, RotateCcw, Undo2, Redo2, Users, Camera, Lock, Crown, AlertTriangle, Eye, PanelLeft } from 'lucide-react'

import { usePreferences } from './context/PreferencesContext.jsx'
import { useUser } from './context/UserContext.jsx'

// ── Plan Upgrade Banner ────────────────────────────────────────────────────────
function PlanLimitAlert({ message, description, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-2 border border-primary/30 rounded-3xl p-8 max-w-md mx-4 space-y-4 shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 rounded-2xl flex items-center justify-center">
            <Crown size={20} className="text-primary" />
          </div>
          <h3 className="text-sm font-black text-white">{message}</h3>
        </div>
        <p className="text-[12px] text-muted leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <a href="/register?plan=pro" className="btn-primary flex-1 h-10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Crown size={12} /> Upgrade Pro
          </a>
          <button onClick={onClose} className="flex-1 h-10 bg-surface-3 text-muted hover:text-white border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    // Non-blocking error report — fails silently if server is down
    try {
      const API_BASE = import.meta.env.VITE_API_URL || ''
      fetch(`${API_BASE}/api/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || String(error),
          stack: error?.stack?.slice(0, 800),
          componentStack: info?.componentStack?.slice(0, 400),
          url: window.location.href,
          ts: new Date().toISOString(),
        }),
      }).catch(() => {}) // never throw — best-effort only
    } catch (_) {}
  }
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
  const { isFree, canAddModule, canUseChat, planConfig } = useUser()
  const [planAlert, setPlanAlert] = useState(null)   // { message, description }
  const [showExports, setShowExports] = useState(true)
  // ★ PLANO EJECUTIVO: read-only capture ref — set by Viewer3D, consumed by ExportPanel
  const captureWireframeRef = useRef(null)
  const handleCaptureReady  = useCallback(fn => { captureWireframeRef.current = fn }, [])
  const [showWelcome, setShowWelcome] = useState(true)
  const [activeTab, setActiveTab] = useState('params')
  const [loading,   setLoading]   = useState(false)
  const [modules,   setModules]   = useState(() => {
    try {
      const saved = localStorage.getItem('orbin-autosave')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  // ★ FIX: ref siempre actualizado para evitar stale closure en saveHistory/undo
  const modulesRef = useRef([])
  const [history,   setHistory]   = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [selectedPieceIds, setSelectedPieceIds] = useState(new Set())
  const [error,     setError]     = useState(null)
  const [show3D,    setShow3D]    = useState(true)
  // ★ Server health tracking — enables offline fallback in handleSendMessage
  const [serverOnline, setServerOnline] = useState(true)
  const [mobileView, setMobileView] = useState('panel')
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('orbin-onboarding-done') } catch { return false }
  })
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(() => {
    try { return !localStorage.getItem('orbin_onboarded') } catch { return false }
  })
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [lastPrompt, setLastPrompt] = useState('')
  const [aiStatus, setAiStatus] = useState('')

  // Project Memory state
  const [projectMemory, setProjectMemory] = useState(() => loadMemory())
  const refreshMemory = () => setProjectMemory(loadMemory())

  // Collaboration State
  const [roomId, setRoomId] = useState(null)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) {
      let userName = localStorage.getItem('orbin-username')
      if (!userName) {
        userName = prompt('Estás ingresando a una sala compartida. ¿Cuál es tu nombre?') || 'Invitado'
        localStorage.setItem('orbin-username', userName)
      }
      const sock = initCollaboration(room, userName)
      setSocket(sock)
      setRoomId(room)

      sock.on('state-change', (incomingModules) => {
        setModules(incomingModules)
      })

      return () => {
        sock.off('state-change')
        disconnectCollaboration()
      }
    }
  }, [])

  const TABS = [
    { id: 'params', label: t('tab_parameters'), icon: Sliders },
    { id: 'chat',   label: t('tab_chat'),    icon: MessageSquare },
    { id: 'vision', label: 'AI Vision',      icon: Camera },
    { id: 'projects', label: t('tab_projects'),  icon: FolderOpen },
    { id: 'export', label: t('tab_export'),    icon: Box },
  ]

  // ★ Server health check — ping every 15s, enable offline fallback if unreachable
  useEffect(() => {
    let mounted = true
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(3000) })
        if (mounted) setServerOnline(res.ok)
      } catch {
        if (mounted) setServerOnline(false)
      }
    }
    ping()
    const interval = setInterval(ping, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  useEffect(() => {
    modulesRef.current = modules  // ★ FIX: mantener ref sincronizado
    try {
      if (modules.length > 0) {
        localStorage.setItem('orbin-autosave', JSON.stringify(modules))
        localStorage.setItem('orbin-autosave-ts', new Date().toISOString())
      } else {
        // BUG FIX: When all modules are deleted, clear autosave so reload doesn't restore stale data
        localStorage.removeItem('orbin-autosave')
        localStorage.removeItem('orbin-autosave-ts')
      }
    } catch {}
  }, [modules])

  const saveHistory = (newModules, label, isRemote = false) => {
    setHistory(prev => [...prev, modulesRef.current].slice(-20))  // ★ FIX: usar ref para evitar stale closure
    setRedoStack([])
    setModules(newModules)

    if (!isRemote) {
      const sock = getSocket()
      if (sock) sock.emit('state-change', newModules)
    }

    try {
      const mem = loadMemory()
      saveVersion(mem, newModules, label || '')
      refreshMemory()
    } catch {}
  }

  const handleGenerate = async (payload) => {
    // ── PLAN RESTRICTION: Free plan max 3 modules ─────────────────────────
    if (isFree && !canAddModule(modules.length)) {
      setPlanAlert({
        message:     t('plan_module_limit')     || 'Límite de módulos alcanzado',
        description: t('plan_module_limit_desc') || 'El plan Gratuito permite hasta 3 módulos. Haz upgrade para crear proyectos ilimitados.',
      })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateDesign(payload)
      let design = data?.design || (data?.modules && data.modules[0])
      if (design && design.pieces) {
        // ★ FIX: Ensure configuration wrapper exists so Viewer3D uses the parametric builder
        // (not the legacy buildFromPieces fallback which lacks drawer animation, countertop system, drag & snap)
        if (!design.configuration) {
          const md = design.metadata?.dimensions || {}
          design = {
            ...design,
            configuration: {
              moduleType:     design.type || 'standard',
              width:          md.width    || design.dimensions?.width    || 600,
              height:         md.height   || design.dimensions?.height   || 2200,
              depth:          md.depth    || design.dimensions?.depth    || 580,
              thickness:      18,
              backThickness:  6,
              numShelves:     0,
              numDrawers:     0,
              hasDoors:       false,
              baseboard:      true,
              baseboardHeight: 100,
              hasCountertop:  false,
              materialBody:   'oak_light',
              materialFront:  'white',
            }
          }
        }
        const newModule = { ...design, id: design.id || ('MOD-' + Date.now()) }
        saveHistory([...modules, newModule], 'Generated ' + (design.type || 'module'))
        setSelectedModuleId(newModule.id)
        try {
          const mem = loadMemory()
          logAction(mem, 'generate', {
            moduleType: design.type || (design.configuration && design.configuration.moduleType),
            width: design.configuration && design.configuration.width,
            height: design.configuration && design.configuration.height,
          })
          refreshMemory()
        } catch {}
        setTimeout(() => {
          const el = document.getElementById('results')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else if (data && data.error) {
        console.error('[App/Generate] Server Error:', data.error, data.detail)
        setError(data.error + ' ' + (data.detail || ''))
      }
    } catch (err) {
      console.error('[App/Generate] Connection Error:', err)
      setError(err.message || 'Error connecting to server.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFromVision = (analysisResult) => {
    try {
      if (!analysisResult.modules || analysisResult.modules.length === 0) {
        throw new Error('La IA no pudo detectar módulos válidos en la imagen.')
      }

      // ★ FIX: Wrap in `configuration` object so Viewer3D can build geometry correctly
      const newModules = analysisResult.modules.map(mod => ({
        id: crypto.randomUUID(),
        type: 'base',
        configuration: {
          moduleType:   'base',
          width:        mod.width        || 600,
          height:       analysisResult.height || 2000,
          depth:        analysisResult.depth  || 600,
          thickness:    18,
          hasCountertop: analysisResult.hasCountertop || false,
          numShelves:   mod.numShelves   || 0,
          numDrawers:   mod.numDrawers   || 0,
          numDividers:  mod.numDividers  || 0,
          materialBody:  'oak_light',
          materialFront: 'white',
        }
      }))
      
      saveHistory(newModules, 'Generado desde IA Vision')
      setActiveTab('params')
      
      if (analysisResult.obstacles && analysisResult.obstacles.length > 0) {
        setTimeout(() => alert(`AI Notó los siguientes obstáculos:\n\n- ${analysisResult.obstacles.join('\n- ')}`), 500)
      }
    } catch (err) {
      alert(err.message || 'Error aplicando diseño de IA Vision')
    }
  }

  const handleApplyModification = (updates) => {
    // ★ FIX: `design` was undefined — use selected module as base or create from updates
    const baseModule = modules.find(m => m.id === selectedModuleId) || {}
    const newModule = {
      ...baseModule,
      ...updates,
      id: baseModule.id || ('MOD-' + Date.now()),
      configuration: { ...(baseModule.configuration || {}), ...(updates.configuration || updates) }
    }
    saveHistory(modules.map(m => m.id === newModule.id ? newModule : m), 'Modificado')
    setSelectedModuleId(newModule.id)
    setActiveTab('params')
  }

  const AI_PHASES = [
    { msg: 'Routing request...', delay: 0 },
    { msg: 'Thinking...', delay: 800 },
    { msg: 'Analyzing design intent...', delay: 2200 },
    { msg: 'Generating 3D model...', delay: 4000 },
  ]

  // ★ FIX: handleChatDesign was called in handleSendMessage but never defined.
  //   Converts a raw AI design object into a proper module and pushes it to history.
  const handleChatDesign = ({ design }) => {
    // ── PLAN RESTRICTION: Free plan max 3 modules via chat too ───────────
    if (isFree && !canAddModule(modules.length)) {
      setPlanAlert({
        message:     t('plan_module_limit')     || 'Límite de módulos alcanzado',
        description: t('plan_module_limit_desc') || 'El plan Gratuito permite hasta 3 módulos. Haz upgrade.',
      })
      return
    }
    if (!design) return
    // Normalize: wrap bare params object into full module shape expected by Viewer3D
    const configuration = design.configuration
      ? design.configuration
      : {
          moduleType:   design.moduleType   || design.type || 'standard',
          width:        design.width        || 600,
          height:       design.height       || 2200,
          depth:        design.depth        || 580,
          thickness:    Number(design.thickness)    || 18,
          backThickness: Number(design.backThickness) || 6,
          numShelves:   design.numShelves   ?? 1,
          numDrawers:   design.numDrawers   ?? 0,
          drawerHeight: design.drawerHeight || 180,
          hasDoors:     design.hasDoors     ?? true,
          numDoors:     design.numDoors     ?? 2,
          baseboard:    design.baseboard    ?? true,
          baseboardHeight: design.baseboardHeight || 100,
          hasCountertop:  design.hasCountertop ?? false,
          materialBody:  design.materialBody  || 'oak_light',
          materialFront: design.materialFront || 'white',
        }
    const newModule = {
      ...design,
      id:            design.id || ('CHAT-' + Date.now()),
      type:          design.type || configuration.moduleType || 'standard',
      configuration,
    }
    saveHistory([...modules, newModule], 'Chat — ' + (newModule.type || 'módulo'))
    setSelectedModuleId(newModule.id)
    setActiveTab('params')
  }

  const handleSendMessage = async (text) => {
    if (!text.trim() || chatLoading) return
    setChatLoading(true)
    setLastPrompt(text)
    setChatMessages(prev => [...prev, { role: 'user', content: text }])
    const timers = AI_PHASES.map(p => setTimeout(() => setAiStatus(p.msg), p.delay))

    // ★ OFFLINE FALLBACK: if server is unreachable, use client-side NL parser
    if (!serverOnline) {
      timers.forEach(clearTimeout)
      setAiStatus('⚡ Modo offline...')
      try {
        const parsed = parseNaturalLanguage(text)
        const reply  = buildOfflineReply(parsed)
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply, source: 'offline' }])
        setServerOnline(false)
        // Generate module from parsed params
        const offlineDesign = {
          id: 'offline-' + Date.now(),
          type: parsed.params.moduleType || 'standard',
          configuration: parsed.params,
          pieces: [],
          cutList: [],
        }
        handleChatDesign({ design: offlineDesign })
        try { const mem = loadMemory(); logPrompt(mem, text, reply, 'offline', true); refreshMemory() } catch {}
      } catch (e) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erro no parser offline: ' + e.message, source: 'error' }])
      } finally {
        setAiStatus('')
        setChatLoading(false)
      }
      return
    }

    // ★ ONLINE PATH: call backend with automatic offline fallback on network error
    try {
      const data = await api.chatDesign(text, 'default-session')
      setServerOnline(true)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        source: data.source || 'unknown'
      }])
      try {
        const mem = loadMemory()
        logPrompt(mem, text, data.reply, data.source || 'unknown', !!data.design)
        refreshMemory()
      } catch {}
      if (data.design) handleChatDesign({ design: data.design })
    } catch (err) {
      // Network error → switch to offline mode immediately for next message
      const isNetworkError = err.message.includes('conectar') || err.message.includes('connect') || err.message.includes('fetch')
      if (isNetworkError) {
        setServerOnline(false)
        const parsed = parseNaturalLanguage(text)
        const reply  = buildOfflineReply(parsed)
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply, source: 'offline' }])
        const offlineDesign = {
          id: 'offline-' + Date.now(),
          type: parsed.params.moduleType || 'standard',
          configuration: parsed.params,
          pieces: [],
          cutList: [],
        }
        handleChatDesign({ design: offlineDesign })
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Error: ' + err.message,
          source: 'error'
        }])
      }
    } finally {
      timers.forEach(clearTimeout)
      setAiStatus('')
      setChatLoading(false)
    }
  }

  const handleUpdateModule = (id, newConfig) => {
    if (!id) return
    saveHistory(modules.map(m => m.id === id ? { ...m, configuration: { ...m.configuration, ...newConfig } } : m))
  }

  // ★ Delete a single piece from a module — undoable with Ctrl+Z
  const handleDeletePiece = (moduleId, pieceId) => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return
    const updatedPieces   = (module.pieces  || []).filter(p => p.id !== pieceId)
    const updatedCutList  = (module.cutList || []).filter(p => p.id !== pieceId)
    const updatedModules  = modules.map(m =>
      m.id === moduleId ? { ...m, pieces: updatedPieces, cutList: updatedCutList } : m
    )
    saveHistory(updatedModules, 'Deleted piece')
    setShowUndoToast(true)
    setTimeout(() => setShowUndoToast(false), 5000)
    setSelectedPieceIds(prev => { const next = new Set(prev); next.delete(pieceId); return next })
  }

  const handleDeleteModule = (id) => {
    const target = modules.find(m => m.id === id)
    if (!target) return
    try {
      const mem = loadMemory()
      logAction(mem, 'delete', { moduleId: id })
      refreshMemory()
    } catch {}
    saveHistory(modules.filter(m => m.id !== id), 'Deleted module')
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
    const sock = getSocket()
    if (sock) sock.emit('state-change', prev)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setHistory(h => [...h, modules])
    setRedoStack(rs => rs.slice(0, -1))
    setModules(next)
    const sock = getSocket()
    if (sock) sock.emit('state-change', next)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isInput) return
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        if (isInput) return
        e.preventDefault()
        redo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return
        // ★ FIX: si hay un módulo seleccionado, Delete lo borra directamente.
        // No requiere deseleccionar piezas primero.
        if (selectedModuleId) {
          e.preventDefault()
          setSelectedPieceIds(new Set())
          handleDeleteModule(selectedModuleId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modules, history, redoStack, selectedModuleId, selectedPieceIds])

  const handleMemoryRevert = (versionId) => {
    try {
      const mem = loadMemory()
      const snapshot = revertToVersion(mem, versionId)
      if (snapshot) {
        saveHistory(snapshot, 'Reverted to ' + versionId)
        setSelectedModuleId(null)
        setSelectedPieceIds(new Set())
        refreshMemory()
      }
    } catch {}
  }

  const handleShareRoom = () => {
    if (roomId) {
      navigator.clipboard.writeText(window.location.href)
      alert('Enlace de la sala copiado al portapapeles!')
    } else {
      const newRoom = 'orbin-' + Math.random().toString(36).substr(2, 6)
      const url = new URL(window.location.href)
      url.searchParams.set('room', newRoom)
      window.location.href = url.toString()
    }
  }

  const handleClearMemory = () => {
    clearMemory()
    refreshMemory()
  }

  const memVersions = getVersionHistory(projectMemory)
  const memActions = getRecentActions(projectMemory, 8)
  const memSummary = modules.length > 0 ? generateProjectSummary(projectMemory, modules) : null

  const currentResult = (modules || []).find(m => m.id === selectedModuleId)

  if (showWelcome) {
    return (
      <ErrorBoundary>
        <WelcomeScreen onStart={() => setShowWelcome(false)} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0D0D0D]">
        {showOnboardingWizard && (
          <OnboardingWizard
            onComplete={(payload, startTab) => {
              try { localStorage.setItem('orbin_onboarded', '1') } catch {}
              setShowOnboardingWizard(false)
              if (startTab) setActiveTab(startTab)
              handleGenerate(payload)
            }}
            onSkip={() => {
              try { localStorage.setItem('orbin_onboarded', '1') } catch {}
              setShowOnboardingWizard(false)
            }}
          />
        )}
        {/* Header containing inline pricing dropdown */}
        <Header modules={modules} serverOnline={serverOnline} />
        <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 xl:pb-6">
          {/* Mobile view toggle */}
          <div className="xl:hidden flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
              {mobileView === 'panel' ? <><PanelLeft size={13} className="text-primary" /> Panel</> : <><Eye size={13} className="text-primary" /> Visor 3D</>}
            </span>
            <button onClick={() => setMobileView(v => v === 'panel' ? 'viewer' : 'panel')}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/25 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95">
              {mobileView === 'panel' ? <><Eye size={11} /> Ver 3D</> : <><PanelLeft size={11} /> Panel</>}
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4 xl:gap-6">
            <aside className={`xl:sticky xl:top-20 xl:self-start space-y-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1 pb-4 scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent ${mobileView === "viewer" ? "hidden xl:block" : "block"}`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h1 className="text-xl font-black text-white leading-tight">
                  {(t('title') || '').split('—')[0]}<br />
                  <span className="text-primary">{'—'} {(t('title') || '').split('—')[1]}</span>
                </h1>
                {/* ── Plan badge ──────────────────────────────────────── */}
                {isFree && (
                  <a href="/register?plan=pro"
                     className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                  >
                    <Crown size={9} /> Free
                  </a>
                )}
                {!isFree && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                    <Crown size={9} /> {planConfig?.id === 'enterprise' ? 'Enterprise' : 'Pro'}
                  </span>
                )}
              </div>

              {/* Toolbar Row */}
              <div className="flex items-center justify-between bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/40 gap-2">
                <button onClick={() => setShowExports(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                  title="Abrir/Cerrar Listas y Documentos">
                  {showExports ? 'Ocultar Listas' : 'Ver Listas'}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={undo} disabled={history.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-20 disabled:pointer-events-none"
                    title="Deshacer (Ctrl+Z)">
                    <Undo2 size={12} /> Deshacer
                  </button>
                  <button onClick={redo} disabled={redoStack.length === 0}
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none"
                    title="Rehacer">
                    <Redo2 size={14} />
                  </button>
                  <button onClick={handleShareRoom}
                    className={`p-2 rounded-lg border transition-all ${roomId ? 'text-primary bg-primary/10 border-primary/20' : 'text-white/70 hover:text-white bg-white/5 border-white/5'}`}
                    title={roomId ? 'Copiar Enlace de Sala' : 'Crear Sala Compartida'}>
                    <Users size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-surface-3 p-1 rounded-xl" role="tablist">
                <div className="grid grid-cols-2 gap-1.5">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      className={'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ' +
                        (activeTab === id ? 'bg-primary text-black shadow-sm' : 'text-muted hover:text-white hover:bg-surface-2') +
                        (id === 'export' ? ' col-span-2' : '')}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div id={'panel-' + activeTab}>
                {activeTab === 'params' && (
                  <>
                    <InputPanel
                      onGenerate={handleGenerate}
                      loading={loading}
                      currentConfig={currentResult && currentResult.configuration}
                      onUpdateConfig={(newConfig) => handleUpdateModule(selectedModuleId, newConfig)}
                    />
                    {error && (
                      <div className="mt-4 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger" role="alert">
                        {error}
                      </div>
                    )}
                  </>
                )}
                {activeTab === 'chat' && (
                  <ChatPanel
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    loading={chatLoading}
                    aiStatus={aiStatus}
                    lastPrompt={lastPrompt}
                    currentDesign={currentResult}
                    planLocked={!canUseChat}
                  />
                )}
                {activeTab === 'vision' && <ImageToParametricPanel onApplyDesign={handleGenerateFromVision} />}
                {activeTab === 'projects' && (
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
              {modules.length > 0 && showExports && (
                <ExportPanel
                  modules={modules}
                  captureWireframe={() => captureWireframeRef.current?.()}
                />
              )}

              {modules.length > 0 && <DesignHealthPanel modules={modules} />}

              <MemoryPanel
                versions={memVersions}
                recentActions={memActions}
                summary={memSummary}
                onRevert={handleMemoryRevert}
                onClearMemory={handleClearMemory}
              />
            </aside>

            <div className={`space-y-4 xl:space-y-6 ${mobileView === 'panel' ? 'hidden xl:block' : 'block'}`}>
              <div className="card p-0 overflow-hidden border-primary/10 shadow-2xl shadow-primary/5 relative" style={{ minHeight: 'clamp(280px, 50vw, 600px)' }}>
                {show3D ? (
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full min-h-[280px] gap-3 text-muted">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">Cargando 3D...</span>
                    </div>
                  }>
                  <Viewer3D
                    modules={modules}
                    selectedModuleId={selectedModuleId}
                    selectedPieceIds={selectedPieceIds}
                    onSelectModule={setSelectedModuleId}
                    onSelectPiece={setSelectedPieceIds}
                    onDeleteModule={handleDeleteModule}
                    onUpdateModule={handleUpdateModule}
                    onCaptureReady={handleCaptureReady}
                    onAddModule={() => {
                      setActiveTab('params')
                      setTimeout(() => {
                        const el = document.getElementById('panel-params')
                        if (el) el.scrollIntoView({ behavior: 'smooth' })
                      }, 80)
                    }}
                  />
                  </Suspense>
                ) : (
                  <div className="w-full h-[600px] flex flex-col items-center justify-center gap-4 text-muted bg-surface/50 backdrop-blur-sm border-dashed border-2 border-white/5">
                    <Box size={48} className="opacity-20" />
                    <p className="font-medium tracking-widest uppercase text-xs">3D Disabled</p>
                    <button onClick={() => setShow3D(true)} className="btn-primary px-6 py-2 mt-2">Activate Viewer</button>
                  </div>
                )}
              </div>

              {showExports && (
                <div id="results">
                  <ResultPanel
                    design={currentResult}
                    selectedPieceIds={selectedPieceIds}
                    onSelectPieces={setSelectedPieceIds}
                    onDeleteModule={handleDeleteModule}
                    onDeletePiece={handleDeletePiece}
                    onSave={() => console.log('Saving module', currentResult.id)}
                  />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── Plan Limit Alert ──────────────────────────────────────────── */}
        {planAlert && (
          <PlanLimitAlert
            message={planAlert.message}
            description={planAlert.description}
            onClose={() => setPlanAlert(null)}
          />
        )}

        {showUndoToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-4 border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 z-50">
            <span className="text-sm text-white">Module deleted</span>
            <button onClick={undo} className="text-primary text-sm font-bold uppercase tracking-widest hover:underline flex items-center gap-1.5">
              <RotateCcw size={14} /> Undo
            </button>
          </div>
        )}


      </div>
    </ErrorBoundary>
  )
}
