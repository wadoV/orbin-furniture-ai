import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Maximize2, Grid3X3, Trash2, RotateCcw, AlertTriangle, Move, MousePointer2, Plus } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

const SCALE = 0.1
const EXPLODE_FACTOR = 0.35

// ── Piece orientation (same as before — verified against engine) ───────────────
function getPieceDims(p) {
  const w = (p.width || 0) * SCALE
  const h = (p.height || 0) * SCALE
  const t = (p.thickness || 15) * SCALE
  switch (p.type) {
    case 'lateral':               return { bx: t, by: h, bz: w }
    case 'techo': case 'piso':
    case 'repisa': case 'tie_strip': return { bx: w, by: t, bz: h }
    default:                      return { bx: w, by: h, bz: t }
  }
}

// ── Ease ─────────────────────────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

// ── Marquee ──────────────────────────────────────────────────────────────────
function MarqueeBox({ rect }) {
  if (!rect) return null
  return (
    <div className="absolute pointer-events-none border border-[#f5a623] bg-[#f5a623]/10 z-20"
      style={{
        left:   Math.min(rect.x1, rect.x2),
        top:    Math.min(rect.y1, rect.y2),
        width:  Math.abs(rect.x2 - rect.x1),
        height: Math.abs(rect.y2 - rect.y1)
      }} />
  )
}

// ── SketchUp material factory ─────────────────────────────────────────────────
function makeMat(isSelPiece, isSelMod) {
  return new THREE.MeshLambertMaterial({
    color: isSelPiece ? 0xf5a623 : 0xf0ece4,   // amber selected / warm white default
    emissive: new THREE.Color(isSelPiece ? 0x3a2000 : isSelMod ? 0x1a1000 : 0x000000),
  })
}
function makeEdgeMat(isSelPiece) {
  return new THREE.LineBasicMaterial({ color: isSelPiece ? 0x3a1a00 : 0x111111 })
}

