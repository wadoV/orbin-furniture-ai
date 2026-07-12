/**
 * Orbin AI — 3D Closet Viewer (V2.7 Premium Visual + Drag & Snap)
 * Parametric rendering from configuration with construction logic.
 * Dark theme, MeshStandard materials, wireframe, exploded view, orbit mode,
 * box selection, hover info, PNG export, drawer open/close animation.
 * ★ V2.3: Module drag-to-move + magnetic snap + independent positioning.
 *
 * FIX: React 18 StrictMode double-mount handled via initRef guard.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { Layers, Maximize, Download, Loader2, Move, Plus, Trash2, Box, GripVertical, Ruler, ArrowLeft, MonitorPlay, Scan, ZoomIn, ZoomOut } from 'lucide-react'

import PresentationMode from './PresentationMode.jsx'
import AIVisualStylist from './AIVisualStylist.jsx'
import ViralShare from './ViralShare.jsx'
import { getPBRMaterial } from '../engine/materialLibrary.js'

// Captura técnica (plano gris CAD): esconde y restaura las texturas PBR (bumpMap)
// para que las vistas del plano queden en gris plano, sin veta de madera. [2026-07]
const _stashPBRMaps = (m) => { const mt = m.material; if (!mt) return; m.userData._cm = { map: mt.map, bumpMap: mt.bumpMap, roughnessMap: mt.roughnessMap }; mt.map = null; mt.bumpMap = null; mt.roughnessMap = null; mt.needsUpdate = true }
const _restorePBRMaps = (m) => { const c = m.userData._cm; if (!c) return; m.material.map = c.map; m.material.bumpMap = c.bumpMap; m.material.roughnessMap = c.roughnessMap; m.material.needsUpdate = true; delete m.userData._cm }

// ─── Color Palette ────────────────────────────────────────────────────────────
const MATERIAL_COLORS = {
  white:         0xffffff,
  oak_light:     0xC8A96E,
  oak_dark:      0x8B7355,
  graphite:      0x333333,
  green_matte:   0x7D8C71,
  wood_dark:     0x5D4037,
  marble_white:  0xeeeeee,
  granite_black: 0x111111,
  default:       0xC8A96E,

  // Database standard materials
  mdf_15:             0xC4A882,
  mdf_18:             0xB89B72,
  mdf_25:             0xA88E65,
  plywood_18:         0xD4B896,
  melamine_white_18:  0xF0EDE8,
  melamine_wood_18:   0xC9A96E,
  melamine_wood_15:   0xC9A96E,
  osb_18:             0xD4C4A0,

  // Arauco Catalog — Vesto line (Brazil/Chile)
  arauco_vesto_roble_proveza:  0xC8A96E,
  arauco_vesto_nogal_europeo:  0x6B4C2A,
  arauco_vesto_pino_natural:   0xE0C898,
  arauco_vesto_eucalipto:      0xB5A07A,
  arauco_vesto_cerejeira:      0xB05A2E,
  arauco_vesto_blanco_puro:    0xF4F4F4,
  arauco_vesto_blanco_nube:    0xECEAE4,
  arauco_vesto_grafito:        0x333333,
  arauco_vesto_negro_onix:     0x111111,
  arauco_vesto_azul_acero:     0x2B4C7E,
  arauco_vesto_verde_salvia:   0x7D9B76,
  arauco_vesto_arena:          0xD4C4A0,
  arauco_vesto_concreto:       0x9E9E9E,
  arauco_vesto_marmol_blanco:  0xEEE8E0,

  // Duratex Catalog — Brazil
  duratex_carvalho_hanover:    0xB89B72,
  duratex_carvalho_barcelona:  0x9A7B52,
  duratex_freijo_naturale:     0x7B5C38,
  duratex_jatoba:              0x8B3A1A,
  duratex_pinus_natural:       0xDEC99A,
  duratex_branco_neve:         0xF5F5F5,
  duratex_branco_polar:        0xFAFAFA,
  duratex_preto_silk:          0x1A1A1A,
  duratex_cinza_sagrado:       0x8A8A8A,
  duratex_cinza_luna:          0xC4C4C4,
  duratex_verde_botanico:      0x5A7A5A,
  duratex_terracota:           0xB5602A,
  duratex_cimento_queimado:    0x7A7A7A,
  duratex_noce_elegance:       0x5C3D1E,
}

const TYPE_COLORS = {
  structural:    0xC8A96E,
  shelf:         0xD4B483,
  baseboard:     0x8B7355,
  drawer_front:  0xE8A020,
  standard_door: 0x7A9BB5,
  drawer_box:    0xE8D5B0,
  drawer_bottom: 0xF0E0C0,
  feet:          0x222222,
  countertop:    0xeeeeee,
}

const SELECTION_COLOR = 0xFFD700
const MODULE_HIGHLIGHT_COLOR = 0xF5A623
const SCALE = 0.1
const SNAP_THRESHOLD = 3  // ★ PROTECTED: snap distance in scene units (~30mm real)
const SNAP_COLOR = 0x00AAFF  // Blue guide line color

export default function Viewer3D({
  modules          = [],
  selectedModuleId,
  selectedPieceIds = new Set(),
  onSelectModule   = () => {},
  onSelectPiece    = () => {},
  onDeleteModule   = () => {},
  onUpdateModule   = () => {},
  onAddModule      = () => {},
  onCaptureReady   = null,   // (fn) => void  — called once renderer is ready; fn() returns PNG dataURL
  onIsoCaptureReady = null,  // (fn) => void  — expone captura isométrica en gris CAD (PNG dataURL)
  onCadCaptureReady = null,  // (fn)=>void — fn(kind:'front'|'top'|'iso') captura gris CAD -> {url,fx,fy}
}) {
  const { t, lang } = usePreferences()
  const mountRef = useRef(null)

  // ★ StrictMode guard — prevents double init
  const initRef = useRef(false)

  // Three.js persistent refs (survive StrictMode remount)
  const sceneRef     = useRef(null)
  const rendererRef  = useRef(null)
  const composerRef  = useRef(null)
  const camRef       = useRef(null)
  const controlsRef  = useRef(null)
  const groupRef     = useRef(null)
  const meshesRef    = useRef([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef     = useRef(new THREE.Vector2())
  const frameRef     = useRef(null)
  const gridRef      = useRef(null)

  // UI state
  const [isReady,     setIsReady]     = useState(false)
  const [exploded,    setExploded]    = useState(false)
  const [wireframe,   setWireframe]   = useState(false)
  const [orbitMode,   setOrbitMode]   = useState(false)
  const [openDrawers, setOpenDrawers] = useState(new Set())
  const [hoveredInfo, setHoveredInfo] = useState(null)

  // Box selection
  const [isDragging,   setIsDragging]   = useState(false)
  const [selectionBox, setSelectionBox] = useState(null)
  const dragStartRef = useRef(null)

  // ★ PROTECTED: Ruler measurement tool state
  const [rulerMode,     setRulerMode]     = useState(false)
  const [rulerPoints,   setRulerPoints]   = useState([])  // [{x,y,z}, {x,y,z}]
  const [rulerDistance,  setRulerDistance] = useState(null)
  const rulerLineRef = useRef(null)

  // ★ PROTECTED: Layers panel state
  const [showLayers, setShowLayers] = useState(false)
  const [hiddenModules, setHiddenModules] = useState(new Set())

  // Presentation mode
  const [isPresentationMode, setIsPresentationMode] = useState(false)

  // ★ PROTECTED: AR State
  const [arModelUrl, setArModelUrl] = useState(null)
  const [isExportingAR, setIsExportingAR] = useState(false)
  const modelViewerRef = useRef(null)

  // ★ PROTECTED: Module positions persist across rebuilds (key: moduleId → {x, z})
  const modulePositionsRef = useRef({})
  // ★ PROTECTED: Module groups for drag/snap (key: moduleId → THREE.Group)
  const moduleGroupsRef = useRef({})
  // ★ PROTECTED: Drag-to-move state
  const [isDragMoving, setIsDragMoving] = useState(false)
  const dragMoveRef = useRef({ active: false, moduleId: null, startPoint: null, startGroupPos: null })
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  // ★ Snap guide lines
  const snapLinesRef = useRef([])

  // Keep reactive state in a ref for the animation loop
  const stateRef = useRef({ exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints })
  useEffect(() => {
    stateRef.current = { exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints }
  }, [exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints])

  // ★ PROTECTED: Magnetic snap detection between modules during drag
  const performSnapDetection = useCallback((mGroup, moduleId) => {
    const scene = sceneRef.current
    if (!scene) return
    // Clean old snap guides
    snapLinesRef.current.forEach(l => { scene.remove(l); l.geometry?.dispose(); l.material?.dispose() })
    snapLinesRef.current = []

    const myBox = new THREE.Box3().setFromObject(mGroup)
    let snapped = false

    Object.entries(moduleGroupsRef.current).forEach(([otherId, otherGroup]) => {
      if (otherId === moduleId || snapped) return
      const otherBox = new THREE.Box3().setFromObject(otherGroup)

      // Check face-to-face proximity on X and Z axes
      const gaps = [
        { mine: myBox.max.x, other: otherBox.min.x, axis: 'x' },
        { mine: myBox.min.x, other: otherBox.max.x, axis: 'x' },
        { mine: myBox.max.z, other: otherBox.min.z, axis: 'z' },
        { mine: myBox.min.z, other: otherBox.max.z, axis: 'z' },
      ]

      for (const gap of gaps) {
        const dist = Math.abs(gap.mine - gap.other)
        if (dist < SNAP_THRESHOLD) {
          // ★ Snap to adjacent face
          if (gap.axis === 'x') mGroup.position.x += (gap.other - gap.mine)
          else mGroup.position.z += (gap.other - gap.mine)

          // Also align front faces when X-snapping
          if (gap.axis === 'x') {
            const myBoxU = new THREE.Box3().setFromObject(mGroup)
            const zDiff = Math.abs(myBoxU.max.z - otherBox.max.z)
            if (zDiff < SNAP_THRESHOLD * 2) {
              mGroup.position.z += (otherBox.max.z - myBoxU.max.z)
            }
          }

          // Visual snap guide line (blue)
          const updatedBox = new THREE.Box3().setFromObject(mGroup)
          const pts = []
          if (gap.axis === 'x') {
            const sx = gap.other
            pts.push(new THREE.Vector3(sx, Math.min(updatedBox.min.y, otherBox.min.y), Math.max(updatedBox.max.z, otherBox.max.z) + 2))
            pts.push(new THREE.Vector3(sx, Math.max(updatedBox.max.y, otherBox.max.y), Math.max(updatedBox.max.z, otherBox.max.z) + 2))
          } else {
            const sz = gap.other
            pts.push(new THREE.Vector3(Math.min(updatedBox.min.x, otherBox.min.x) - 2, updatedBox.min.y, sz))
            pts.push(new THREE.Vector3(Math.max(updatedBox.max.x, otherBox.max.x) + 2, updatedBox.min.y, sz))
          }
          const geo = new THREE.BufferGeometry().setFromPoints(pts)
          const mat = new THREE.LineBasicMaterial({ color: SNAP_COLOR, linewidth: 2, depthTest: false, transparent: true, opacity: 0.8 })
          const guideLine = new THREE.Line(geo, mat)
          guideLine.renderOrder = 999
          scene.add(guideLine)
          snapLinesRef.current.push(guideLine)
          snapped = true
          break
        }
      }
    })
  }, [])

  // ─── 1. Scene Init (runs ONCE even under StrictMode) ───────────────────────
  useEffect(() => {
    if (initRef.current) return   // ★ Already initialized — skip StrictMode re-run
    if (!mountRef.current) return
    initRef.current = true

    const canvas = mountRef.current
    if (!canvas || !canvas.isConnected) return
    // Cancelar frame anterior si existe
    if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
    const container = canvas.parentElement || canvas

    // --- Renderer — usa el canvas de React directamente para evitar conflictos DOM ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x0a0a0f, 1)
    rendererRef.current = renderer

    // --- Scene ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.0008)

    // --- Premium Environment Map (subtle reflections) ---
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    const envScene = new THREE.Scene()
    envScene.background = new THREE.Color(0x1a1a2e)
    // Gradient hemisphere for soft ambient reflections
    const envHemi = new THREE.HemisphereLight(0xffeedd, 0x080820, 1.0)
    envScene.add(envHemi)
    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture
    scene.environment = envTexture
    pmremGenerator.dispose()
    envScene.clear()
    sceneRef.current = scene

    // --- Camera ---
    const cam = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 50000)

    // [2026-07] SSAO opcional (oclusión ambiental en juntas) — OFF por defecto.
    // Se activa con ?ssao=1 o localStorage 'orbin-ssao'='1'. Import dinámico +
    // try/catch: si algo falla, el render normal sigue intacto (no rompe nada).
    // Las capturas del plano usan rdr.render directo → nunca pasan por el composer.
    const _ssaoOn = (() => { try { return new URLSearchParams(window.location.search).has('ssao') || window.localStorage.getItem('orbin-ssao') === '1' } catch (_) { return false } })()
    if (_ssaoOn) {
      ;(async () => {
        try {
          const [{ EffectComposer }, { RenderPass }, { SSAOPass }, { OutputPass }] = await Promise.all([
            import('three/examples/jsm/postprocessing/EffectComposer.js'),
            import('three/examples/jsm/postprocessing/RenderPass.js'),
            import('three/examples/jsm/postprocessing/SSAOPass.js'),
            import('three/examples/jsm/postprocessing/OutputPass.js'),
          ])
          const w = canvas.clientWidth || 800, h = canvas.clientHeight || 600
          const comp = new EffectComposer(renderer)
          comp.addPass(new RenderPass(scene, cam))
          const ssao = new SSAOPass(scene, cam, w, h)
          ssao.kernelRadius = 8; ssao.minDistance = 0.002; ssao.maxDistance = 0.08
          comp.addPass(ssao)
          comp.addPass(new OutputPass())
          composerRef.current = comp
        } catch (e) { composerRef.current = null; if (import.meta.env.DEV) console.warn('[SSAO] deshabilitado:', e && e.message) }
      })()
    }
    cam.position.set(350, 250, 450)
    camRef.current = cam

    // --- Premium Lighting Rig ---
    // Hemisphere: warm sky + cool ground for natural ambient
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x080820, 0.6)
    scene.add(hemiLight)
    // Soft ambient fill
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    // Key light — warm directional with high-res shadows
    const mainLight = new THREE.DirectionalLight(0xfff4e6, 0.9)
    mainLight.position.set(250, 500, 350)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.set(4096, 4096)
    mainLight.shadow.camera.near = 10
    mainLight.shadow.camera.far = 2000
    mainLight.shadow.camera.left = -600
    mainLight.shadow.camera.right = 600
    mainLight.shadow.camera.top = 600
    mainLight.shadow.camera.bottom = -600
    mainLight.shadow.bias = -0.0005
    mainLight.shadow.normalBias = 0.02
    mainLight.shadow.radius = 4
    scene.add(mainLight)
    // Fill light — cooler, softer
    const fillLight = new THREE.DirectionalLight(0xc4d4f0, 0.35)
    fillLight.position.set(-300, 250, -150)
    scene.add(fillLight)
    // Rim/back light for edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2)
    rimLight.position.set(0, 100, -400)
    scene.add(rimLight)

    // --- Grid ---
    const grid = new THREE.GridHelper(1000, 100, 0x1a1a2e, 0x0e0e1a)
    grid.position.y = -0.2
    scene.add(grid)
    gridRef.current = grid

    // --- Premium Ground Plane (subtle shadow receiver) ---
    const groundGeo = new THREE.PlaneGeometry(2000, 2000)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      roughness: 0.85,
      metalness: 0.15,
      transparent: true,
      opacity: 0.9,
    })
    const groundMesh = new THREE.Mesh(groundGeo, groundMat)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.y = -0.3
    groundMesh.receiveShadow = true
    groundMesh.userData._isGround = true
    scene.add(groundMesh)

    // --- Controls ---
    const controls = new OrbitControls(cam, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 0.9
    controlsRef.current = controls

    // --- Group for furniture ---
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // --- Resize ---
    const onResize = () => {
      const c = mountRef.current
      if (!c) return
      const w = c.clientWidth || c.parentElement?.clientWidth || 800
      const h = c.clientHeight || c.parentElement?.clientHeight || 600
      if (w === 0 || h === 0) return
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
      if (composerRef.current) composerRef.current.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // --- Mouse tracking ---
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    canvas.addEventListener('mousemove', onMouseMove)

    // --- Click / Box select / ★ PROTECTED: Drag-to-move ---
    const onMouseDown = (e) => {
      if (stateRef.current.orbitMode) return
      if (e.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      dragStartRef.current = { x, y }

      // ★ PROTECTED: Check if clicking on a module mesh for drag-to-move
      const mouse2d = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycasterRef.current.setFromCamera(mouse2d, cam)
      const hits = raycasterRef.current.intersectObjects(meshesRef.current)
      const hitMesh = hits.length > 0 ? hits[0].object : null

      // Prepare potential drag-move if mesh hit (not shift-click for multi-select)
      if (hitMesh && !e.shiftKey) {
        const moduleId = hitMesh.userData.moduleId
        const mGroup = moduleGroupsRef.current[moduleId]
        if (mGroup) {
          const intersection = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection)) {
            dragMoveRef.current = {
              active: false,
              moduleId,
              startPoint: intersection.clone(),
              startGroupPos: mGroup.position.clone(),
            }
          }
        }
      }

      const onMove = (me) => {
        const mx = me.clientX - rect.left
        const my = me.clientY - rect.top
        const dx = mx - dragStartRef.current.x
        const dy = my - dragStartRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // ★ PROTECTED: Drag-to-move module
        if (dragMoveRef.current.moduleId && dist > 5) {
          dragMoveRef.current.active = true
          setIsDragMoving(true)
          controls.enabled = false
          renderer.domElement.style.cursor = 'grabbing'

          const rect2 = renderer.domElement.getBoundingClientRect()
          const moveMouse = new THREE.Vector2(
            ((me.clientX - rect2.left) / rect2.width) * 2 - 1,
            -((me.clientY - rect2.top) / rect2.height) * 2 + 1
          )
          raycasterRef.current.setFromCamera(moveMouse, cam)
          const intersection = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersection)) {
            const delta = intersection.clone().sub(dragMoveRef.current.startPoint)
            const mGroup = moduleGroupsRef.current[dragMoveRef.current.moduleId]
            if (mGroup) {
              mGroup.position.x = dragMoveRef.current.startGroupPos.x + delta.x
              mGroup.position.z = dragMoveRef.current.startGroupPos.z + delta.z
              // ★ PROTECTED: Magnetic snap detection
              performSnapDetection(mGroup, dragMoveRef.current.moduleId)
            }
          }
          return
        }

        // Box select (only on empty space drag)
        if (!dragMoveRef.current.moduleId && dist > 5) {
          setIsDragging(true)
          setSelectionBox({
            start: dragStartRef.current,
            end: { x: mx, y: my }
          })
          controls.enabled = false
        }
      }

      const onUp = (ue) => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)

        // ★ PROTECTED: Finalize drag-to-move
        if (dragMoveRef.current.active) {
          const moduleId = dragMoveRef.current.moduleId
          const mGroup = moduleGroupsRef.current[moduleId]
          if (mGroup) {
            modulePositionsRef.current[moduleId] = { x: mGroup.position.x, z: mGroup.position.z, y: mGroup.position.y }
          }
          // Clean snap guides
          snapLinesRef.current.forEach(l => { scene.remove(l); l.geometry?.dispose(); l.material?.dispose() })
          snapLinesRef.current = []
          dragMoveRef.current = { active: false, moduleId: null, startPoint: null, startGroupPos: null }
          setIsDragMoving(false)
          controls.enabled = true
          return
        }
        dragMoveRef.current = { active: false, moduleId: null, startPoint: null, startGroupPos: null }

        const rectEnd = renderer.domElement.getBoundingClientRect()
        const endX = ue.clientX - rectEnd.left
        const endY = ue.clientY - rectEnd.top
        const edx = endX - dragStartRef.current.x
        const edy = endY - dragStartRef.current.y
        const isClick = Math.sqrt(edx * edx + edy * edy) < 5

        if (isClick) {
          raycasterRef.current.setFromCamera(mouseRef.current, cam)
          const clickHits = raycasterRef.current.intersectObjects(meshesRef.current)

          // ★ PROTECTED: Ruler mode — measure distance between two click points
          if (stateRef.current.rulerMode && clickHits.length > 0) {
            const pt = clickHits[0].point.clone()
            const pts = [...(stateRef.current.rulerPoints || [])]
            if (pts.length >= 2) {
              // Reset for new measurement
              pts.length = 0
              if (rulerLineRef.current) { scene.remove(rulerLineRef.current); rulerLineRef.current = null }
            }
            pts.push(pt)
            setRulerPoints(pts)
            if (pts.length === 2) {
              const dist = pts[0].distanceTo(pts[1]) / SCALE  // Convert back to mm
              setRulerDistance(Math.round(dist))
              // Draw visual line
              const geom = new THREE.BufferGeometry().setFromPoints(pts)
              const mat = new THREE.LineBasicMaterial({ color: 0x00FF99, linewidth: 2 })
              const line = new THREE.Line(geom, mat)
              scene.add(line)
              if (rulerLineRef.current) { scene.remove(rulerLineRef.current) }
              rulerLineRef.current = line
            }
          } else if (clickHits.length > 0) {
            const mesh = clickHits[0].object
            const { id, moduleId, drawerKey } = mesh.userData

            if (ue.shiftKey) {
              const next = new Set(stateRef.current.selectedPieceIds)
              next.has(id) ? next.delete(id) : next.add(id)
              onSelectPiece(next)
            } else {
              onSelectModule(moduleId)
              onSelectPiece(new Set([id]))
              if (drawerKey) {
                setOpenDrawers(prev => {
                  const next = new Set(prev)
                  next.has(drawerKey) ? next.delete(drawerKey) : next.add(drawerKey)
                  return next
                })
              }
            }
          } else {
            onSelectModule(null)
            onSelectPiece(new Set())
          }
        } else {
          // Box selection (uses world position since pieces are local to groups)
          const xMin = Math.min(dragStartRef.current.x, endX)
          const xMax = Math.max(dragStartRef.current.x, endX)
          const yMin = Math.min(dragStartRef.current.y, endY)
          const yMax = Math.max(dragStartRef.current.y, endY)
          const w = rectEnd.width, h = rectEnd.height

          const boxSelected = new Set()
          meshesRef.current.forEach(m => {
            const worldPos = new THREE.Vector3()
            m.getWorldPosition(worldPos)
            const pos = worldPos.project(cam)
            const sx = (pos.x + 1) * w / 2
            const sy = (-pos.y + 1) * h / 2
            if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
              boxSelected.add(m.userData.id)
            }
          })

          if (boxSelected.size > 0) {
            onSelectPiece(ue.shiftKey ? new Set([...stateRef.current.selectedPieceIds, ...boxSelected]) : boxSelected)
          }
        }

        setIsDragMoving(false)
        setIsDragging(false)
        setSelectionBox(null)
        controls.enabled = true
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    canvas.addEventListener('mousedown', onMouseDown)

    // Touch support — mobile orbit + pinch zoom
    let _tx = 0, _ty = 0, _td = 0
    const _getTouchDist = (t) => {
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY
      return Math.sqrt(dx*dx + dy*dy)
    }
    const onTouchStart = (e) => {
      if (e.touches.length === 1) { _tx = e.touches[0].clientX; _ty = e.touches[0].clientY }
      else if (e.touches.length === 2) { _td = _getTouchDist(e.touches) }
    }
    const onTouchMove = (e) => {
      e.preventDefault()
      const ctrl = controlsRef.current
      if (!ctrl) return
      if (e.touches.length === 1) {
        const dx = (e.touches[0].clientX - _tx) * 0.01
        const dy = (e.touches[0].clientY - _ty) * 0.01
        ctrl.rotateLeft(-dx); ctrl.rotateUp(-dy); ctrl.update()
        _tx = e.touches[0].clientX; _ty = e.touches[0].clientY
      } else if (e.touches.length === 2) {
        const nd = _getTouchDist(e.touches)
        const delta = (_td - nd) * 0.05
        ctrl.dollyIn(1 + delta * 0.05); ctrl.update()
        _td = nd
      }
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })

    // ─── Render Loop ────────────────────────────────────────────────────────
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()

      const st = stateRef.current

      // ★ PROTECTED: SketchUp white bg in wireframe, dark in solid
      scene.background.set(st.wireframe ? 0xffffff : 0x0f0f0f)
      // ★ PROTECTED: Grid visible in both modes, adapts color
      if (gridRef.current) {
        gridRef.current.visible = true
        // Update grid colors for SketchUp feel
        const gridMats = gridRef.current.material
        if (st.wireframe) {
          if (Array.isArray(gridMats)) {
            gridMats[0].color.set(0xcccccc)
            gridMats[1].color.set(0xdddddd)
          } else {
            gridMats.color.set(0xdddddd)
          }
        } else {
          if (Array.isArray(gridMats)) {
            gridMats[0].color.set(0x222222)
            gridMats[1].color.set(0x111111)
          } else {
            gridMats.color.set(0x111111)
          }
        }
      }

      let currentHover = null
      if (st.orbitMode) {
        renderer.domElement.style.cursor = 'grab'
      } else {
        raycasterRef.current.setFromCamera(mouseRef.current, cam)
        const hits = raycasterRef.current.intersectObjects(meshesRef.current)
        if (hits.length > 0) {
          currentHover = hits[0].object
          renderer.domElement.style.cursor = 'pointer'
        } else {
          renderer.domElement.style.cursor = 'default'
        }
      }

      meshesRef.current.forEach(m => {
        const ud = m.userData
        if (!ud.originalPosition) return

        // Position interpolation (exploded + drawer open)
        let target = st.exploded ? ud.explodedPosition : ud.originalPosition
        if (ud.drawerKey && st.openDrawers.has(ud.drawerKey)) {
          target = target.clone().add(new THREE.Vector3(0, 0, 40))
        }
        m.position.lerp(target, 0.15)

        const isPieceSelected = st.selectedPieceIds.has(ud.id)
        const isModuleSelected = ud.moduleId === st.selectedModuleId
        const isHovered = m === currentHover

        // ★ PROTECTED: SketchUp-style wireframe (white solid + black edges)
        if (st.wireframe) {
          m.material.wireframe = false  // Solid faces, NOT wireframe mesh
          // SketchUp style: always white/near-white faces, selection shown via subtle tint
          const isAnySelected = isPieceSelected || (isModuleSelected && st.selectedPieceIds.size === 0)
          m.material.color.set(isPieceSelected ? 0xe8f5e9 : 0xfafafa)  // Very subtle green tint only for piece selection
          m.material.opacity = isAnySelected ? 0.97 : 0.92
          m.material.roughness = 1.0
          m.material.metalness = 0.0
          m.material.emissive.set(0x000000)
          m.material.emissiveIntensity = 0
        } else {
          m.material.wireframe = false
          m.material.roughness = 0.6
          m.material.metalness = 0.1
          const targetColor = new THREE.Color(
            isPieceSelected ? SELECTION_COLOR
            : (isModuleSelected && st.selectedPieceIds.size === 0) ? MODULE_HIGHLIGHT_COLOR
            : ud.originalColor
          )
          m.material.color.lerp(targetColor, 0.2)

          const emissiveColor = new THREE.Color(
            isPieceSelected ? SELECTION_COLOR : (isHovered ? 0x333333 : 0x000000)
          )
          m.material.emissive.lerp(emissiveColor, 0.2)
          m.material.emissiveIntensity = isPieceSelected ? 0.8 : 1.0

          if (isModuleSelected && st.selectedPieceIds.size === 0) {
            m.material.emissive.lerp(new THREE.Color(MODULE_HIGHLIGHT_COLOR), 0.1)
            m.material.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.005) * 0.2
          }

          m.material.opacity = (ud.type === 'drawer_box' || ud.type === 'feet') ? 0.7 : 1.0
        }

        // ★ PROTECTED: Edge helpers — SketchUp black edges in wireframe, subtle in solid
        const edge = ud.edgeHelper
        if (edge) {
          edge.position.copy(m.position)
          edge.visible = true
          if (st.wireframe) {
            // ★ PROTECTED: SketchUp style — always black edges, blue tint only for piece selection
            edge.material.color.set(isPieceSelected ? 0x1565c0 : 0x222222)
            edge.material.opacity = 1.0
            edge.material.linewidth = 2
          } else {
            const edgeColor = isPieceSelected || isModuleSelected ? 0xffffff : 0x000000
            edge.material.color.set(edgeColor)
            edge.material.opacity = isHovered || isPieceSelected || isModuleSelected ? 0.5 : 0.1
            edge.material.linewidth = 1
          }
        }
      })

      if (currentHover) setHoveredInfo(currentHover.userData)
      else setHoveredInfo(null)

      if (composerRef.current) composerRef.current.render(); else renderer.render(scene, cam)
    }
    animate()
    if (mountRef.current) setIsReady(true)

    // ★ PLANO EJECUTIVO — expose read-only wireframe capture to parent
    // Reads renderer canvas, does NOT alter React state, modules, or physics.
    if (typeof onCaptureReady === 'function') {
      const captureWireframeDataURL = () => {
        if (!rendererRef.current || !sceneRef.current || !camRef.current) return null
        const rdr   = rendererRef.current
        const sc    = sceneRef.current
        const cam2  = camRef.current
        const meshes = meshesRef.current

        // ── Save camera state & setup Orthographic Camera ──────────────────
        const activeModule = modules.find(m => m.id === stateRef.current.selectedModuleId) || modules[0]
        const cfg = activeModule?.configuration || { width: 600, height: 720 }
        const w = (cfg.width || 600) * SCALE
        const h = (cfg.height || 720) * SCALE

        // Center calculation from bounding box
        const targetGroup = moduleGroupsRef.current[activeModule?.id] || groupRef.current
        const box = new THREE.Box3().setFromObject(targetGroup)
        const center = new THREE.Vector3()
        box.getCenter(center)

        const aspect = rdr.domElement.width / rdr.domElement.height
        let frustumHeight = h / 0.85
        let frustumWidth = frustumHeight * aspect

        if (w / frustumWidth > 0.85) {
          frustumWidth = w / 0.85
          frustumHeight = frustumWidth / aspect
        }

        const orthoCam = new THREE.OrthographicCamera(
          -frustumWidth / 2, frustumWidth / 2,
          frustumHeight / 2, -frustumHeight / 2,
          1, 1000
        )
        // Set exact frontal orthographic position looking down Z axis
        orthoCam.position.set(center.x, center.y, center.z + 300)
        orthoCam.lookAt(center)

        // ── Save current material state ──────────────────────────────────
        const saved = meshes.map(m => ({
          color:        m.material.color.getHex(),
          emissive:     m.material.emissive.getHex(),
          emissiveInt:  m.material.emissiveIntensity,
          roughness:    m.material.roughness,
          metalness:    m.material.metalness,
          opacity:      m.material.opacity,
          wireframe:    m.material.wireframe,
          edgeColor:    m.userData.edgeHelper?.material.color.getHex(),
          edgeOpacity:  m.userData.edgeHelper?.material.opacity,
        }))
        const savedBg = sc.background ? sc.background.getHex() : 0x0f0f0f
        const savedGridVis = gridRef.current?.visible

        // ── Apply wireframe/SketchUp appearance ──────────────────────────
        sc.background.set(0xffffff)
        if (gridRef.current) gridRef.current.visible = false
        meshes.forEach(m => {
          m.material.wireframe      = false
          _stashPBRMaps(m)
          m.material.color.set(0xfafafa)
          m.material.emissive.set(0x000000)
          m.material.emissiveIntensity = 0
          m.material.roughness      = 1.0
          m.material.metalness      = 0.0
          m.material.opacity        = 1.0
          if (m.userData.edgeHelper) {
            m.userData.edgeHelper.material.color.set(0x111111)
            m.userData.edgeHelper.material.opacity = 1.0
          }
        })

        // ── One-shot render with Orthographic Camera ──────────────────────
        rdr.render(sc, orthoCam)
        const dataURL = rdr.domElement.toDataURL('image/png', 1.0)

        // ── Restore ALL materials exactly ─────────────────────────────────
        meshes.forEach((m, i) => {
          const s = saved[i]
          _restorePBRMaps(m)
          m.material.color.set(s.color)
          m.material.emissive.set(s.emissive)
          m.material.emissiveIntensity = s.emissiveInt
          m.material.roughness         = s.roughness
          m.material.metalness         = s.metalness
          m.material.opacity           = s.opacity
          m.material.wireframe         = s.wireframe
          if (m.userData.edgeHelper && s.edgeColor != null) {
            m.userData.edgeHelper.material.color.set(s.edgeColor)
            m.userData.edgeHelper.material.opacity = s.edgeOpacity
          }
        })
        sc.background.set(savedBg)
        if (gridRef.current) gridRef.current.visible = savedGridVis

        return dataURL
      }
      onCaptureReady(captureWireframeDataURL)
    }

    // ★ CAPTURE ISOMÉTRICO — vista 3D en gris CAD (caras grises + aristas oscuras),
    //   ángulo isométrico. Read-only: guarda y restaura materiales/fondo/grid.
    //   Para el Plano Ejecutivo. No altera estado React, módulos ni física.
    if (typeof onIsoCaptureReady === 'function') {
      const captureIsometricDataURL = () => {
        if (!rendererRef.current || !sceneRef.current || !groupRef.current) return null
        const rdr = rendererRef.current
        const sc  = sceneRef.current
        const meshes = meshesRef.current
        if (!meshes || meshes.length === 0) return null
        const box = new THREE.Box3().setFromObject(groupRef.current)
        if (box.isEmpty()) return null
        const center = new THREE.Vector3(); box.getCenter(center)
        const size = new THREE.Vector3(); box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z) || 10
        const aspect = rdr.domElement.width / rdr.domElement.height
        const isoCam = new THREE.PerspectiveCamera(32, aspect, 1, 100000)
        const dir = new THREE.Vector3(1, 0.8, 1).normalize()
        isoCam.position.copy(center).add(dir.multiplyScalar(maxDim * 2.3))
        isoCam.lookAt(center)
        const saved = meshes.map(m => ({
          color: m.material.color.getHex(), emissive: m.material.emissive.getHex(),
          emissiveInt: m.material.emissiveIntensity, roughness: m.material.roughness,
          metalness: m.material.metalness, opacity: m.material.opacity, wireframe: m.material.wireframe,
          edgeColor: m.userData.edgeHelper?.material.color.getHex(),
          edgeOpacity: m.userData.edgeHelper?.material.opacity,
        }))
        const savedBgObj = sc.background
        const savedClear = new THREE.Color(); rdr.getClearColor(savedClear)
        const savedClearAlpha = rdr.getClearAlpha()
        const savedGridVis = gridRef.current?.visible
        // ★ fondo transparente: el mueble (caras con volumen + aristas negras) se apoya
        //   sobre la hoja del plano, sin rectángulo gris de fondo.
        sc.background = null
        rdr.setClearColor(0x000000, 0)
        if (gridRef.current) gridRef.current.visible = false
        meshes.forEach(m => {
          m.material.wireframe = false
          _stashPBRMaps(m)
          m.material.color.set(0xd7dade)
          m.material.emissive.set(0x000000)
          m.material.emissiveIntensity = 0
          m.material.roughness = 1.0
          m.material.metalness = 0.0
          m.material.opacity = 1.0
          if (m.userData.edgeHelper) {
            m.userData.edgeHelper.material.color.set(0x1f2226)
            m.userData.edgeHelper.material.opacity = 1.0
          }
        })
        rdr.render(sc, isoCam)
        const dataURL = rdr.domElement.toDataURL('image/png', 1.0)
        meshes.forEach((m, i) => {
          const sv = saved[i]
          _restorePBRMaps(m)
          m.material.color.set(sv.color); m.material.emissive.set(sv.emissive)
          m.material.emissiveIntensity = sv.emissiveInt; m.material.roughness = sv.roughness
          m.material.metalness = sv.metalness; m.material.opacity = sv.opacity; m.material.wireframe = sv.wireframe
          if (m.userData.edgeHelper && sv.edgeColor != null) {
            m.userData.edgeHelper.material.color.set(sv.edgeColor)
            m.userData.edgeHelper.material.opacity = sv.edgeOpacity
          }
        })
        sc.background = savedBgObj
        rdr.setClearColor(savedClear, savedClearAlpha)
        if (gridRef.current) gridRef.current.visible = savedGridVis
        return dataURL
      }
      onIsoCaptureReady(captureIsometricDataURL)
    }

    // ★ CAPTURE CAD (front/top/iso) — 3 vistas del MISMO modelo, gris CAD, fondo
    //   transparente. Devuelve {url,fx,fy}; fx,fy = fracción del canvas que ocupa el
    //   mueble (para alinear cotas vectoriales en el plano). Read-only, restaura todo.
    if (typeof onCadCaptureReady === 'function') {
      const captureCadView = (kind) => {
        if (!rendererRef.current || !sceneRef.current || !groupRef.current) return null
        const rdr = rendererRef.current, sc = sceneRef.current, meshes = meshesRef.current
        if (!meshes || meshes.length === 0) return null
        const box = new THREE.Box3().setFromObject(groupRef.current)
        if (box.isEmpty()) return null
        const center = new THREE.Vector3(); box.getCenter(center)
        const size = new THREE.Vector3(); box.getSize(size)
        const CW = rdr.domElement.width, CH = rdr.domElement.height
        const aspect = CW / CH, maxDim = Math.max(size.x, size.y, size.z) || 10
        let cam, fx = 1, fy = 1
        if (kind === 'iso') {
          cam = new THREE.PerspectiveCamera(32, aspect, 1, 100000)
          const dir = new THREE.Vector3(1, 0.8, 1).normalize()
          cam.position.copy(center).add(dir.multiplyScalar(maxDim * 2.3)); cam.lookAt(center)
        } else {
          const viewW = size.x, viewH = (kind === 'top') ? size.z : size.y
          let fw = viewW * 1.08, fh = viewH * 1.08
          if (fw / fh > aspect) fh = fw / aspect; else fw = fh * aspect
          fx = viewW / fw; fy = viewH / fh
          cam = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, maxDim * 8)
          if (kind === 'top') { cam.position.set(center.x, center.y + maxDim * 3, center.z); cam.up.set(0, 0, -1) }
          else { cam.position.set(center.x, center.y, center.z + maxDim * 3); cam.up.set(0, 1, 0) }
          cam.lookAt(center)
        }
        const saved = meshes.map(m => ({
          color: m.material.color.getHex(), emissive: m.material.emissive.getHex(),
          emissiveInt: m.material.emissiveIntensity, roughness: m.material.roughness,
          metalness: m.material.metalness, opacity: m.material.opacity, wireframe: m.material.wireframe,
          edgeColor: m.userData.edgeHelper?.material.color.getHex(),
          edgeOpacity: m.userData.edgeHelper?.material.opacity,
        }))
        const savedBgObj = sc.background
        const savedClear = new THREE.Color(); rdr.getClearColor(savedClear)
        const savedClearAlpha = rdr.getClearAlpha()
        const savedGridVis = gridRef.current?.visible
        sc.background = null
        rdr.setClearColor(0x000000, 0)
        if (gridRef.current) gridRef.current.visible = false
        meshes.forEach(m => {
          m.material.wireframe = false
          _stashPBRMaps(m)
          m.material.color.set(0xd7dade)
          m.material.emissive.set(0x000000); m.material.emissiveIntensity = 0
          m.material.roughness = 1.0; m.material.metalness = 0.0; m.material.opacity = 1.0
          if (m.userData.edgeHelper) { m.userData.edgeHelper.material.color.set(0x1f2226); m.userData.edgeHelper.material.opacity = 1.0 }
        })
        rdr.render(sc, cam)
        const url = rdr.domElement.toDataURL('image/png', 1.0)
        meshes.forEach((m, i) => {
          const sv = saved[i]
          _restorePBRMaps(m)
          m.material.color.set(sv.color); m.material.emissive.set(sv.emissive)
          m.material.emissiveIntensity = sv.emissiveInt; m.material.roughness = sv.roughness
          m.material.metalness = sv.metalness; m.material.opacity = sv.opacity; m.material.wireframe = sv.wireframe
          if (m.userData.edgeHelper && sv.edgeColor != null) { m.userData.edgeHelper.material.color.set(sv.edgeColor); m.userData.edgeHelper.material.opacity = sv.edgeOpacity }
        })
        sc.background = savedBgObj
        rdr.setClearColor(savedClear, savedClearAlpha)
        if (gridRef.current) gridRef.current.visible = savedGridVis
        return { url, fx, fy }
      }
      onCadCaptureReady(captureCadView)
    }

    // ★ Cleanup: cancela loop y event listeners al desmontar
    return () => {
      initRef.current = false
      if (composerRef.current) { try { composerRef.current.dispose() } catch (_) {} composerRef.current = null }
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ★ FIX: Delete key handler REMOVED from Viewer3D — App.jsx lo maneja centralmente.
  // Tener dos handlers causaba doble llamado a onDeleteModule → historial corrupto → error en Ctrl+Z.


  // ★ Premium: Smooth camera focus on module selection
  const cameraTargetRef = useRef(null)
  useEffect(() => {
    if (!selectedModuleId || !moduleGroupsRef.current[selectedModuleId]) return
    const mGroup = moduleGroupsRef.current[selectedModuleId]
    const box = new THREE.Box3().setFromObject(mGroup)
    const center = new THREE.Vector3()
    box.getCenter(center)
    cameraTargetRef.current = center
    // Smooth orbit target transition
    const controls = controlsRef.current
    if (controls) {
      const startTarget = controls.target.clone()
      const startTime = Date.now()
      const duration = 600
      const smoothFocus = () => {
        const elapsed = Date.now() - startTime
        const t = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3)
        controls.target.lerpVectors(startTarget, center, ease)
        controls.update()
        if (t < 1) requestAnimationFrame(smoothFocus)
      }
      smoothFocus()
    }
  }, [selectedModuleId])

  // ─── 2. Build Geometry from Configuration (Parametric Construction Logic) ──
  useEffect(() => {
    // ★ FIX: Guard on rendererRef (persists across StrictMode remount) instead of
    //   `isReady` state (which resets to false on remount, blocking geometry forever).
    if (!rendererRef.current) return
    if (!groupRef.current) return

    const group = groupRef.current
    const scene = sceneRef.current

    // ★ FIX: When all modules are deleted, clear geometry completely
    if (!modules || modules.length === 0) {
      while (group.children.length > 0) {
        const child = group.children[0]
        group.remove(child)
        child.traverse?.((obj) => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
            else obj.material.dispose()
          }
        })
      }
      // Clean stray edge helpers from scene root
      if (scene) {
        const toRemove = []
        scene.traverse((obj) => { if (obj.userData?._isEdge) toRemove.push(obj) })
        toRemove.forEach(o => { scene.remove(o); o.geometry?.dispose(); o.material?.dispose() })
      }
      meshesRef.current = []
      moduleGroupsRef.current = {}
      modulePositionsRef.current = {}
      return
    }

    const isFirstBuild = meshesRef.current.length === 0

    // ★ PROTECTED: Save existing module positions before rebuild
    Object.entries(moduleGroupsRef.current).forEach(([modId, mGrp]) => {
      if (mGrp && mGrp.position) {
        modulePositionsRef.current[modId] = { x: mGrp.position.x, z: mGrp.position.z }
      }
    })

    // Clear previous geometry (edges inside mGroups cleaned automatically)
    while (group.children.length > 0) {
      const child = group.children[0]
      group.remove(child)
      child.traverse?.((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
    }
    // Clear stray edge helpers from scene root (fallback builder)
    if (scene) {
      const toRemove = []
      scene.children.forEach(obj => {
        if (obj.isLineSegments && obj.userData._isEdge) toRemove.push(obj)
      })
      toRemove.forEach(obj => {
        scene.remove(obj)
        obj.geometry?.dispose()
        obj.material?.dispose()
      })
    }
    meshesRef.current = []
    moduleGroupsRef.current = {}
    // ★ PROTECTED: Clean stale position cache (modules that were deleted)
    const activeIds = new Set(modules.map(m => m.id))
    Object.keys(modulePositionsRef.current).forEach(k => {
      if (!activeIds.has(k)) delete modulePositionsRef.current[k]
    })
    // ★ Clean snap guide lines
    snapLinesRef.current.forEach(l => { scene?.remove(l); l.geometry?.dispose(); l.material?.dispose() })
    snapLinesRef.current = []

    // ★ PROTECTED: Find rightmost edge of EXISTING modules for new module placement
    let maxRightEdge = 0
    modules.forEach((design) => {
      const cfg = design?.configuration
      if (!cfg) return
      const W = (cfg.width || 600) * SCALE
      const saved = modulePositionsRef.current[design.id]
      if (saved) {
        const rightEdge = saved.x + W / 2
        if (rightEdge > maxRightEdge) maxRightEdge = rightEdge
      }
    })

    let currentXOffset = 0  // ★ FIX: fallback offset for legacy pieces (not used by cfg-based modules)

    modules.forEach((design, dIdx) => {
      const cfg = design?.configuration

      // ★ PROTECTED: Skip hidden modules (layers panel visibility)
      if (hiddenModules.has(design.id)) {
        currentXOffset += ((cfg?.width || 600) * SCALE) + 5
        return
      }

      // If no configuration, try to build from pieces array (fallback)
      if (!cfg) {
        buildFromPieces(design, dIdx, group, currentXOffset)
        currentXOffset += 100
        return
      }

      const W  = (cfg.width  || 600) * SCALE
      const H  = (cfg.height || 720) * SCALE
      const D  = (cfg.depth  || 580) * SCALE
      const T  = (cfg.thickness || 18) * SCALE
      const BT = (cfg.backThickness || 6) * SCALE
      const BH = (cfg.baseboardHeight || 100) * SCALE

      // Helper: create a mesh with edge helper
      const makeMesh = (w, h, d, color, pieceName, type, drawerKey = null) => {
        const geo = new THREE.BoxGeometry(w, h, d)
        // ★ Premium material: type-aware surface properties using PBR
        const mat = getPBRMaterial(type, color)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const edgesGeo = new THREE.EdgesGeometry(geo)
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 })
        const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
        edgeHelper.userData._isEdge = true

        mesh.userData = {
          id: `${design.id}::${type}::${pieceName.replace(/\s+/g, '_')}`,
          moduleId: design.id,
          w: w / SCALE, h: h / SCALE, d: d / SCALE,
          name: pieceName,
          type,
          originalColor: color,
          drawerKey,
          edgeHelper,
        }

        meshesRef.current.push(mesh)
        // ★ Edge added to mGroup after all pieces (not to scene directly)
        return mesh
      }

      const mGroup = new THREE.Group()
      // ★ PROTECTED: Position module using saved location or place after rightmost module
      // ★ AEREO FIX: Wall-mounted modules are elevated by mountHeight (default 1400mm for kitchen, 1600mm for bathroom)
      const isAereoModule = cfg.moduleType === 'aereo'
      const mountY = isAereoModule ? ((cfg.mountHeight || 1400) * SCALE) : 0
      const saved = modulePositionsRef.current[design.id]
      if (saved) {
        mGroup.position.x = saved.x
        mGroup.position.z = saved.z
        mGroup.position.y = saved.y !== undefined ? saved.y : mountY
      } else {
        const newX = maxRightEdge + W / 2  // ★ FIX: módulos tocan sin gap para unificar encimera
        mGroup.position.x = newX
        mGroup.position.y = mountY
        maxRightEdge = newX + W / 2
        modulePositionsRef.current[design.id] = { x: newX, z: 0, y: mountY }
      }
      moduleGroupsRef.current[design.id] = mGroup
      mGroup.userData.moduleId = design.id
      mGroup.userData.moduleWidth = W
      const xOffset = 0  // ★ PROTECTED: Pieces positioned relative to module center

      const bodyColor  = MATERIAL_COLORS[cfg.materialId] || MATERIAL_COLORS[cfg.materialBody]  || TYPE_COLORS.structural
      const frontColor = MATERIAL_COLORS[cfg.materialId] || MATERIAL_COLORS[cfg.materialFront] || TYPE_COLORS.drawer_front
      const ctColor    = MATERIAL_COLORS[cfg.countertopMaterial] || TYPE_COLORS.countertop

      const yBase = 0
      const iW = W - 2 * T  // internal width

      // === LATERAL LEFT ===
      const lp = makeMesh(T, H, D, bodyColor, 'Lateral Izquierdo', 'structural')
      lp.position.set(-W / 2 + T / 2 + xOffset, yBase + H / 2, D / 2)
      mGroup.add(lp)

      // === LATERAL RIGHT ===
      const rp = makeMesh(T, H, D, bodyColor, 'Lateral Derecho', 'structural')
      rp.position.set(W / 2 - T / 2 + xOffset, yBase + H / 2, D / 2)
      mGroup.add(rp)

      // === TOP ===
      const tp = makeMesh(iW, T, D, bodyColor, 'Techo', 'structural')
      tp.position.set(xOffset, yBase + H - T / 2, D / 2)
      mGroup.add(tp)

      // === BOTTOM ===
      const bp = makeMesh(iW, T, D, bodyColor, 'Base', 'structural')
      bp.position.set(xOffset, yBase + BH + T / 2, D / 2)
      mGroup.add(bp)

      // === BACK PANEL ===
      const fullBkH = H - BH - T - T
      const bk = makeMesh(iW, fullBkH, BT, bodyColor, 'Fondo', 'structural')
      bk.position.set(xOffset, yBase + BH + T + fullBkH / 2, BT / 2 + 0.01)
      mGroup.add(bk)

      const iD = D - BT - 0.2
      const zCenter = BT + iD / 2 + 0.1

      // === BASEBOARD / FEET ===
      if (cfg.baseboard !== false) {
        const fr = makeMesh(iW, BH, T, bodyColor, 'Zocalo Frontal', 'baseboard')
        fr.position.set(xOffset, BH / 2, D - T / 2 - 5)
        mGroup.add(fr)

        for (const fx of [-1, 1]) {
          const foot = makeMesh(3, BH, 3, 0x222222, 'Pata', 'feet')
          foot.position.set(xOffset + fx * (iW / 2 - 4), BH / 2, D / 2)
          mGroup.add(foot)
        }
      }

      // === COUNTERTOP ===
      // ★ Individual countertops suppressed — handled by UNIFIED COUNTERTOP SYSTEM below
      // (Countertops are merged across adjacent modules into a single slab)

      // === DRAWERS ===
      const nD = cfg.numDrawers || 0
      const isHorizontal = cfg.drawerLayout === 'horizontal'
      const maxDH = (H - BH - 2 * T) / (isHorizontal ? Math.ceil(nD / 2) : nD)
      const dH = Math.min((cfg.drawerHeight || 180) * SCALE, maxDH)
      let curY = yBase + BH + T

      // Gaveta REAL como caja abierta (5 paneles) — refleja la lista de corte:
      // 2 laterales + frente interno + trasera interna + fundo. Sin tapa (abierta).
      // Reemplaza el antiguo "Cuerpo Gaveta" sólido. No toca la fabricación.
      const addDrawerBox = (cx, cy, boxW, boxH, boxD, cz, key) => {
        const wall = T
        const bt = Math.max(0.3, T * 0.5) // fundo más fino (6mm)
        const col = TYPE_COLORS.drawer_box
        const add = (w, h, d, x, y, z, name) => {
          const mesh = makeMesh(w, h, d, col, name, 'drawer_box', key)
          mesh.position.set(x, y, z); mGroup.add(mesh)
        }
        add(wall, boxH, boxD, cx - boxW / 2 + wall / 2, cy, cz, 'Lateral Cajón')
        add(wall, boxH, boxD, cx + boxW / 2 - wall / 2, cy, cz, 'Lateral Cajón')
        add(boxW - 2 * wall, boxH, wall, cx, cy, cz + boxD / 2 - wall / 2, 'Frente Interno Cajón')
        add(boxW - 2 * wall, boxH, wall, cx, cy, cz - boxD / 2 + wall / 2, 'Trasera Cajón')
        add(boxW - 2 * wall, bt, boxD - 2 * wall, cx, cy - boxH / 2 + bt / 2, cz, 'Fondo Cajón')
      }

      if (nD > 0) {
        if (isHorizontal) {
          const colW = iW / 2
          const drawersPerCol = Math.ceil(nD / 2)
          for (let col = 0; col < 2; col++) {
            let colY = yBase + BH + T
            const startX = xOffset - iW / 2 + colW / 2 + col * colW
            for (let i = 0; i < drawersPerCol; i++) {
              if (col * drawersPerCol + i >= nD) break
              const dKey = `m${dIdx}-d${col}-${i}`
              const df = makeMesh(colW - 0.4, dH - 0.4, T, frontColor, `Frente Gaveta H-${col + 1}-${i + 1}`, 'drawer_front', dKey)
              df.position.set(startX, colY + dH / 2, D - T / 2)
              mGroup.add(df)
              addDrawerBox(startX, colY + dH / 2, colW - 3, dH - 4, iD - 4, zCenter, dKey)
              colY += dH
            }
          }
          curY += Math.ceil(nD / 2) * dH
        } else {
          for (let i = 0; i < nD; i++) {
            const dKey = `m${dIdx}-d${i}`
            const df = makeMesh(iW - 0.4, dH - 0.4, T, frontColor, `Frente Gaveta ${i + 1}`, 'drawer_front', dKey)
            df.position.set(xOffset, curY + dH / 2, D - T / 2)
            mGroup.add(df)
            addDrawerBox(xOffset, curY + dH / 2, iW - 3, dH - 4, iD - 4, zCenter, dKey)
            curY += dH
          }
        }
      }

      // === DOORS ===
      if (cfg.hasDoors) {
        const nDoors = cfg.numDoors || 2
        const doorW = iW / nDoors
        const doorH = H - (curY - yBase) - T
        const doorY = curY + doorH / 2

        for (let i = 0; i < nDoors; i++) {
          const doorX = xOffset - iW / 2 + doorW / 2 + i * doorW
          const door = makeMesh(doorW - 0.5, doorH - 0.4, T, frontColor, `Puerta ${i + 1}`, 'standard_door')
          door.position.set(doorX, doorY, D - T / 2)
          mGroup.add(door)
        }
      }

      // === DIVIDERS ===
      // ★ PROTECTED: Central dividers must STOP at the drawer zone.
      // When drawers exist (any layout), divider goes from above drawers to top only.
      // When no drawers, divider spans full internal height.
      const nDiv = cfg.numDividers || 0
      if (nDiv > 0) {
        let divStartY, divHeight
        if (nD > 0) {
          // Divider only in the shelf/door zone ABOVE the drawers
          divStartY = curY
          divHeight = H - (curY - yBase) - T
        } else {
          // No drawers — full internal height
          divStartY = yBase + BH + T
          divHeight = H - BH - 2 * T
        }
        if (divHeight > T) {
          const divSpacing = iW / (nDiv + 1)
          for (let i = 1; i <= nDiv; i++) {
            const divX = xOffset - iW / 2 + divSpacing * i
            const div = makeMesh(T, divHeight, iD - 1, bodyColor, `Divisor ${i}`, 'structural')
            div.position.set(divX, divStartY + divHeight / 2, zCenter)
            mGroup.add(div)
          }
        }
      }

      // === SHELVES ===
      const nS = cfg.numShelves || 0
      if (nS > 0) {
        // Separator after drawers
        if (nD > 0 && curY < yBase + H - T) {
          const tapa = makeMesh(iW, T, iD, bodyColor, 'Divisoria H', 'shelf')
          tapa.position.set(xOffset, curY + T / 2, zCenter)
          mGroup.add(tapa)
          curY += T
        }
        const remainingH = H - (curY - yBase) - T
        const spacing = remainingH / (nS + 1)
        for (let i = 0; i < nS; i++) {
          const s = makeMesh(iW - 0.2, T, iD - 2.5, bodyColor, `Estante ${i + 1}`, 'shelf')
          s.position.set(xOffset, curY + spacing * (i + 1), zCenter + 1)
          mGroup.add(s)
        }
      }

      // ★ PROTECTED: Add edge helpers to module group for correct drag positioning
      meshesRef.current
        .filter(m => m.userData.moduleId === design.id && m.userData.edgeHelper)
        .forEach(m => mGroup.add(m.userData.edgeHelper))

      group.add(mGroup)
    })

    // ─── UNIFIED COUNTERTOP SYSTEM ────────────────────────────────────────────
    // After all module groups are built, detect X-adjacent chains and render
    // a single merged countertop slab spanning the full width of each chain.
    // This eliminates the seam / gap between side-by-side module countertops.
    {
      // ★ FIX: auto-include base/kitchen modules even if hasCountertop not explicitly set
      const BASE_TYPES = new Set(['base', 'kitchen_base', 'base_cocina', 'cocina_base', 'base_kitchen'])
      const ctModules = modules.filter(m => {
        const cfg = m?.configuration
        const isBase = BASE_TYPES.has(cfg?.moduleType) || BASE_TYPES.has(m?.type)
        return (cfg?.hasCountertop || isBase) && !hiddenModules.has(m.id) && moduleGroupsRef.current[m.id]
      })

      if (ctModules.length > 0) {
        // ★ Compute bounding boxes directly from config + mGroup.position
        // (avoids world-matrix update race — setFromObject needs a render pass first)
        const ctBoxes = ctModules
          .map(m => {
            const cfg  = m.configuration
            const W    = (cfg.width  || 600) * SCALE
            const H    = (cfg.height || 720) * SCALE
            const D    = (cfg.depth  || 580) * SCALE
            const mGrp = moduleGroupsRef.current[m.id]
            return {
              module: m,
              box: {
                min: { x: mGrp.position.x - W / 2, y: 0,  z: 0 },
                max: { x: mGrp.position.x + W / 2, y: H,  z: D },
              }
            }
          })
          .sort((a, b) => a.box.min.x - b.box.min.x)   // order left → right

        // Tolerance constants (scene units: 1 unit = 10 mm)
        const X_TOUCH = 15   // ≈ 150 mm gap tolerance — catches default placement + snapped modules
        const Z_ALIGN = 15   // ≈ 150 mm front-face depth alignment tolerance

        // Build adjacency chains (all values are plain numbers now)
        const chains = [[ctBoxes[0]]]
        for (let i = 1; i < ctBoxes.length; i++) {
          const prev = ctBoxes[i - 1]
          const curr = ctBoxes[i]
          const xGap  = curr.box.min.x - prev.box.max.x
          const zDiff = Math.abs(curr.box.max.z - prev.box.max.z)
          if (xGap <= X_TOUCH && zDiff <= Z_ALIGN) {
            chains[chains.length - 1].push(curr)
          } else {
            chains.push([curr])
          }
        }


        // Create one unified slab per chain
        chains.forEach(chain => {
          const xMin   = chain[0].box.min.x
          const xMax   = chain[chain.length - 1].box.max.x
          const topY   = Math.max(...chain.map(c => c.box.max.y))
          const frontZ = Math.max(...chain.map(c => c.box.max.z))
          const backZ  = Math.min(...chain.map(c => c.box.min.z))

          const cfg0     = chain[0].module.configuration
          const ctColor  = MATERIAL_COLORS[cfg0.countertopMaterial] || TYPE_COLORS.countertop

          const ctW = (xMax - xMin)
          const ctD = (frontZ - backZ) + 2 // 10 mm overhang front + back
          const ctH = 3                    // 30 mm slab thickness

          const geo = new THREE.BoxGeometry(ctW, ctH, ctD)
          const mat = getPBRMaterial('countertop', ctColor)
          const ct  = new THREE.Mesh(geo, mat)
          ct.castShadow    = true
          ct.receiveShadow = true
          const ctPosX = (xMin + xMax) / 2
          const ctPosY = topY + ctH / 2
          const ctPosZ = backZ + ctD / 2 - 1
          ct.position.set(ctPosX, ctPosY, ctPosZ)

          const edgesGeo   = new THREE.EdgesGeometry(geo)
          const edgesMat   = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })
          const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
          edgeHelper.userData._isEdge = true
          edgeHelper.position.set(ctPosX, ctPosY, ctPosZ)   // ★ Fix: sync edgeHelper with slab

          const slabName = chain.length > 1
            ? `Encimera Unificada (${chain.length} módulos)`
            : 'Encimera'

          ct.userData = {
            id:            `unified-ct-${chain.map(c => c.module.id).join('_')}-${Math.random().toString(36).substr(2, 5)}`,
            moduleId:      chain[0].module.id,
            w:             Math.round(ctW / SCALE),
            h:             Math.round(ctH / SCALE),
            d:             Math.round(ctD / SCALE),
            name:          slabName,
            type:          'countertop',
            originalColor: ctColor,
            edgeHelper,
          }

          meshesRef.current.push(ct)
          group.add(ct)           // lives in parent group — spans module boundaries
          group.add(edgeHelper)
        })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Set original + exploded positions
    const bbox = new THREE.Box3().setFromObject(group)
    if (bbox.isEmpty()) return
    const bCenter = new THREE.Vector3()
    bbox.getCenter(bCenter)

    meshesRef.current.forEach(m => {
      m.userData.originalPosition = m.position.clone()
      // ★ Use world position for explosion direction (pieces are local to module group)
      const worldPos = new THREE.Vector3()
      m.getWorldPosition(worldPos)
      m.userData.explodedPosition = m.position.clone().add(
        worldPos.sub(bCenter).normalize().multiplyScalar(5)
      )
    })

    // ★ PROTECTED: Auto-frame camera only on first build (preserves view when adding modules)
    if (isFirstBuild && controlsRef.current && camRef.current) {
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z) || 10
      const fov = camRef.current.fov * (Math.PI / 180)
      const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8
      camRef.current.position.set(
        bCenter.x + cameraDistance * 0.5,
        bCenter.y + size.y * 0.4,
        bCenter.z + cameraDistance
      )
      controlsRef.current.target.copy(bCenter)
      controlsRef.current.update()
    }
  }, [modules, hiddenModules])

  // --- Fallback: build from raw pieces array ---
  function buildFromPieces(design, dIdx, group, xOff) {
    const pieces = design.pieces || design.piezas || []
    if (!pieces.length) return
    const scene = sceneRef.current

    const mGroup = new THREE.Group()
    mGroup.position.x = xOff

    pieces.forEach((p, i) => {
      const w = (p.width || 100) * SCALE
      const h = (p.height || 100) * SCALE
      const d = (p.thickness || 18) * SCALE
      const color = TYPE_COLORS[p.type] || TYPE_COLORS.structural

      const geo = new THREE.BoxGeometry(w, h, d)
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04, transparent: true, envMapIntensity: 0.5 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.position.set((p.x || 0) * SCALE, (p.y || 0) * SCALE, (p.z || 0) * SCALE)

      const edgesGeo = new THREE.EdgesGeometry(geo)
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 })
      const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
      edgeHelper.userData._isEdge = true

      const pos = mesh.position.clone()
      mesh.userData = {
        id: p.id || `piece-${dIdx}-${i}`,
        moduleId: design.id,
        w: p.width, h: p.height, d: p.thickness,
        name: p.name || p.type,
        type: p.type,
        originalColor: color,
        edgeHelper,
        // ★ FIX: exploded-view animation requires these on ALL meshes (incl. fallback builder)
        originalPosition: pos,
        explodedPosition: pos.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          )
        ),
      }

      meshesRef.current.push(mesh)
      mGroup.add(mesh)
      if (scene) scene.add(edgeHelper)
    })

    group.add(mGroup)
  }

  // --- Export PNG ---
  const handleExport = useCallback(() => {
    if (!rendererRef.current) return
    const link = document.createElement('a')
    link.download = `orbin-design-${Date.now()}.png`
    link.href = rendererRef.current.domElement.toDataURL('image/png')
    link.click()
  }, [])

  // --- Zoom controls (+ / - buttons) ---
  // Moves the camera along the vector to the orbit target. Distance is clamped
  // so the user can't zoom through the model or fly off to infinity. Works with
  // OrbitControls (perspective camera) and respects the current pan target.
  const zoomCamera = useCallback((direction) => {
    const cam = camRef.current
    const controls = controlsRef.current
    if (!cam || !controls) return
    const factor = direction === 'in' ? 0.82 : 1.22
    const offset = new THREE.Vector3().subVectors(cam.position, controls.target)
    const minDist = controls.minDistance || 20
    const maxDist = controls.maxDistance && controls.maxDistance !== Infinity ? controls.maxDistance : 4000
    const nextLen = Math.max(minDist, Math.min(maxDist, offset.length() * factor))
    offset.setLength(nextLen)
    cam.position.copy(controls.target).add(offset)
    controls.update()
  }, [])

  // --- Empty State ---
  const isEmpty = modules.length === 0

  // --- AR Export Logic ---
  const handleViewInAR = useCallback(() => {
    if (!groupRef.current) return
    setIsExportingAR(true)

    // Dynamically load model-viewer if not present
    if (!document.querySelector('script[src*="model-viewer"]')) {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js'
      document.head.appendChild(script)
    }

    const exporter = new GLTFExporter()
    const exportGroup = groupRef.current.clone()
    
    // ★ AR SCALE FIX: 
    // Orbin SCALE = 0.1 (1 unit = 10mm). 
    // AR requires 1 unit = 1 meter (1000mm).
    // Therefore, multiply by 0.01 to convert to meters.
    exportGroup.scale.set(0.01, 0.01, 0.01)

    // Center geometry and align to floor for AR
    const box = new THREE.Box3().setFromObject(exportGroup)
    const center = box.getCenter(new THREE.Vector3())
    const bottom = box.min.y
    exportGroup.position.sub(center)
    exportGroup.position.y += (center.y - bottom)

    exporter.parse(
      exportGroup,
      (gltf) => {
        const blob = new Blob([gltf], { type: 'model/gltf-binary' })
        const url = URL.createObjectURL(blob)
        setArModelUrl(url)
        setIsExportingAR(false)
      },
      (error) => {
        console.error('AR Export Error:', error)
        setIsExportingAR(false)
      },
      { binary: true }
    )
  }, [])

  // ★ FIX: Inyectar botón AR de forma imperativa para evitar conflicto
  //   React slot → shadow DOM → removeChild crash
  useEffect(() => {
    const mv = modelViewerRef.current
    if (!mv || !arModelUrl) return
    const btn = document.createElement('button')
    btn.setAttribute('slot', 'ar-button')
    btn.style.cssText = 'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:white;color:black;padding:12px 24px;border-radius:9999px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);border:none;cursor:pointer;z-index:60'
    btn.textContent = '📍 Iniciar Realidad Aumentada'
    mv.appendChild(btn)
    return () => { try { mv.removeChild(btn) } catch {} }
  }, [arModelUrl])

  return (
    <div className="relative w-full h-full group select-none overflow-hidden" style={{ minHeight: 'clamp(260px, 45vw, 600px)' }}>
      <canvas ref={mountRef} className="absolute inset-0 w-full h-full block" style={{ minHeight: 'clamp(260px, 45vw, 600px)' }} />

      {/* ★ PROTECTED: Drag-to-move indicator */}
      {isDragMoving && (
        <div className="absolute top-4 right-16 bg-[#00AAFF]/20 backdrop-blur-md border border-[#00AAFF]/40 px-3 py-1.5 rounded-full z-30 pointer-events-none">
          <span className="text-[#00AAFF] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <GripVertical size={12} /> Moviendo módulo
          </span>
        </div>
      )}

      {/* Box selection overlay */}
      {isDragging && selectionBox && (
        <div
          className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-30"
          style={{
            left: Math.min(selectionBox.start.x, selectionBox.end.x),
            top: Math.min(selectionBox.start.y, selectionBox.end.y),
            width: Math.abs(selectionBox.start.x - selectionBox.end.x),
            height: Math.abs(selectionBox.start.y - selectionBox.end.y),
          }}
        />
      )}

      {/* Loading */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f] z-40">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <Box size={64} className="text-white/10 mb-4" />
          <p className="text-white/30 text-sm font-bold uppercase tracking-widest">{t('empty_viewer') || 'Configure y genere su mueble'}</p>
          <p className="text-white/15 text-xs mt-2 uppercase tracking-wider">{t('empty_viewer_hint') || 'Use el panel izquierdo para definir parametros'}</p>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredInfo && (
        <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-xl border border-border/50 p-4 rounded-2xl pointer-events-none shadow-2xl z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${selectedPieceIds.size > 0 ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {selectedPieceIds.size > 1 ? `${selectedPieceIds.size} piezas` : (hoveredInfo?.type || 'info')}
            </span>
          </div>
          <h4 className="text-sm font-bold text-white">{hoveredInfo?.name || 'Pieza'}</h4>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { l: 'W', v: hoveredInfo?.w },
              { l: 'H', v: hoveredInfo?.h },
              { l: 'D', v: hoveredInfo?.d },
            ].map(d => d.v ? (
              <div key={d.l} className="bg-black/20 p-1 rounded text-center">
                <span className="text-[9px] text-muted block">{d.l}</span>
                <span className="text-[11px] font-mono text-primary">{Math.round(d.v)}</span>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* ★ PROTECTED: Ruler measurement display */}
      {rulerMode && rulerPoints.length === 2 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#00FF99]/10 backdrop-blur-md border border-[#00FF99]/40 px-4 py-2 rounded-full z-30 pointer-events-none">
          <span className="text-[#00FF99] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Ruler size={12} /> {rulerDistance} mm
          </span>
        </div>
      )}

      {/* ─── PROFESSIONAL CAD TOOLBAR (SketchUp style - Always Visible) ─── */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 flex flex-col gap-3 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl z-30 transition-all duration-300 hover:border-white/20">
        {/* Selection Mode */}
        <button
          onClick={() => { setOrbitMode(false); setRulerMode(false); }}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            !orbitMode && !rulerMode
              ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]'
              : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Scan size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Modo Selección (Abrir puertas/cajones)' : lang === 'PT' ? 'Modo Seleção' : 'Selection Mode'}
          </span>
        </button>

        {/* Orbit Mode */}
        <button
          onClick={() => { setOrbitMode(true); setRulerMode(false); }}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            orbitMode && !rulerMode
              ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]'
              : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Move size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Modo Órbita (Girar Cámara)' : lang === 'PT' ? 'Modo Órbita' : 'Orbit Mode'}
          </span>
        </button>

        <div className="h-px bg-white/10 mx-1.5" />

        {/* Ruler tool - NEON GREEN */}
        <button
          onClick={() => { setRulerMode(m => !m); setRulerPoints([]); setRulerDistance(null) }}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            rulerMode
              ? 'bg-[#00FF99] text-black shadow-[0_0_15px_rgba(0,255,153,0.4)] font-bold'
              : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Ruler size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Cinta Métrica / Medición' : lang === 'PT' ? 'Trena de Medição' : 'Tape Measure'}
          </span>
        </button>

        <div className="h-px bg-white/10 mx-1.5" />

        {/* Exploded View */}
        <button
          onClick={() => setExploded(e => !e)}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            exploded
              ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]'
              : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Maximize size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Vista Explosionada' : lang === 'PT' ? 'Vista Explodida' : 'Exploded View'}
          </span>
        </button>

        {/* Wireframe Mode */}
        <button
          onClick={() => setWireframe(w => !w)}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            wireframe
              ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]'
              : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Layers size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Modo Estructura / Alambre' : lang === 'PT' ? 'Modo Estrutura' : 'Wireframe Mode'}
          </span>
        </button>
      </div>

      {/* Floating Operations Bar (Module Operations - Always Visible and Clean) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-2 px-4 rounded-full border border-white/10 shadow-2xl z-20">
        <button
          onClick={() => setIsPresentationMode(true)}
          className="p-2.5 rounded-full hover:bg-white/10 text-white transition-all flex items-center justify-center"
          title={lang === 'ES' ? 'Modo Presentación' : lang === 'PT' ? 'Modo Apresentação' : 'Presentation Mode'}
        >
          <MonitorPlay size={18} />
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        <button
          onClick={onAddModule}
          className="p-2.5 rounded-full hover:bg-primary bg-primary/10 text-primary hover:text-black transition-all flex items-center justify-center"
          title={lang === 'ES' ? 'Agregar Módulo' : lang === 'PT' ? 'Adicionar Módulo' : 'Add Module'}
        >
          <Plus size={18} />
        </button>
        {selectedModuleId && (
          <button
            onClick={() => onDeleteModule(selectedModuleId)}
            className="p-2.5 rounded-full hover:bg-danger bg-danger/10 text-danger hover:text-white transition-all flex items-center justify-center"
            title={lang === 'ES' ? 'Eliminar Módulo' : lang === 'PT' ? 'Excluir Módulo' : 'Delete Module'}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* ★ Modo Presentación (cinematic turntable) — antes el botón no renderizaba nada.
          Ahora se cablea pasando la cámara y los controles reales; PresentationMode
          orbita alrededor del centro del modelo (controls.target). */}
      {isPresentationMode && (
        <PresentationMode
          camera={camRef.current}
          controls={controlsRef.current}
          isEnabled={isPresentationMode}
          onToggle={() => setIsPresentationMode(false)}
        />
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        className="absolute top-4 right-16 p-2.5 bg-surface/40 hover:bg-primary text-white hover:text-black rounded-xl backdrop-blur-md transition-all border border-white/5 shadow-lg z-20"
        title="Export PNG"
      >
        <Download size={16} />
      </button>

      {/* AR Button */}
      <button
        onClick={handleViewInAR}
        disabled={isExportingAR || isEmpty}
        className="absolute top-16 right-16 px-4 py-2 bg-primary hover:bg-primary/90 text-black font-bold text-sm rounded-xl backdrop-blur-md transition-all shadow-[0_0_15px_rgba(245,166,35,0.4)] z-20 flex items-center gap-2 disabled:opacity-50"
        title="Ver en mi espacio (Realidad Aumentada)"
      >
        {isExportingAR ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
        Ver en mi espacio
      </button>

      {/* ─── Zoom controls (+ / -) — right side, vertically centered ─── */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 bg-black/60 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl z-30 transition-all duration-300 hover:border-white/20">
        <button
          onClick={() => zoomCamera('in')}
          className="p-2.5 rounded-xl transition-all duration-200 group/btn relative hover:bg-white/10 text-white/80 hover:text-white"
        >
          <ZoomIn size={18} />
          <span className="absolute right-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Acercar' : lang === 'PT' ? 'Aproximar' : 'Zoom in'}
          </span>
        </button>
        <div className="h-px bg-white/10 mx-1.5" />
        <button
          onClick={() => zoomCamera('out')}
          className="p-2.5 rounded-xl transition-all duration-200 group/btn relative hover:bg-white/10 text-white/80 hover:text-white"
        >
          <ZoomOut size={18} />
          <span className="absolute right-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Alejar' : lang === 'PT' ? 'Afastar' : 'Zoom out'}
          </span>
        </button>
      </div>

      {/* AR Model Viewer Overlay */}
      {arModelUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm">
          <button 
            onClick={() => { setArModelUrl(null); URL.revokeObjectURL(arModelUrl); }}
            className="absolute top-6 right-6 text-white hover:text-primary z-[60] p-2 bg-surface/40 rounded-full"
          >
            Cerrar
          </button>
          
          {/* ★ FIX: No children React inside model-viewer — slots se mueven al shadow DOM
              y causan removeChild crash. El botón AR se inyecta imperativemente. */}

        </div>
      )}
    </div>
  )
}