export default function Viewer3D({
  designs          = [],
  selectedModuleId,
  selectedPieceIds = new Set(),
  onSelectModule   = () => {},
  onSelectPieces   = () => {},
  onDeleteModule   = () => {},
  onAddModule      = () => {},
}) {
  const { t } = usePreferences()

  const mountRef     = useRef(null)
  const sceneRef     = useRef(null)
  const groupRef     = useRef(null)
  const rendererRef  = useRef(null)
  const controlsRef  = useRef(null)
  const cameraRef    = useRef(null)
  const animFrameRef = useRef(null)
  const clockRef     = useRef(new THREE.Clock())
  const groupsRef    = useRef([])   // array of piece Groups
  const animsRef     = useRef(new Map()) // pieceId → {group, open, progress, type, startZ, endZ}
  const dragStart    = useRef(null)
  const isDragging   = useRef(false)

  const [isReady,   setIsReady]   = useState(false)
  const [exploded,  setExploded]  = useState(false)
  const [navMode,   setNavMode]   = useState('orbit')
  const [marquee,   setMarquee]   = useState(null)
  const [initError, setInitError] = useState(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount || rendererRef.current) return
    try {
      const W = mount.clientWidth  || 800
      const H = mount.clientHeight || 600

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x111111)
      sceneRef.current = scene

      const group = new THREE.Group()
      scene.add(group)
      groupRef.current = group

      const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 8000)
      camera.position.set(-250, 180, -350)
      cameraRef.current = camera

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type    = THREE.PCFSoftShadowMap
      mount.appendChild(renderer.domElement)
      rendererRef.current = renderer

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.minDistance   = 20
      controls.maxDistance   = 4000
      controlsRef.current = controls

      // SketchUp-like lighting: strong top + soft fill
      scene.add(new THREE.AmbientLight(0xffffff, 0.9))
      const top = new THREE.DirectionalLight(0xffffff, 1.0)
      top.position.set(200, 600, 300)
      top.castShadow = true
      top.shadow.mapSize.set(2048, 2048)
      scene.add(top)
      const fill = new THREE.DirectionalLight(0xddeeff, 0.25)
      fill.position.set(-300, 100, -200)
      scene.add(fill)

      // Grid — fine SketchUp-like grid
      const grid = new THREE.GridHelper(3000, 150, 0x333333, 0x222222)
      grid.position.y = -0.5
      scene.add(grid)

      // Animate + piece anim loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate)
        const dt = clockRef.current.getDelta()
        animsRef.current.forEach((anim) => {
          if (anim.progress < 1) {
            anim.progress = Math.min(1, anim.progress + dt * 3.5)
            const t = easeOutCubic(anim.progress)
            if (anim.type === 'drawer') {
              anim.group.position.z = THREE.MathUtils.lerp(anim.startZ, anim.endZ, t)
            } else if (anim.type === 'door') {
              anim.group.rotation.y = THREE.MathUtils.lerp(anim.startRot, anim.endRot, t)
            }
          }
        })
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const handleResize = () => {
        if (!mount || !rendererRef.current) return
        const rw = mount.clientWidth || 800, rh = mount.clientHeight || 600
        if (!rw || !rh) return
        camera.aspect = rw / rh
        camera.updateProjectionMatrix()
        renderer.setSize(rw, rh)
      }
      const ro = new ResizeObserver(handleResize)
      ro.observe(mount)
      window.addEventListener('resize', handleResize)
      requestAnimationFrame(handleResize)
      setIsReady(true)

      return () => {
        cancelAnimationFrame(animFrameRef.current)
        ro.disconnect()
        window.removeEventListener('resize', handleResize)
        controls.dispose()
        renderer.dispose()
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
        rendererRef.current = null
      }
    } catch (err) { setInitError(err.message) }
  }, [])

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.enabled = navMode === 'orbit'
  }, [navMode])

  // ── Rebuild geometry ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !groupRef.current) return

    groupsRef.current.forEach(g => {
      g.traverse(child => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m.dispose())
      })
    })
    groupRef.current.clear()
    groupsRef.current = []
    animsRef.current.clear()

    if (!designs || !designs.length) return

    const bbox = new THREE.Box3()
    let count = 0

    designs.forEach((mod, modIdx) => {
      const pieces  = mod.pieces || mod.piezas || []
      const offsetX = modIdx * 280

      pieces.forEach(p => {
        try {
          const { bx, by, bz } = getPieceDims(p)
          if (bx <= 0 || by <= 0 || bz <= 0) return

          const px = (p.x || 0) * SCALE + offsetX
          const py = (p.y || 0) * SCALE
          const pz = (p.z || 0) * SCALE

          const isSelMod   = selectedModuleId === mod.id
          const isSelPiece = selectedPieceIds.has(p.id)
          const isDoor     = p.type === 'standard_door'

          // Group: pivot = piece origin for animation
          const pGroup = new THREE.Group()
          
          // [PRECISION] Pivot logic for doors: rotate around left edge
          if (isDoor) {
            pGroup.position.set(px - bx/2, py, pz)
          } else {
            pGroup.position.set(px, py, pz)
          }
          
          pGroup.userData = { id: p.id, moduleId: mod.id, type: p.type, name: p.name, originalPos: pGroup.position.clone() }

          // Mesh (centered inside group)
          const geo  = new THREE.BoxGeometry(bx, by, bz)
          const mat  = makeMat(isSelPiece, isSelMod)
          const mesh = new THREE.Mesh(geo, mat)
          mesh.castShadow = mesh.receiveShadow = true
          mesh.userData = pGroup.userData
          
          if (isDoor) {
            mesh.position.x = bx/2 // Offset mesh so group origin is at left edge
          }
          
          pGroup.add(mesh)

          // SketchUp black edges
          const edgesGeo  = new THREE.EdgesGeometry(geo, 12)
          const edgeLines = new THREE.LineSegments(edgesGeo, makeEdgeMat(isSelPiece))
          pGroup.add(edgeLines)

          groupRef.current.add(pGroup)
          groupsRef.current.push(pGroup)
          bbox.expandByPoint(pGroup.position)
          count++
        } catch (err) { console.error('[Viewer3D]', p.id, err) }
      })
    })

    // Auto-camera reset disabled for CONSTRUCTION_STABLE_V3
    // Use the manual reset button in the toolbar if needed.
  }, [designs, isReady, selectedModuleId, selectedPieceIds])

  // ── Explosion ──────────────────────────────────────────────────────────────
  useEffect(() => {
    groupsRef.current.forEach(g => {
      const orig = g.userData.originalPos
      if (!orig) return
      if (exploded) {
        const dir    = orig.clone().normalize()
        const factor = EXPLODE_FACTOR * (g.userData.type === 'lateral' ? 1.6 : 1)
        g.position.copy(orig).addScaledVector(dir, factor * 55)
      } else {
        g.position.copy(orig)
      }
    })
  }, [exploded])

  // ── Raycast: find piece group ──────────────────────────────────────────────
  const findGroup = useCallback((cx, cy) => {
    if (!mountRef.current || !cameraRef.current) return null
    const rect = mountRef.current.getBoundingClientRect()
    const x    =  ((cx - rect.left) / rect.width)  * 2 - 1
    const y    = -((cy - rect.top)  / rect.height)  * 2 + 1
    const rc   = new THREE.Raycaster()
    rc.setFromCamera({ x, y }, cameraRef.current)
    const hits = rc.intersectObjects(groupRef.current.children, true)
    if (!hits.length) return null
    let obj = hits[0].object
    while (obj.parent && obj.parent !== groupRef.current) obj = obj.parent
    return obj.userData.id ? obj : null
  }, [])

  // ── Open/close animation for doors & drawers ──────────────────────────────
  const togglePieceAnim = useCallback((pGroup) => {
    const { id, type, originalPos } = pGroup.userData
    const isDoor   = type === 'standard_door'
    const isDrawer = type === 'drawer_front' || type === 'drawer_box'
    if (!isDoor && !isDrawer) return

    const existing = animsRef.current.get(id)
    const open     = existing ? !existing.open : true

    if (isDrawer) {
      // [PRECISION] Drawers slide 400mm (40 units in scale 0.1)
      const travel = 40
      const startZ = existing?.open ? (originalPos.z - travel) : originalPos.z
      const endZ   = open ? originalPos.z - travel : originalPos.z
      animsRef.current.set(id, { group: pGroup, type: 'drawer', open, progress: 0, startZ, endZ })
    } else {
      // [PRECISION] Doors rotate 90° (Math.PI / 2) around pivot
      const rot      = Math.PI / 2
      const startRot = existing?.open ? -rot : 0
      const endRot   = open ? -rot : 0
      animsRef.current.set(id, { group: pGroup, type: 'door', open, progress: 0, startRot, endRot })
    }
  }, [])

  // ── Marquee ───────────────────────────────────────────────────────────────
  const piecesInMarquee = useCallback((x1, y1, x2, y2) => {
    if (!cameraRef.current || !mountRef.current) return new Set()
    const rect  = mountRef.current.getBoundingClientRect()
    const mL = Math.min(x1, x2), mR = Math.max(x1, x2)
    const mT = Math.min(y1, y2), mB = Math.max(y1, y2)
    const found = new Set()
    groupsRef.current.forEach(g => {
      const p3 = g.position.clone().project(cameraRef.current)
      const sx  = (p3.x + 1) / 2 * rect.width  + rect.left
      const sy  = (-p3.y + 1) / 2 * rect.height + rect.top
      if (sx >= mL && sx <= mR && sy >= mT && sy <= mB) found.add(g.userData.id)
    })
    return found
  }, [])

  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (navMode !== 'select') return
    dragStart.current  = { x: e.clientX, y: e.clientY }
    isDragging.current = false
  }, [navMode])

  const handleMouseMove = useCallback((e) => {
    if (navMode !== 'select' || !dragStart.current) return
    if (Math.abs(e.clientX - dragStart.current.x) > 5 || Math.abs(e.clientY - dragStart.current.y) > 5) {
      isDragging.current = true
      const r = mountRef.current.getBoundingClientRect()
      setMarquee({ x1: dragStart.current.x - r.left, y1: dragStart.current.y - r.top, x2: e.clientX - r.left, y2: e.clientY - r.top })
    }
  }, [navMode])

  const handleMouseUp = useCallback((e) => {
    if (navMode !== 'select') return
    if (isDragging.current && marquee) {
      const found = piecesInMarquee(dragStart.current.x, dragStart.current.y, e.clientX, e.clientY)
      if (found.size > 0) {
        onSelectPieces(e.shiftKey ? new Set([...selectedPieceIds, ...found]) : found)
        const first = groupsRef.current.find(g => found.has(g.userData.id))
        if (first) onSelectModule(first.userData.moduleId)
      }
    }
    dragStart.current  = null
    isDragging.current = false
    setMarquee(null)
  }, [navMode, marquee, selectedPieceIds, onSelectPieces, onSelectModule, piecesInMarquee])

  const handleClick = useCallback((e) => {
    if (isDragging.current || navMode !== 'select') return
    const g = findGroup(e.clientX, e.clientY)
    if (g) {
      onSelectModule(g.userData.moduleId)
      if (e.shiftKey) {
        const next = new Set(selectedPieceIds)
        next.has(g.userData.id) ? next.delete(g.userData.id) : next.add(g.userData.id)
        onSelectPieces(next)
      } else {
        onSelectPieces(new Set([g.userData.id]))
      }
      togglePieceAnim(g)
    } else {
      onSelectModule(null)
      onSelectPieces(new Set())
    }
  }, [navMode, findGroup, selectedPieceIds, onSelectModule, onSelectPieces, togglePieceAnim])

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(-250, 180, -350)
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }

  if (initError) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black text-center p-8">
      <AlertTriangle size={40} className="text-red-400 opacity-60" />
      <p className="text-red-400 text-sm font-bold">Error WebGL</p>
      <p className="text-gray-500 text-xs">{initError}</p>
      <button onClick={() => window.location.reload()} className="btn-primary px-6 py-2 text-xs">Reintentar</button>
    </div>
  )

  const selMod      = designs.find(d => d.id === selectedModuleId)
  const piecesCount = (selMod?.pieces || selMod?.piezas || []).length

  const tbBtn = (active) =>
    `p-2 rounded-md transition-all focus-visible:ring-2 focus-visible:ring-[#f5a623] focus-visible:outline-none ${
      active ? 'bg-[#f5a623] text-black' : 'text-neutral-400 hover:text-white hover:bg-white/8'
    }`

  return (
    <div className="w-full h-full relative group bg-[#111111] overflow-hidden select-none" role="region" aria-label="Visor 3D">
      {/* Canvas */}
      <div
        ref={mountRef}
        className={`w-full h-full ${navMode === 'select' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        role="img"
        aria-label="Visualización 3D del mueble"
        tabIndex={0}
      />

      <MarqueeBox rect={marquee} />

      {/* ── Single-row toolbar ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10" role="toolbar" aria-label="Herramientas del visor">
        <div className="flex items-center gap-1 bg-[#1c1c1c]/95 backdrop-blur-md border border-white/8 px-2 py-1.5 rounded-xl shadow-2xl">
          <button onClick={() => setNavMode('orbit')}  className={tbBtn(navMode==='orbit')}  title={t('orbit_mode')}   aria-pressed={navMode==='orbit'}><Move         size={15}/></button>
          <button onClick={() => setNavMode('select')} className={tbBtn(navMode==='select')} title={t('select_mode')}  aria-pressed={navMode==='select'}><MousePointer2 size={15}/></button>
          <div className="w-px h-5 bg-white/10 mx-0.5" aria-hidden="true"/>
          <button onClick={() => setExploded(v=>!v)}   className={tbBtn(exploded)}            title={t('exploded_view')} aria-pressed={exploded}><Maximize2     size={15}/></button>
          <button onClick={resetCamera}                className={tbBtn(false)}               title="Reset cámara"><RotateCcw      size={15}/></button>
          <div className="w-px h-5 bg-white/10 mx-0.5" aria-hidden="true"/>
          <button onClick={onAddModule} className="p-2 rounded-md bg-[#f5a623] hover:bg-[#ffbe4a] text-black font-bold transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#f5a623]" title={t('add_module')} aria-label={t('add_module')}>
            <Plus size={15}/>
          </button>
        </div>
      </div>

      {/* Mode badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-sm transition-all ${navMode==='select' ? 'bg-[#f5a623]/10 border-[#f5a623]/30 text-[#f5a623]' : 'bg-black/40 border-white/5 text-neutral-500'}`}
          role="status" aria-live="polite">
          <div className={`w-1.5 h-1.5 rounded-full ${navMode==='select' ? 'bg-[#f5a623] animate-pulse' : 'bg-neutral-600'}`}/>
          {navMode==='select' ? t('select_mode') : t('orbit_mode_short')}
        </div>
      </div>

      {/* Tip: click to open doors/drawers */}
      {navMode==='select' && selectedPieceIds.size>0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-[#1c1c1c]/90 border border-[#f5a623]/20 px-3 py-1.5 rounded-full text-[9px] text-[#f5a623] font-bold uppercase tracking-widest pointer-events-none">
          {t('click_open_hint') || 'Click en puerta/gaveta para abrir · Shift+Click = multi-select'}
        </div>
      )}

      {/* Empty state */}
      {(!designs || designs.length === 0) && isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="text-center opacity-20 space-y-2">
            <Box size={52} className="mx-auto"/>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t('viewer_empty')}</p>
          </div>
        </div>
      )}

      {/* Module card */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 pointer-events-none z-10">
        {selectedModuleId && selMod && (
          <div className="bg-[#1c1c1c]/95 backdrop-blur-xl border border-[#f5a623]/15 p-3 rounded-2xl shadow-2xl pointer-events-auto min-w-[180px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#f5a623]">{t('select_module')}</span>
              <button onClick={()=>onDeleteModule(selectedModuleId)} className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title={t('delete_module')} aria-label={t('delete_module')}>
                <Trash2 size={12}/>
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#f5a623]/10 rounded-lg flex items-center justify-center text-[#f5a623]"><Box size={16}/></div>
              <div>
                <p className="text-white text-xs font-bold">…{selectedModuleId.slice(-6)}</p>
                <p className="text-neutral-400 text-[10px]">{piecesCount} {t('pieces')}</p>
                {selectedPieceIds.size>0 && <p className="text-[#f5a623] text-[9px] font-bold">{selectedPieceIds.size} {t('selected')}</p>}
              </div>
            </div>
          </div>
        )}
        <div className="bg-black/40 px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-neutral-600 uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623] animate-pulse"/>
          <span>Three.js r{THREE.REVISION}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-black/70 p-2.5 rounded-xl border border-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <p className="text-[9px] font-black tracking-widest text-neutral-500 mb-1.5 uppercase">{t('legend')||'Leyenda'}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {[
            { color:'#c87820', label: t('standard_door_label') },
            { color:'#1a6090', label: t('drawer_front_label') },
            { color:'#f5a623', label: t('selected') },
            { color:'#f0ece4', label: t('body')||'Cuerpo' },
          ].map(({color,label})=>(
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm border border-[#111]" style={{background:color}}/>
              <span className="text-[8px] text-neutral-500 font-bold uppercase">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
