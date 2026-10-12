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
import { Layers, Maximize, Download, Loader2, Move, Plus, FilePlus, Trash2, Box, GripVertical, Ruler, ArrowLeft, MonitorPlay, Scan, ZoomIn, ZoomOut, RotateCw, Axis3d, DraftingCompass, FileImage, BookmarkPlus, Check, X, ShieldAlert, Save } from 'lucide-react'
// ★ 2026-10-10: "Guardar en Galería" desde el visor — guard de viabilidad compartido
//   (mismo que ResultPanel) + store resiliente + categorías de la galería.
import { evaluateViability } from '../engine/viabilityGate.js'
import { saveViable, ViabilityError } from '../api/viableStore.js'
import { GALLERY_CATEGORIES, suggestCategory } from '../data/galleryCategories.js'

import PresentationMode from './PresentationMode.jsx'
import AIVisualStylist from './AIVisualStylist.jsx'
import ViralShare from './ViralShare.jsx'
import { getPBRMaterial } from '../engine/materialLibrary.js'
// ★ 2026-08-02 (auditoría E2E) — COHERENCIA DE TALLER (regla dura de CLAUDE.md):
//   plano, CSV y visor deben nombrar la MISMA pieza física IGUAL. El visor mostraba
//   el nombre crudo del motor ("Puerta 2", español) mientras el PDF/CSV ya pasaban
//   por localizePieceName y mostraban "Porta". El operario no puede emparejarlos.
import { localizePieceName } from '../engine/pieceNames.js'
import { AEREO_MOUNT } from '../engine/domainConstants.js'
import { normalizeRotation, rotationOffset, moduleWorldBox, buildDimensionPlan, chainLabel } from '../lib/dimensionLayout.js'
import { buildDimensionOverlay, buildAxesOverlay, disposeOverlay } from '../lib/dimensionOverlay.js'
import { countertopEligibility, buildCountertopClusters } from '../lib/countertopLayout.js'

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
  // ★ F3 2026-07-19 (aditivo): tipos nuevos del engine. El fallback a
  // 'structural' sigue cubriendo cualquier tipo futuro no mapeado.
  bancada:       0xF0EAE0,
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
  overlayModule    = null,   // BLOQUE 2 (HITL): módulo volátil a previsualizar translúcido (no firme)
  onCaptureReady   = null,   // (fn) => void  — called once renderer is ready; fn() returns PNG dataURL
  onIsoCaptureReady = null,  // (fn) => void  — expone captura isométrica en gris CAD (PNG dataURL)
  onCadCaptureReady = null,  // (fn)=>void — fn(kind:'front'|'top'|'iso') captura gris CAD -> {url,fx,fy}
  // ★ 2026-10-10 (ADITIVO): transformaciones del modelo de datos
  onRotateModule    = null,  // (id) => void — gira el módulo +90° en Y (App persiste `rotation`)
  onUpdateTransform = null,  // (id, { position:{x?,y?,z?} }) => void — mm; App persiste `position`
  onNewProject  = () => {},  // () => void — reinicia el proyecto con confirmación
  onSaveProject = () => {},  // () => void — abre modal de guardado en Galería
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

  // ★ 2026-10-10: Guardar en Galería (Biblioteca Verificada) desde el visor.
  const [saveOpen, setSaveOpen]   = useState(false)   // modal abierto
  const [saveName, setSaveName]   = useState('')
  const [saveCat,  setSaveCat]    = useState('')
  const [saving,   setSaving]     = useState(false)
  const [toast,    setToast]      = useState(null)     // { type:'ok'|'err', msg }

  // Diseño objetivo del guardado: el módulo SELECCIONADO (o el único/primero si no hay
  // selección). El guard es el MISMO que usa ResultPanel → una sola regla de viabilidad.
  const saveTarget = (Array.isArray(modules) ? modules : []).find(m => m && m.id === selectedModuleId)
    || (Array.isArray(modules) ? modules[0] : null) || null
  const viability = evaluateViability(saveTarget)
  const blockedMsg = {
    validation_missing:   (lang === 'PT' ? 'Sem validação estrutural. Gere o desenho novamente.' : lang === 'EN' ? 'No structural validation. Regenerate the design.' : 'Sin validación estructural del servidor. Regenerá el diseño.'),
    errors:               (lang === 'PT' ? 'O desenho tem erros estruturais. Corrija antes de registrar.' : lang === 'EN' ? 'The design has structural errors. Fix them before saving.' : 'Diseño no apto para galería: resolvé las advertencias estructurales antes de registrarlo.'),
    critical_adjustments: (lang === 'PT' ? 'Peças fora da chapa (>2750 mm sem seccionar). Não apto para a galeria.' : lang === 'EN' ? 'Pieces exceed the sheet (>2750 mm). Not eligible for the gallery.' : 'Diseño no apto para galería: resolvé las advertencias estructurales (pieza fuera de chapa) antes de registrarlo.'),
  }[viability.reason]

  function flashToast(type, msg) { setToast({ type, msg }); setTimeout(() => setToast(null), 3200) }

  function openSaveModal() {
    if (!viability.viable) { flashToast('err', blockedMsg || 'Diseño no apto para la galería.'); return }
    const cfg = saveTarget?.configuration || {}
    const suggested = `${cfg.moduleType || saveTarget?.type || 'Módulo'} ${cfg.width || ''}x${cfg.height || ''}`.trim()
    setSaveName(suggested)
    setSaveCat(suggestCategory(cfg.moduleType) || '')
    setSaveOpen(true)
  }

  async function doSaveToGallery() {
    if (saving) return
    const name = (saveName || '').trim()
    if (!name) { flashToast('err', 'Poné un nombre para el mueble.'); return }
    if (!saveTarget?.configuration) { flashToast('err', 'No hay un diseño válido para guardar.'); return }
    setSaving(true)
    try {
      await saveViable({ designName: name, params: saveTarget.configuration, category: saveCat || null })
      setSaveOpen(false)
      flashToast('ok', lang === 'PT' ? 'Salvo na Galeria.' : lang === 'EN' ? 'Saved to the Gallery.' : 'Guardado en la Galería.')
    } catch (err) {
      const msg = (err instanceof ViabilityError) ? (blockedMsg || 'Diseño no apto para la galería.') : (err?.message || 'No pudimos guardar el diseño.')
      flashToast('err', msg)
    } finally { setSaving(false) }
  }

  // ★ 2026-10-10 — Cotas CAD y ejes de referencia (overlays fuera de groupRef:
  //   no se exportan a GLB/AR, no se seleccionan y se ocultan en las capturas del plano).
  const [showDims, setShowDims] = useState(true)
  const [showAxes, setShowAxes] = useState(false)
  const [overlayVersion, setOverlayVersion] = useState(0)   // ↑ tras arrastrar → recalcula cotas
  const [transformInfo, setTransformInfo] = useState(null)  // {id,x,y,z,rotation,isAereo} del seleccionado
  // ★ 2026-10-10 (b) — Vistas técnicas: 'iso' (órbita libre) | 'front' (alzado) | 'side' (perfil)
  const [viewMode, setViewMode] = useState('iso')
  const [isExportingSheet, setIsExportingSheet] = useState(false)
  const dimsGroupRef = useRef(null)
  const axesGroupRef = useRef(null)
  const appliedPosRef = useRef({})        // id → JSON de la última `position` de datos aplicada
  const onUpdateTransformRef = useRef(onUpdateTransform)
  onUpdateTransformRef.current = onUpdateTransform
  // Las capturas CAD del plano NO deben llevar cotas/ejes del visor (el plano tiene las suyas).
  const withOverlaysHidden = (fn) => {
    const d = dimsGroupRef.current, a = axesGroupRef.current
    const dv = d ? d.visible : false, av = a ? a.visible : false
    if (d) d.visible = false
    if (a) a.visible = false
    try { return fn() } finally { if (d) d.visible = dv; if (a) a.visible = av }
  }

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
  // BLOQUE 2 (HITL): grupo del overlay translúcido. Vive en la escena, NUNCA en
  // groupRef/meshesRef -> invisible a selección, raycasting, export y captura CAD.
  const overlayGroupRef = useRef(null)

  const pieceSet = selectedPieceIds instanceof Set
    ? selectedPieceIds
    : new Set(Array.isArray(selectedPieceIds) ? selectedPieceIds : [])

  // Keep reactive state in a ref for the animation loop
  const stateRef = useRef({ exploded, wireframe, selectedPieceIds: pieceSet, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints })
  useEffect(() => {
    stateRef.current = { exploded, wireframe, selectedPieceIds: pieceSet, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints }
  }, [exploded, wireframe, pieceSet, selectedModuleId, openDrawers, orbitMode, rulerMode, rulerPoints])

  // ★ 2026-07-26 — REGRESIÓN CORREGIDA: clic en frente de gaveta no abría al primer clic.
  //
  // El "A1 FIX" original hizo DOS cosas: (a) namespacear la clave de gaveta con
  // `design.id` — correcto, y (b) además vaciar `openDrawers` cuando cambia
  // `selectedModuleId` — destructivo y ya innecesario tras (a).
  //
  // Por qué rompía: al clicar el frente de una gaveta de un módulo NO seleccionado,
  // el handler hace `onSelectModule(moduleId)` Y `setOpenDrawers(toggle)` en el mismo
  // batch. React re-renderiza, este efecto detecta que `selectedModuleId` cambió y
  // vacía el Set → borra la gaveta que se acababa de abrir. Resultado: el primer clic
  // no hacía nada y el segundo sí. Con las claves ya namespaceadas (`${design.id}-d${i}`)
  // no hay colisión posible entre módulos, así que el reset total sobra.
  //
  // Se conserva la intención de (b) — no arrastrar estado viejo — pero de forma NO
  // destructiva: se descartan sólo las claves de módulos que ya no están en escena.
  useEffect(() => {
    const vivos = new Set((Array.isArray(modules) ? modules : []).map((m, i) => String(m?.id || `MOD-${i + 1}`)))
    setOpenDrawers(prev => {
      const next = new Set([...prev].filter(k => vivos.has(String(k).replace(/-d\d+(-\d+)?$/, ''))))
      return next.size === prev.size ? prev : next   // sin cambios → misma referencia (no re-render)
    })
  }, [modules])

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
    const initW = canvas.clientWidth || container?.clientWidth || 800
    const initH = canvas.clientHeight || container?.clientHeight || 600
    renderer.setSize(initW > 0 ? initW : 800, initH > 0 ? initH : 600, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x0d0d0d, 1) // C4 FIX: alineado con token Charcoal #0D0D0D
    rendererRef.current = renderer

    // --- Scene ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d0d0d) // C4 FIX: alineado con token Charcoal #0D0D0D
    scene.fog = new THREE.FogExp2(0x0d0d0d, 0.0008)

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
      const c = mountRef.current || canvas
      if (!c) return
      const w = c.clientWidth || c.parentElement?.clientWidth || 0
      const h = c.clientHeight || c.parentElement?.clientHeight || 0
      if (w <= 0 || h <= 0) return
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      renderer.setSize(w, h, false)
      if (composerRef.current) composerRef.current.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    let _ro = null
    try {
      _ro = new ResizeObserver((entries) => {
        if (entries && entries.length > 0) {
          const rect = entries[0].contentRect
          if (rect && rect.width > 0 && rect.height > 0) {
            onResize()
          }
        } else {
          onResize()
        }
      })
      _ro.observe(canvas.parentElement || canvas)
    } catch (_) { /* navegador sin ResizeObserver: queda el listener de window */ }

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
            // ★ 2026-10-10: la caché guarda el ANCLA sin rotar (se descuenta el offset de giro)
            const off = mGroup.userData.rotOffset || { dx: 0, dz: 0 }
            const ax = mGroup.position.x - off.dx, az = mGroup.position.z - off.dz
            modulePositionsRef.current[moduleId] = { x: ax, z: az, y: mGroup.position.y }
            // …y lo persiste en el modelo de datos (mm). `y` no se toca: en aéreos la manda mountHeight.
            const Wm = mGroup.userData.moduleWidth || 0
            if (typeof onUpdateTransformRef.current === 'function') {
              onUpdateTransformRef.current(moduleId, { position: { x: Math.round((ax - Wm / 2) / SCALE), z: Math.round(az / SCALE) } })
            }
            setOverlayVersion(v => v + 1)
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
              if (typeof onSelectPiece === 'function') onSelectPiece(next)
            } else {
              if (typeof onSelectModule === 'function') onSelectModule(moduleId)
              if (typeof onSelectPiece === 'function') onSelectPiece(new Set([id]))
              if (drawerKey) {
                setOpenDrawers(prev => {
                  const next = new Set(prev)
                  next.has(drawerKey) ? next.delete(drawerKey) : next.add(drawerKey)
                  return next
                })
              }
            }
          } else {
            if (typeof onSelectModule === 'function') onSelectModule(null)
            if (typeof onSelectPiece === 'function') onSelectPiece(new Set())
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
        const meshes = meshesRef.current

        // ── Save camera state & setup Orthographic Camera ──────────────────
        const activeModule = (Array.isArray(modules) ? modules : []).find(m => m?.id === stateRef.current.selectedModuleId) || (Array.isArray(modules) ? modules[0] : null)
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
      onCaptureReady((...args) => withOverlaysHidden(() => captureWireframeDataURL(...args)))
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
      onIsoCaptureReady((...args) => withOverlaysHidden(() => captureIsometricDataURL(...args)))
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
      onCadCaptureReady((...args) => withOverlaysHidden(() => captureCadView(...args)))
    }

    // ★ Cleanup: cancela loop y event listeners al desmontar
    return () => {
      initRef.current = false
      if (composerRef.current) { try { composerRef.current.dispose() } catch (_) {} composerRef.current = null }
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
      window.removeEventListener('resize', onResize)
      if (_ro) { try { _ro.disconnect() } catch (_) {} _ro = null }
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)

      // ★ 2026-08-02 (auditoría E2E) — FUGA DE CONTEXTO WEBGL.
      //   Este cleanup cancelaba el RAF y los listeners, pero NUNCA liberaba el
      //   renderer, los controles ni el environment map. Cada ciclo montar/desmontar
      //   (navegar /app → landing → /app) dejaba un contexto WebGL vivo. Chrome corta
      //   en ~16: a partir de ahí mata los viejos y el visor queda NEGRO con
      //   "THREE.WebGLRenderer: Context Lost". Se reproduce entre tomas de video.
      //
      //   Se difiere un tick a propósito: en el doble montaje de StrictMode React
      //   conserva el <canvas> en el DOM y vuelve a montar. Si perdiéramos el contexto
      //   ahí, el remount crearía un WebGLRenderer sobre un canvas ya muerto. La
      //   guarda `isConnected` distingue desmontaje REAL de re-ejecución de StrictMode.
      const _canvas = canvas, _renderer = renderer, _scene = scene, _controls = controls
      setTimeout(() => {
        if (_canvas.isConnected) return   // sigue en el DOM → StrictMode, no desmontaje
        try { _controls?.dispose?.() } catch (_) {}
        try {
          _scene?.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose()
            const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : [])
            mats.forEach(m => {
              // las texturas también ocupan VRAM y no se liberan solas
              for (const k of ['map', 'bumpMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'envMap', 'alphaMap']) {
                if (m[k]?.dispose) m[k].dispose()
              }
              m.dispose()
            })
          })
          if (_scene?.environment?.dispose) _scene.environment.dispose()  // PMREM
          if (_scene?.background?.dispose) _scene.background.dispose()
          _scene?.clear?.()
        } catch (_) {}
        try { _renderer?.dispose?.() } catch (_) {}
        try { _renderer?.forceContextLoss?.() } catch (_) {}
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ★ FIX: Delete key handler REMOVED from Viewer3D — App.jsx lo maneja centralmente.
  // Tener dos handlers causaba doble llamado a onDeleteModule → historial corrupto → error en Ctrl+Z.


  // ★ Premium: Smooth camera focus on module selection
  const cameraTargetRef = useRef(null)
  useEffect(() => {
    if (!selectedModuleId || !moduleGroupsRef.current || !moduleGroupsRef.current[selectedModuleId]) return () => {}
    const mGroup = moduleGroupsRef.current[selectedModuleId]
    if (!mGroup) return () => {}
    const box = new THREE.Box3().setFromObject(mGroup)
    const center = new THREE.Vector3()
    box.getCenter(center)
    cameraTargetRef.current = center
    // Smooth orbit target transition
    const controls = controlsRef.current
    if (controls && controls.target) {
      const startTarget = controls.target.clone()
      const startTime = Date.now()
      const duration = 600
      const smoothFocus = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3)
        if (controls && controls.target && typeof controls.target.lerpVectors === 'function') {
          controls.target.lerpVectors(startTarget, center, ease)
          controls.update()
        }
        if (progress < 1) requestAnimationFrame(smoothFocus)
      }
      smoothFocus()
    }
    return () => {}
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
        const off = mGrp.userData?.rotOffset || { dx: 0, dz: 0 }   // ★ ancla sin rotar
        modulePositionsRef.current[modId] = { x: mGrp.position.x - off.dx, z: mGrp.position.z - off.dz }
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
    const activeIds = new Set((Array.isArray(modules) ? modules : []).filter(Boolean).map(m => m?.id))
    Object.keys(modulePositionsRef.current).forEach(k => {
      if (!activeIds.has(k)) delete modulePositionsRef.current[k]
    })
    // ★ 2026-10-10: `position` del modelo de datos es la FUENTE DE VERDAD cuando existe
    //   (arrastre → onUpdateTransform la persiste; edición X/Y/Z; undo/redo; carga).
    //   La caché solo ubica módulos que aún no tienen posición. Efecto: al cambiar el
    //   ancho, el borde izquierdo queda fijo (antes crecía hacia ambos lados).
    ;(Array.isArray(modules) ? modules : []).forEach(m => {
      if (!m?.id) return
      const key = m.position && typeof m.position.x === 'number' ? JSON.stringify(m.position) : null
      if (key) delete modulePositionsRef.current[m.id]
      appliedPosRef.current[m.id] = key
    })
    // ★ Clean snap guide lines
    snapLinesRef.current.forEach(l => { scene?.remove(l); l.geometry?.dispose(); l.material?.dispose() })
    snapLinesRef.current = []

    // ★ PROTECTED: Find rightmost edge of EXISTING modules for new module placement
    // ★ 2026-10-09 FIX CRASH "0 is not a function": sin ';' el ASI unía
    //   `0` + `(Array...)` → `0(...)`. Punto y coma obligatorio aquí.
    let maxRightEdge = 0;
    (Array.isArray(modules) ? modules : []).forEach((design) => {
      const cfg = design?.configuration
      if (!cfg) return
      const W = (cfg.width || 600) * SCALE
      let saved = modulePositionsRef.current[design.id]
      if (!saved && design?.position && typeof design.position === 'object' && typeof design.position.x === 'number' && !isNaN(design.position.x)) {
        saved = {
          x: design.position.x * SCALE + W / 2,
          z: (design.position.z || 0) * SCALE
        }
      }
      if (saved) {
        const rightEdge = saved.x + W / 2
        if (rightEdge > maxRightEdge) maxRightEdge = rightEdge
      }
    })

    let currentXOffset = 0;  // ★ FIX: fallback offset for legacy pieces (not used by cfg-based modules)

    ;(modules || []).forEach((design, dIdx) => {
      if (!design || typeof design !== 'object') return
      let cfg = design?.configuration

      // ★ PROTECTED: Skip hidden modules (layers panel visibility)
      if (design.id && hiddenModules.has(design.id)) {
        currentXOffset += ((cfg?.width || 600) * SCALE) + 5
        return
      }

      // If no configuration, try to build from pieces array or apply safe fallback
      if (!cfg) {
        if (design.pieces && Array.isArray(design.pieces) && design.pieces.length > 0) {
          buildFromPieces(design, dIdx, group, currentXOffset)
          currentXOffset += 100
          return
        }
        cfg = {
          width: 800,
          height: 2100,
          depth: 550,
          thickness: 18,
          numShelves: 3,
          numDrawers: 0,
          hasDoors: false,
          hasBaseboard: true,
          baseboardHeight: 80
        }
      }

      const W  = (cfg.width  || 600) * SCALE
      const H  = (cfg.height || 720) * SCALE
      const D  = (cfg.depth  || 580) * SCALE
      const T  = (cfg.thickness || 18) * SCALE
      const BT = (cfg.backThickness || 6) * SCALE
      // ★ FIX 2026-07-23 (aéreo "falsas patas"): BH (offset de zócalo que eleva el
      //   piso y la carcasa) debe ser 0 cuando el mueble NO lleva zócalo. Antes se
      //   calculaba siempre como baseboardHeight||100, así que en un AÉREO
      //   (baseboard:false) el piso quedaba elevado 100mm y los laterales asomaban
      //   por debajo → sensación de patas. Ahora respeta baseboard===false y aéreo.
      //   Un módulo con zócalo (baseboard!==false y no aéreo) mantiene su BH → sin
      //   cambios. Aditivo: solo agrega los guards al cálculo.
      const noPlinth = cfg.baseboard === false || cfg.moduleType === 'aereo'
      const BH = (noPlinth ? 0 : (cfg.baseboardHeight || 100)) * SCALE

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

        // ★ 2026-07-26 (auditoría CAD): GLTFExporter escribe node.name desde object.name,
        //   NO desde userData. Sin esto el .glb de AR/3D salía con nodos "Object_0",
        //   "Object_1"… y el mueble llegaba a Blender/SketchUp sin identificar piezas.
        //   Aditivo: no altera geometría, materiales ni picking (que usa userData).
        mesh.name = `${design.id}__${pieceName.replace(/\s+/g, '_')}`
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
      mGroup.name = String(design.id || `MOD-${dIdx + 1}`)  // ★ jerarquía nombrada en el .glb
      // ★ PROTECTED: Position module using saved location or place after rightmost module
      // ★ AEREO FIX: Wall-mounted modules are elevated by mountHeight (piso → borde inferior).
      // ★ 2026-07-26: el literal 1400 pasó a AEREO_MOUNT.DEFAULT (=1450, el que usa el
      //   motor). `??` en vez de `||`: con OR un mountHeight de 0 (aéreo apoyado, válido)
      //   volvía a elevarse 1450mm y el 3D contradecía la config guardada.
      const isAereoModule = cfg.moduleType === 'aereo'
      const mountY = isAereoModule ? ((cfg.mountHeight ?? AEREO_MOUNT.DEFAULT) * SCALE) : 0
      let saved = modulePositionsRef.current[design.id]
      if (!saved && design?.position && typeof design.position === 'object' && typeof design.position.x === 'number' && !isNaN(design.position.x)) {
        // ★ 2026-10-10: un aéreo con position.y = 0 (default de sanitize) se eleva por
        //   mountHeight; antes caía al piso. y ≠ 0 explícito sigue mandando.
        const py = design.position.y
        saved = {
          x: design.position.x * SCALE + W / 2,
          z: (design.position.z || 0) * SCALE,
          y: (py !== undefined && py !== null && !(isAereoModule && py === 0)) ? py * SCALE : mountY
        }
        modulePositionsRef.current[design.id] = saved
      }
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
      // ★ 2026-10-10 — GIRO EN Y (0/90/180/270). Pivota sobre el centro de la huella:
      //   posición = ancla + offset(D, θ). `rotOffset` permite volver al ancla al cachear.
      const rotDeg = normalizeRotation(design.rotation)
      const rotOff = rotationOffset(D, rotDeg)
      mGroup.position.x += rotOff.dx
      mGroup.position.z += rotOff.dz
      mGroup.rotation.y = (rotDeg * Math.PI) / 180
      mGroup.userData.rotOffset = rotOff
      mGroup.userData.rotation = rotDeg
      moduleGroupsRef.current[design.id] = mGroup
      mGroup.userData.moduleId = design.id
      mGroup.userData.moduleWidth = W
      const xOffset = 0  // ★ PROTECTED: Pieces positioned relative to module center

      const bodyColor  = MATERIAL_COLORS[cfg.materialId] || MATERIAL_COLORS[cfg.materialBody]  || TYPE_COLORS.structural
      const frontColor = MATERIAL_COLORS[cfg.materialId] || MATERIAL_COLORS[cfg.materialFront] || TYPE_COLORS.drawer_front
      const ctColor    = MATERIAL_COLORS[cfg.countertopMaterial] || TYPE_COLORS.countertop

      const yBase = 0
      const iW = W - 2 * T  // internal width

      // ★ DESK RENDER 2026-07-22: la topología 'desk' tiene su propia rama fiel al
      //   motor (tampo sobrepuesto, laterales H−T, pedestal por lado, faldón, simple).
      //   El armado genérico de carcasa NO aplica a un escritorio (dibujaba techo/piso/
      //   fondo completos que el motor no corta).
      const isDeskViz = cfg.moduleType === 'desk'

      if (!isDeskViz) {
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
      } // end !isDeskViz (carcasa genérica)

      const iD = D - BT - 0.2
      const zCenter = BT + iD / 2 + 0.1

      // ★ SSOT 2026-07-20: la caja de gaveta se LEE del payload del motor (derivada de
      //   las piezas reales de la lista de corte) en vez de recalcularse aquí.
      //   El visor usaba `iD − 4`: divergía ~18mm de lo fabricado y, peor, ENMASCARABA
      //   geometría imposible (una caja de 250mm en un mueble de 150mm se dibujaba
      //   como 102mm y "encajaba" perfecta). Aditivo y con fallback:
      //   - `engBox` presente  → se usa la geometría real del motor.
      //   - módulo del motor SIN caja (`drawerBox: null`) → el motor la declaró NO
      //     fabricable: se dibuja solo el frente, sin mentir con una caja inexistente.
      //   - payload antiguo/sin piezas → fórmula histórica (cero regresión).
      const engBox        = design?.drawerBox || null
      const isEnginePayload = Array.isArray(design?.pieces) && design.pieces.length > 0
      const boxDepthU     = engBox?.depth != null ? engBox.depth * SCALE : (iD - 4)
      const boxOuterWU    = engBox?.outerWidth != null ? engBox.outerWidth * SCALE : null
      const skipDrawerBox = isEnginePayload && !engBox

      // === BASEBOARD / FEET ===
      // ★ RODAPIÉ UNIVERSAL 2026-07-20 — alineado con closetEngine.js. Tres divergencias
      //   corregidas, todas aditivas:
      //   1) RECUO: el visor usaba `5` (=50mm); el motor ahora usa BASEBOARD.INSET=100mm
      //      con clamp por fondo. Se replica la MISMA fórmula → 0mm de divergencia.
      //   2) GUARD DE AÉREO: al visor le faltaba. Un colgado con `baseboard` undefined
      //      dibujaba un zócalo que el motor NO corta (un aéreo no toca el piso).
      //   3) baseType 'legs'/'none': el motor solo emite zócalo en 'recessed'; el visor
      //      lo pintaba siempre. En 'legs' ahora se dibujan solo las patas.
      const isAereoMod  = cfg.moduleType === 'aereo'
      const bbType      = cfg.baseType || (cfg.baseboard === false ? 'none' : 'recessed')
      const showBase    = cfg.baseboard !== false && cfg.hasRodapie !== false && cfg.hasPlinth !== false && !isAereoMod && !isDeskViz
      // Mismo clamp que el motor: inset = min(100, floor((D − T − 50) / 2)), en mm.
      const bbInsetMM   = Math.max(0, Math.min(100, Math.floor((D / SCALE - T / SCALE - 50) / 2)))
      const bbInsetU    = bbInsetMM * SCALE

      if (showBase) {
        if (bbType === 'recessed') {
          const fr = makeMesh(iW, BH, T, bodyColor, 'Zocalo Frontal', 'baseboard')
          fr.position.set(xOffset, BH / 2, D - T / 2 - bbInsetU)
          mGroup.add(fr)
          // Zócalo trasero: el motor lo corta (RODAPIE-TRASERO) y el visor lo omitía.
          const bkz = makeMesh(iW, BH, T, bodyColor, 'Zocalo Trasero', 'baseboard')
          bkz.position.set(xOffset, BH / 2, T / 2 + bbInsetU)
          mGroup.add(bkz)
        }

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

      // ★ DESK RENDER 2026-07-22 — rama fiel al motor (generateDeskFurniture):
      //   mismas fórmulas de posición convertidas a coordenadas centradas del visor
      //   (x_visor = x_motor − W/2). Caja de gaveta desde drawerBox del motor (SSOT).
      if (isDeskViz) {
        const mmW = cfg.width || 1200, mmT = cfg.thickness || 18
        const hasPed = cfg.hasPedestal !== false
        const side = cfg.pedestalSide === 'left' ? 'left' : 'right'
        // Clamp de pedestalWidth IDÉNTICO al motor
        const pedWmm = Math.min(Math.max(cfg.pedestalWidth || 400, 300), mmW - 600 > 300 ? mmW - 600 : mmW * 0.4)
        const PW = pedWmm * SCALE
        const latH = H - T
        const toV = (xMotor) => xMotor - W / 2 + xOffset   // motor 0..W → visor centrado

        // Tampo sobrepuesto: ancho completo, apoya sobre laterales (y pedestal)
        const tampo = makeMesh(W, T, D, ctColor !== TYPE_COLORS.countertop ? ctColor : bodyColor, 'Tampo Escritorio', 'countertop')
        tampo.position.set(xOffset, latH + T / 2, D / 2)
        mGroup.add(tampo)

        // Laterales de apoyo (H − T, el tampo apoya encima)
        for (const [nm, xm] of [['Lateral Izquierdo', T / 2], ['Lateral Derecho', W - T / 2]]) {
          const lm = makeMesh(T, latH, D, bodyColor, nm, 'structural')
          lm.position.set(toV(xm), latH / 2, D / 2)
          mGroup.add(lm)
        }

        if (hasPed) {
          const divXm = side === 'right' ? (W - PW + T / 2) : (PW - T / 2)
          const pedMidXm = side === 'right' ? (W - PW / 2) : (PW / 2)
          const pedInterior = PW - 2 * T
          const pedCXm = side === 'right' ? (W - PW + T + pedInterior / 2) : (T + pedInterior / 2)

          const dv = makeMesh(T, latH, D, bodyColor, 'Costado Pedestal', 'structural')
          dv.position.set(toV(divXm), latH / 2, D / 2)
          mGroup.add(dv)

          const pb = makeMesh(pedInterior, T, D - BT, bodyColor, 'Base Pedestal', 'structural')
          pb.position.set(toV(pedMidXm), T / 2, (D - BT) / 2 + BT)
          mGroup.add(pb)

          const pf = makeMesh(pedInterior, latH - T, BT, bodyColor, 'Fondo Pedestal', 'structural')
          pf.position.set(toV(pedMidXm), (latH + T) / 2, BT / 2 + 0.01)
          mGroup.add(pf)

          // ★ AUTO-FIT + TRAVESAÑO 2026-07-23 (espejo EXACTO del motor):
          //   Travesaño de cierre (drawerRailHeight, estándar 50mm) pegado al tampo;
          //   las gavetas se estiran para llenar el pedestal debajo, sin hueco.
          const CLEAR_P = 16 * SCALE
          const reqDrw  = cfg.numDrawers || 0
          const railHU  = (reqDrw > 0 && cfg.drawerPrivacyPanel !== false)
            ? Math.max(50, Math.round(cfg.drawerRailHeight || 50)) * SCALE
            : 0
          const usableHU    = latH - T
          const drawerZoneU = usableHU - railHU
          const MINH_P = 80 * SCALE
          const nDrw = Math.min(reqDrw, Math.max(0, Math.floor(drawerZoneU / (MINH_P + CLEAR_P))))
          const dhP = nDrw > 0 ? Math.max(MINH_P, (drawerZoneU / nDrw) - CLEAR_P) : 0
          for (let i = 0; i < nDrw; i++) {
            const yC = T + i * (dhP + CLEAR_P) + dhP / 2
            const dKey = `${design.id}-d${i}`
            const df = makeMesh(pedInterior - 0.4, dhP - 0.4, T, frontColor, `Frente Gaveta ${i + 1}`, 'drawer_front', dKey)
            df.position.set(toV(pedCXm), yC, D - T / 2)
            mGroup.add(df)
            if (!skipDrawerBox) {
              addDrawerBox(toV(pedCXm), yC, boxOuterWU ?? (pedInterior - (26 * SCALE)), dhP - 4, boxDepthU, zCenter, dKey)
            }
          }
          // Travesaño de cierre PEGADO bajo el tampo (tope en latH).
          if (railHU > 0 && nDrw > 0) {
            const rail = makeMesh(pedInterior, railHU, T, bodyColor, 'Travesaño Superior', 'structural')
            rail.position.set(toV(pedCXm), latH - railHU / 2, D - T / 2)
            mGroup.add(rail)
          }
        }

        // Faldón trasero (modesty panel) — pegado bajo el tampo, mismo clamp del motor
        const latHmm = latH / SCALE
        const apronHmm = Math.min(140, Math.max(90, Math.round(latHmm * 0.15)))
        const apronH = apronHmm * SCALE
        const kneeSpan = hasPed ? (W - PW - T) : (W - 2 * T)
        // ★ FIX 2026-07-23: faldón centrado en el vano REAL (espejo del motor),
        //   antes corrido ½T y pisando el lateral.
        const apronXm = hasPed
          ? (side === 'right' ? ((W - PW + T) / 2) : ((W + PW - T) / 2))
          : W / 2
        const ap = makeMesh(kneeSpan, apronH, T, bodyColor, 'Faldon Trasero', 'structural')
        ap.position.set(toV(apronXm), latH - apronH / 2, BT + T / 2 + 0.02)
        mGroup.add(ap)
      }

      if (nD > 0 && !isDeskViz) {
        if (isHorizontal) {
          // VULN-06 FIX: Descuenta la mitad del espesor del divisor central (T / 2)
          const colW = (iW - T) / 2
          const drawersPerCol = Math.ceil(nD / 2)
          for (let col = 0; col < 2; col++) {
            let colY = yBase + BH + T
            const startX = xOffset - iW / 2 + colW / 2 + col * (colW + T)
            for (let i = 0; i < drawersPerCol; i++) {
              if (col * drawersPerCol + i >= nD) break
              const dKey = `${design.id}-d${col}-${i}` // A1 FIX: clave estable por design.id, no por posición
              const df = makeMesh(colW - 0.4, dH - 0.4, T, frontColor, `Frente Gaveta H-${col + 1}-${i + 1}`, 'drawer_front', dKey)
              df.position.set(startX, colY + dH / 2, D - T / 2)
              mGroup.add(df)
              // VULN-02 FIX: Holgura real de 26mm * SCALE (13mm por lado)
              // ★ SSOT 2026-07-20: PROFUNDIDAD desde el motor. El ancho se mantiene
              //   local: este bloque asume 2 columnas fijas y el motor soporta 2..4
              //   (deuda abierta), así que su outerWidth puede no corresponder a esta
              //   retícula. La divergencia documentada era la profundidad.
              if (!skipDrawerBox) {
                addDrawerBox(startX, colY + dH / 2, colW - (26 * SCALE), dH - 4, boxDepthU, zCenter, dKey)
              }
              colY += dH
            }
          }
          curY += Math.ceil(nD / 2) * dH
        } else {
          for (let i = 0; i < nD; i++) {
            const dKey = `${design.id}-d${i}` // A1 FIX: clave estable por design.id, no por posición
            const df = makeMesh(iW - 0.4, dH - 0.4, T, frontColor, `Frente Gaveta ${i + 1}`, 'drawer_front', dKey)
            df.position.set(xOffset, curY + dH / 2, D - T / 2)
            mGroup.add(df)
            // VULN-02 FIX: Holgura real de 26mm * SCALE (13mm por lado)
            // ★ SSOT 2026-07-20: ancho y profundidad REALES del motor (columna única,
            //   la geometría del payload corresponde 1:1 con esta caja).
            if (!skipDrawerBox) {
              addDrawerBox(xOffset, curY + dH / 2, boxOuterWU ?? (iW - (26 * SCALE)), dH - 4, boxDepthU, zCenter, dKey)
            }
            curY += dH
          }
        }

        // VULN-07 FIX: Repisa separadora colocada inmediatamente sobre cajones (igual que closetEngine.js)
        if (curY < yBase + H - T) {
          const tapa = makeMesh(iW, T, iD, bodyColor, 'Repisa Separadora (encima gavetas)', 'shelf')
          tapa.position.set(xOffset, curY + T / 2, zCenter)
          mGroup.add(tapa)
          curY += T
        }
      }

      // === DOORS ===
      if (cfg.hasDoors && cfg.showDoors !== false) {
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
      // ★ 2026-10-10 — TAMPO POR CLÚSTER COPLANAR (lib/countertopLayout.js).
      //   Antes: cadena por cercanía en X (150 mm, sin límite inferior) y tampo a la ALTURA
      //   MÁXIMA → un ropero 2100 junto a un balcão 720 dejaba un tampo volando a 2100 sobre
      //   el balcão. Ahora: solo módulos elegibles (sin torres ≥1800, aéreos, escritorios ni
      //   girados), contiguos ≤5 mm, misma cara superior ±2 mm, misma fila; y la caja usa la
      //   posición REAL (x, y elevación, z) — antes asumía y=0 y z=0.
      const ctItems = []
      const ctById = {}
      ;(Array.isArray(modules) ? modules : []).forEach(m => {
        const grp = m?.id && moduleGroupsRef.current[m.id]
        if (!grp || hiddenModules.has(m.id) || !m.configuration) return
        const rotation = grp.userData.rotation || 0
        if (!countertopEligibility(m, rotation).ok) return
        const cfg = m.configuration
        const off = grp.userData.rotOffset || { dx: 0, dz: 0 }
        ctItems.push({
          id: m.id,
          box: moduleWorldBox({
            width: cfg.width || 600, height: cfg.height || 720, depth: cfg.depth || 580,
            anchorX: (grp.position.x - off.dx) / SCALE, anchorZ: (grp.position.z - off.dz) / SCALE,
            y: grp.position.y / SCALE, rotation,
          }),
        })
        ctById[m.id] = m
      })

      if (ctItems.length > 0) {
        const clusters = buildCountertopClusters(ctItems)
        clusters.forEach(cl => {
          const chain  = cl.ids.map(id => ({ module: ctById[id] }))
          const xMin   = cl.xMin * SCALE
          const xMax   = cl.xMax * SCALE
          const topY   = cl.topY * SCALE
          const frontZ = cl.zMax * SCALE
          const backZ  = cl.zMin * SCALE

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

  // ── BLOQUE 2 (HITL): preview translúcido del módulo volátil ──────────────
  // Effect autocontenido. Reusa los MISMOS campos paramétricos (cfg + SCALE) que
  // el motor firme, pero pinta losas translúcidas en overlayGroupRef, adjunto a
  // la escena. No toca meshesRef, raycaster, groupRef ni el auto-frame de cámara.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // limpiar overlay anterior
    if (overlayGroupRef.current) {
      scene.remove(overlayGroupRef.current)
      overlayGroupRef.current.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose())
      })
      overlayGroupRef.current = null
    }

    const cfg = overlayModule?.configuration
    if (!cfg) return

    const W  = (cfg.width  || 600) * SCALE
    const H  = (cfg.height || 720) * SCALE
    const D  = (cfg.depth  || 580) * SCALE
    const T  = (cfg.thickness || 18) * SCALE
    const BH = (cfg.baseboard !== false ? (cfg.baseboardHeight || 100) : 0) * SCALE

    const g = new THREE.Group()
    g.userData._isOverlay = true   // marca propia; el rebuild firme sólo limpia _isEdge
    const ghost = () => new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8, transparent: true, opacity: 0.36, roughness: 0.5,
      metalness: 0, depthWrite: false, side: THREE.DoubleSide,
    })
    const slab = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), ghost())
      m.position.set(x, y, z)
      g.add(m)
    }

    // carcasa
    slab(T, H, D, -W / 2 + T / 2, H / 2, 0)   // lateral izq
    slab(T, H, D,  W / 2 - T / 2, H / 2, 0)   // lateral der
    slab(W, T, D, 0, H - T / 2, 0)            // techo
    slab(W, T, D, 0, BH + T / 2, 0)           // piso (sobre zócalo)
    slab(W, H, T, 0, H / 2, -D / 2 + T / 2)   // fondo
    if (BH > 0) slab(W - 2 * T, BH, D * 0.9, 0, BH / 2, 0)  // zócalo

    // repisas
    const ns = cfg.numShelves || 0
    for (let i = 1; i <= ns; i++) {
      const y = BH + (H - BH) * (i / (ns + 1))
      slab(W - 2 * T, T, D - T, 0, y, T / 2)
    }
    // cajones (frentes) o puertas
    const nd = cfg.numDrawers || 0
    if (nd > 0) {
      const dh = (cfg.drawerHeight || 180) * SCALE
      for (let i = 0; i < nd; i++) slab(W - 2 * T, dh * 0.92, T, 0, BH + dh * (i + 0.5), D / 2 - T / 2)
    } else if (cfg.hasDoors !== false) {
      const ndoors = cfg.numDoors || 2
      const dw = (W - 2 * T) / ndoors
      for (let i = 0; i < ndoors; i++) slab(dw * 0.94, H - BH - 2 * T, T, -W / 2 + T + dw * (i + 0.5), BH + (H - BH) / 2, D / 2 - T / 2)
    }

    // posición: a la derecha de los módulos firmes (aparece como "el siguiente")
    // BLOQUE 3: si el aéreo trae X heredada de su base, se apila encima (mismo centro);
    // si no, cae al layout por defecto (a la derecha de los firmes).
    if (typeof overlayModule.__overlayXmm === 'number') {
      g.position.x = overlayModule.__overlayXmm * SCALE
    } else {
      let totalW = 0
      ;(modules || []).forEach(m => { const c = m?.configuration; if (c) totalW += (c.width || 600) * SCALE })
      g.position.x = totalW + W / 2 + (modules && modules.length ? 5 : 0)
    }
    // ★ 2026-07-26: mismo fix que el mountY de arriba (constante única + `??`).
    if (cfg.moduleType === 'aereo') g.position.y = (cfg.mountHeight ?? AEREO_MOUNT.DEFAULT) * SCALE

    scene.add(g)
    overlayGroupRef.current = g

    return () => {
      if (overlayGroupRef.current) {
        // A2 FIX: `scene` es la variable local capturada al inicio del effect (no sceneRef.current).
        // Guard defensivo: si el renderer fue desmontado antes que este cleanup corra,
        // scene sigue siendo una referencia válida pero Three.js la habrá liberado.
        // El null-check previene un crash silencioso en ese edge-case.
        if (scene) scene.remove(overlayGroupRef.current)
        overlayGroupRef.current.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose())
        })
        overlayGroupRef.current = null
      }
    }
  }, [overlayModule, modules])

  // TAREA 1 (pulido): al entrar/salir del modo presentación, el layout Charcoal
  // redimensiona el contenedor del canvas; forzamos un resize sincrónico para que
  // renderer/composer recalculen el búfer y no quede hueco negro inferior en Chrome.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'))
    fire()                                   // inmediato
    const raf = requestAnimationFrame(fire)  // siguiente frame
    const id  = setTimeout(fire, 260)        // cubre la transición CSS de presentation-active
    return () => { cancelAnimationFrame(raf); clearTimeout(id) }
  }, [isPresentationMode])

  // --- Fallback: build from raw pieces array ---
  function buildFromPieces(design, dIdx, group, xOff) {
    const pieces = design.pieces || design.piezas || []
    if (!pieces.length) return
    const scene = sceneRef.current

    const mGroup = new THREE.Group()
    mGroup.name = String(design.id || `MOD-${dIdx + 1}`)  // ★ jerarquía nombrada en el .glb
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
      // ★ 2026-07-26 (auditoría CAD): igual que el builder principal — GLTFExporter
      //   lee object.name, no userData. Sin esto el .glb sale con nodos anónimos.
      mesh.name = `${design.id || `MOD-${dIdx + 1}`}__${String(p.name || p.type || `piece-${i}`).replace(/\s+/g, '_')}`
      // ★ 2026-07-26: el builder fallback (diseños legacy sin `configuration`) no
      //   asignaba drawerKey → en esos módulos el clic en el frente no abría la gaveta.
      //   Se deriva del número que ya trae el nombre de la pieza ("Frente Gaveta 2"),
      //   para que frente y caja de la MISMA gaveta compartan clave y se muevan juntos.
      const _n = String(p.name || '').match(/(\d+)\s*$/)
      const _isDrawer = /drawer_front|drawer_box|drawer_bottom/.test(p.type || '')
      const _drawerKey = _isDrawer ? `${design.id || `MOD-${dIdx + 1}`}-d${_n ? _n[1] : i}` : null
      mesh.userData = {
        id: p.id || `piece-${dIdx}-${i}`,
        drawerKey: _drawerKey,
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

  // ─── ★ 2026-10-10 — Cajas reales (mm) de los módulos visibles ─────────────────
  //   Fuente única para cotas, vistas técnicas y ficha: posición real del grupo
  //   (incluye arrastres) + dimensiones de la config + giro.
  const collectOverlayItems = () => {
    const items = []
    let selectedBox = null, selectedInfo = null
    ;(Array.isArray(modules) ? modules : []).forEach(m => {
      const cfg = m?.configuration
      const grp = m?.id && moduleGroupsRef.current[m.id]
      if (!cfg || !grp || hiddenModules.has(m.id)) return
      const off = grp.userData.rotOffset || { dx: 0, dz: 0 }
      const rotation = grp.userData.rotation || 0
      const ax = (grp.position.x - off.dx) / SCALE, az = (grp.position.z - off.dz) / SCALE
      const box = moduleWorldBox({
        width: cfg.width || 600, height: cfg.height || 720, depth: cfg.depth || 580,
        anchorX: ax, anchorZ: az, y: grp.position.y / SCALE, rotation,
      })
      items.push({ id: m.id, box, module: m })
      if (m.id === selectedModuleId) {
        selectedBox = box
        const isAereo = cfg.moduleType === 'aereo'
        selectedInfo = {
          id: m.id, rotation, isAereo,
          x: Math.round(ax - (cfg.width || 600) / 2), z: Math.round(az),
          y: Math.round(isAereo ? (cfg.mountHeight ?? AEREO_MOUNT.DEFAULT) : grp.position.y / SCALE),
        }
      }
    })
    return { items, selectedBox, selectedInfo }
  }

  // ─── ★ 2026-10-10 (b) — VISTAS TÉCNICAS EN VIVO ───────────────────────────────
  //   Frontal: cámara en +Z mirando al frente. Lateral: desde +X (perfil derecho).
  //   3D: vuelve a la isométrica. Orbitar con el mouse devuelve el modo a '3D'
  //   (las cotas vuelven a incluir profundidad).
  const setTechnicalView = useCallback((mode) => {
    const cam = camRef.current, controls = controlsRef.current, grp = groupRef.current
    if (!cam || !controls || !grp) return
    const box = new THREE.Box3().setFromObject(grp)
    if (box.isEmpty()) return
    // Encuadre que incluye las cotas (si están visibles): sin esto las cotas superiores
    // y la de altura quedaban cortadas o debajo del HUD.
    if (dimsGroupRef.current?.visible) {
      dimsGroupRef.current.updateMatrixWorld(true)
      box.union(new THREE.Box3().setFromObject(dimsGroupRef.current))
    }
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3())
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360)
    const fitDist = (w, h) => (Math.max(h, w / (cam.aspect || 1)) / 2) / tanHalf * 1.3
    let pos
    if (mode === 'front') pos = new THREE.Vector3(c.x, c.y, box.max.z + fitDist(sz.x, sz.y))
    else if (mode === 'side') pos = new THREE.Vector3(box.max.x + fitDist(sz.z, sz.y), c.y, c.z)
    else pos = c.clone().add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(Math.max(sz.x, sz.y, sz.z) * 2.2))
    controls.target.copy(c)
    cam.position.copy(pos)
    cam.up.set(0, 1, 0)
    cam.lookAt(c)
    controls.update()
    setViewMode(mode)
  }, [])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const onStart = () => setViewMode(m => (m === 'iso' ? m : 'iso'))
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [isReady])

  // Materiales sin resaltado de selección/hover mientras dura `fn` (fotos para cliente/taller)
  const withCleanMaterials = (fn) => {
    const restore = []
    if (!stateRef.current.wireframe) {
      meshesRef.current.forEach(m => {
        const mat = m.material, ud = m.userData
        if (!mat?.color || ud?.originalColor === undefined) return
        restore.push([mat, mat.color.clone(), mat.emissive?.clone(), mat.emissiveIntensity, ud.edgeHelper, ud.edgeHelper?.material.color.clone(), ud.edgeHelper?.material.opacity])
        mat.color.set(ud.originalColor)
        if (mat.emissive) mat.emissive.set(0x000000)
        if (ud.edgeHelper) { ud.edgeHelper.material.color.set(0x000000); ud.edgeHelper.material.opacity = 0.1 }
      })
    }
    try { return fn() } finally {
      restore.forEach(([mat, col, e, ei, edge, ec, eo]) => {
        mat.color.copy(col); if (e && mat.emissive) mat.emissive.copy(e); mat.emissiveIntensity = ei
        if (edge) { edge.material.color.copy(ec); edge.material.opacity = eo }
      })
    }
  }

  /**
   * Render ORTOGONAL (proyección paralela real, sin perspectiva) de la composición con
   * sus cotas de vista, a `pxW×pxH` px, sobre Charcoal #0D0D0D. Devuelve un <canvas>.
   * Síncrono de punta a punta: ningún frame de la animación se intercala.
   */
  const renderOrthoView = (mode, items, pxW, pxH) => {
    const renderer = rendererRef.current, scene = sceneRef.current, grp = groupRef.current
    if (!renderer || !scene || !grp || !items.length) return null
    const sideIds = mode === 'side' ? [items.reduce((a, b) => (b.box.xMax > a.box.xMax ? b : a)).id] : null
    const ov = buildDimensionOverlay({ items, scale: SCALE, tolMm: 5, mode, sideIds })
    scene.add(ov)
    ov.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(grp).union(new THREE.Box3().setFromObject(ov))
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3())
    const viewW = (mode === 'side' ? sz.z : sz.x) * 1.08, viewH = sz.y * 1.08
    const aspect = pxW / pxH
    const fw = Math.max(viewW, viewH * aspect), fh = fw / aspect
    const cam = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, 20000)
    if (mode === 'side') cam.position.set(box.max.x + 2000, c.y, c.z)
    else cam.position.set(c.x, c.y, box.max.z + 2000)
    cam.up.set(0, 1, 0)
    cam.lookAt(c)
    cam.updateProjectionMatrix()
    const savedBg = scene.background, savedFog = scene.fog
    const live = [dimsGroupRef.current, axesGroupRef.current].filter(Boolean).map(g => [g, g.visible])
    live.forEach(([g]) => { g.visible = false })
    try {
      scene.background = new THREE.Color(0x0d0d0d)
      scene.fog = null              // la niebla oscurece a 2000 u de distancia
      renderer.setPixelRatio(1)
      renderer.setSize(pxW, pxH, false)
      renderer.render(scene, cam)
      const out = document.createElement('canvas')
      out.width = pxW; out.height = pxH
      out.getContext('2d').drawImage(renderer.domElement, 0, 0, pxW, pxH)
      return out
    } finally {
      scene.background = savedBg; scene.fog = savedFog
      live.forEach(([g, v]) => { g.visible = v })
      scene.remove(ov); disposeOverlay(ov)
    }
  }

  // ─── ★ 2026-10-10 (b) — FICHA TÉCNICA DE TALLER (PNG) ─────────────────────────
  //   Alzado frontal + perfil lateral ortogonales, cotas activas, pie técnico.
  //   Lo que sale es exactamente la geometría del visor (misma escena, sin redibujo).
  const handleExportSheet = useCallback(async () => {
    const renderer = rendererRef.current
    if (!renderer || isExportingSheet) return
    const { items } = collectOverlayItems()
    if (!items.length) return
    setIsExportingSheet(true)
    const prevRatio = renderer.getPixelRatio()
    const prevSize = renderer.getSize(new THREE.Vector2())
    try {
      const PW = 1540, PH = 1340   // ≈ 2× de un panel de 770×670 → impresión nítida
      const [front, side] = withCleanMaterials(() => [
        renderOrthoView('front', items, PW, PH),
        renderOrthoView('side', items, PW, PH),
      ])
      if (!front || !side) return
      const W = 3200, H = 1960, HEAD = 150, FOOT = 300, GAP = 40
      const sheet = document.createElement('canvas')
      sheet.width = W; sheet.height = H
      const g = sheet.getContext('2d')
      g.fillStyle = '#0D0D0D'; g.fillRect(0, 0, W, H)
      const font = (w, px) => `${w} ${px}px Inter, system-ui, sans-serif`
      let projectId = ''
      try { projectId = localStorage.getItem('orbin-project-id') || '' } catch (_) {}
      g.textBaseline = 'middle'
      g.fillStyle = '#F5A623'; g.font = font(800, 54); g.fillText('ORBIN AI · FICHA TÉCNICA DE TALLER', 60, HEAD / 2)
      g.fillStyle = '#BDBDBD'; g.font = font(500, 34); g.textAlign = 'right'
      g.fillText(`${projectId ? projectId + ' · ' : ''}${new Date().toLocaleString()}`, W - 60, HEAD / 2)
      g.textAlign = 'left'
      const panel = (img, x, title) => {
        g.strokeStyle = '#2A2A2A'; g.lineWidth = 3; g.strokeRect(x, HEAD, PW, PH + 70)
        g.fillStyle = '#E5E5E5'; g.font = font(800, 32); g.fillText(title, x + 24, HEAD + 36)
        g.drawImage(img, x, HEAD + 70)
      }
      panel(front, 60, 'ALZADO FRONTAL')
      panel(side, 60 + PW + GAP, 'PERFIL LATERAL (vista desde la derecha)')
      // Pie técnico: cotas netas
      const plan = buildDimensionPlan(items, { tolMm: 5 })
      const ctClusters = buildCountertopClusters(items.filter(i => countertopEligibility(i.module, i.box.rotation).ok))
      const lines = [
        'Módulos: ' + items.map((it, i) => {
          const c = it.module.configuration
          return `M${i + 1} ${c.width}×${c.height}×${c.depth}${it.box.rotation ? ` (giro ${it.box.rotation}°)` : ''}`
        }).join('  ·  '),
        plan.chains.length ? 'Corridas: ' + plan.chains.map(chainLabel).join('  ·  ') : 'Corridas: —',
        ctClusters.length
          ? 'Tampos: ' + ctClusters.map(cl => `${cl.width} × ${Math.round(cl.zMax - cl.zMin) + 20} × 30 mm a ${Math.round(cl.topY)} mm`).join('  ·  ')
          : 'Tampos: —',
        'Medidas en mm · proyección ortogonal · verificar en obra antes de cortar.',
      ]
      const y0 = HEAD + PH + 70 + 50
      lines.forEach((t, i) => {
        g.fillStyle = i === lines.length - 1 ? '#8A8A8A' : '#E5E5E5'
        g.font = font(i === lines.length - 1 ? 500 : 600, 32)
        g.fillText(t, 60, y0 + i * 52, W - 120)
      })
      const blob = await new Promise(res => sheet.toBlob(res, 'image/png'))
      if (!blob) return
      const name = `orbin-ficha-${projectId || new Date().toISOString().slice(0, 10)}.png`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = name; a.href = url
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } finally {
      renderer.setPixelRatio(prevRatio)
      renderer.setSize(prevSize.x, prevSize.y, false)
      setIsExportingSheet(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, hiddenModules, isExportingSheet])

  // ─── ★ 2026-10-10 — OVERLAYS: cotas CAD + ejes ─────────────────────────────
  //   Corre DESPUÉS del armado de geometría (mismo ciclo, efecto declarado después).
  //   Lee posiciones reales de los grupos (incluye arrastres) y dims de la config (mm).
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !rendererRef.current) return
    // limpiar
    for (const ref of [dimsGroupRef, axesGroupRef]) {
      if (ref.current) { scene.remove(ref.current); disposeOverlay(ref.current); ref.current = null }
    }
    const { items, selectedBox, selectedInfo } = collectOverlayItems()
    setTransformInfo(selectedInfo)
    if (showDims && items.length) {
      const g = buildDimensionOverlay({ items, scale: SCALE, tolMm: 5, mode: viewMode })
      g.visible = !isDragMoving
      scene.add(g); dimsGroupRef.current = g
    }
    if (showAxes) {
      const all = items.map(i => i.box)
      const span = all.length ? Math.max(...all.map(b => Math.max(b.xMax - b.xMin, b.yMax - b.yMin))) : 1000
      const origin = selectedBox ? { x: selectedBox.xMin, y: selectedBox.yMin, z: selectedBox.zMax } : { x: 0, y: 0, z: 0 }
      const g = buildAxesOverlay({ origin, sizeMm: Math.max(600, span * 0.5), scale: SCALE })
      g.visible = !isDragMoving
      scene.add(g); axesGroupRef.current = g
    }
  }, [modules, hiddenModules, showDims, showAxes, selectedModuleId, overlayVersion, isDragMoving, isReady, viewMode])

  // Limpieza de overlays al desmontar
  useEffect(() => () => {
    for (const ref of [dimsGroupRef, axesGroupRef]) {
      if (ref.current) { sceneRef.current?.remove(ref.current); disposeOverlay(ref.current); ref.current = null }
    }
  }, [])

  // --- Export PNG ---
  // ★ 2026-10-10 — CAPTURA PARA WHATSAPP: render a 2× (nítido), incluye cotas/ejes
  //   activos (viven en la escena) y agrega un pie con fecha y medidas. En móvil usa
  //   la hoja de compartir nativa (WhatsApp directo) si el navegador la soporta.
  const handleExport = useCallback(async () => {
    const renderer = rendererRef.current, scene = sceneRef.current, cam = camRef.current
    if (!renderer || !scene || !cam) return
    const prevRatio = renderer.getPixelRatio()
    const size = renderer.getSize(new THREE.Vector2())
    // Foto "limpia" para el cliente: sin el resaltado ámbar de selección/hover.
    const restore = []
    if (!stateRef.current.wireframe) {
      meshesRef.current.forEach(m => {
        const mat = m.material, ud = m.userData
        if (!mat?.color || ud?.originalColor === undefined) return
        restore.push([mat, mat.color.clone(), mat.emissive?.clone(), mat.emissiveIntensity, ud.edgeHelper, ud.edgeHelper?.material.color.clone(), ud.edgeHelper?.material.opacity])
        mat.color.set(ud.originalColor)
        if (mat.emissive) mat.emissive.set(0x000000)
        if (ud.edgeHelper) { ud.edgeHelper.material.color.set(0x000000); ud.edgeHelper.material.opacity = 0.1 }
      })
    }
    let src
    try {
      renderer.setPixelRatio(Math.max(2, prevRatio))
      renderer.setSize(size.x, size.y, false)
      renderer.render(scene, cam)   // render directo: el composer conserva su buffer a 1×
      src = renderer.domElement
      const out = document.createElement('canvas')
      const footer = Math.round(src.height * 0.06)
      out.width = src.width; out.height = src.height + footer
      const ctx = out.getContext('2d')
      ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0, 0, out.width, out.height)
      ctx.drawImage(src, 0, 0)
      const mods = (Array.isArray(modules) ? modules : []).filter(m => m?.configuration)
      const dims = mods.slice(0, 4).map(m => `${m.configuration.width}×${m.configuration.height}×${m.configuration.depth}`).join(' · ')
      ctx.fillStyle = '#F5A623'
      ctx.font = `700 ${Math.round(footer * 0.42)}px Inter, system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText('Orbin AI', footer * 0.4, src.height + footer / 2)
      ctx.fillStyle = '#E5E5E5'
      ctx.font = `500 ${Math.round(footer * 0.36)}px Inter, system-ui, sans-serif`
      const meta = `${mods.length} módulo(s)${dims ? ' · ' + dims + ' mm' : ''} · ${new Date().toLocaleString()}`
      ctx.fillText(meta, footer * 0.4 + ctx.measureText('Orbin AI ').width * 1.25, src.height + footer / 2)
      const blob = await new Promise(res => out.toBlob(res, 'image/png'))
      if (!blob) return
      const name = `orbin-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
      const isTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0
      if (isTouch && file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Orbin AI' }); return } catch (_) { /* cancelado → descarga */ }
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = name; link.href = url
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } finally {
      restore.forEach(([mat, c, e, ei, edge, ec, eo]) => {
        mat.color.copy(c); if (e && mat.emissive) mat.emissive.copy(e); mat.emissiveIntensity = ei
        if (edge) { edge.material.color.copy(ec); edge.material.opacity = eo }
      })
      renderer.setPixelRatio(prevRatio)
      renderer.setSize(size.x, size.y, false)
    }
  }, [modules])

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
    <div className="orbin-viewer-root relative w-full h-full group select-none overflow-hidden" style={{ minHeight: 'clamp(260px, 45vw, 600px)' }}>
      <canvas ref={mountRef} className="absolute inset-0 w-full h-full block" style={{ minHeight: 'clamp(260px, 45vw, 600px)' }} />

      {/* ★ PROTECTED: Drag-to-move indicator */}
      {isDragMoving && (
        <div className="absolute top-4 right-16 bg-[#00AAFF]/20 backdrop-blur-md border border-[#00AAFF]/40 px-3 py-1.5 rounded-full z-30 pointer-events-none">
          <span className="text-[#00AAFF] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <GripVertical size={12} /> {t('moving_module', 'Moviendo módulo')}
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
            <div className={`w-2 h-2 rounded-full ${pieceSet.size > 0 ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {pieceSet.size > 1 ? `${pieceSet.size} ${t('pieces', 'piezas')}` : (hoveredInfo?.type || 'info')}
            </span>
          </div>
          {/* ★ El motor NUNCA traduce (los nombres son identificadores de nesting/BOM).
              La traducción es responsabilidad del cliente, en el punto de pintado. */}
          <h4 className="text-sm font-bold text-white">
            {hoveredInfo?.name ? localizePieceName(hoveredInfo.name, lang) : t('piece', 'Pieza')}
          </h4>
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#00FF99]/10 backdrop-blur-md border border-[#00FF99]/40 px-4 py-2 rounded-full z-30 pointer-events-none">
          <span className="text-[#00FF99] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Ruler size={12} /> {rulerDistance} mm
          </span>
        </div>
      )}

      {/* ★ 2026-10-11 (refactor) — Barra HUD unificada top: vistas izquierda · acciones derecha */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">

        {/* ── Grupo IZQUIERDO: tabs de vista ── */}
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
          {[
            { id: 'iso',   label: '3D' },
            { id: 'front', label: lang === 'PT' ? 'Frontal' : lang === 'EN' ? 'Front' : 'Frontal' },
            { id: 'side',  label: lang === 'PT' ? 'Lateral' : lang === 'EN' ? 'Side' : 'Lateral' },
          ].map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => setTechnicalView(v.id)}
              aria-pressed={viewMode === v.id}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === v.id ? 'bg-primary text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {v.label}
            </button>
          ))}
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={handleExportSheet}
            disabled={isExportingSheet}
            aria-label={lang === 'PT' ? 'Exportar Ficha Técnica (PNG)' : lang === 'EN' ? 'Export Technical Sheet (PNG)' : 'Exportar Ficha Técnica (PNG)'}
            title={lang === 'PT' ? 'Ficha técnica: frontal + lateral ortogonais com cotas' : lang === 'EN' ? 'Technical sheet: orthographic front + side with dimensions' : 'Ficha técnica: frontal + lateral ortogonales con cotas'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/15 transition-all disabled:opacity-50"
          >
            {isExportingSheet ? <Loader2 size={13} className="animate-spin" /> : <FileImage size={13} />}
            {lang === 'EN' ? 'Sheet' : 'Ficha'}
          </button>
        </div>

        {/* ── Grupo DERECHO: proyecto + export + AR ── */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
          {/* Nuevo Proyecto */}
          <button
            onClick={onNewProject}
            className="p-2.5 rounded-xl transition-all duration-200 group/btn relative hover:bg-white/10 text-white/70 hover:text-primary"
            aria-label={lang === 'ES' ? 'Nuevo Proyecto' : lang === 'PT' ? 'Novo Projeto' : 'New Project'}
          >
            <FilePlus size={17} className="text-primary" />
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0D0D0D] border border-white/10 text-[10px] text-white/90 font-black uppercase tracking-widest py-1.5 px-3 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
              {lang === 'ES' ? 'Nuevo Proyecto' : lang === 'PT' ? 'Novo Projeto' : 'New Project'}
            </span>
          </button>

          {/* Guardar Diseño */}
          <button
            onClick={() => {
              if (typeof onSaveProject === 'function') onSaveProject();
              openSaveModal();
            }}
            className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative
                       ${viability.viable ? 'hover:bg-primary/20 text-primary' : 'text-white/35 hover:bg-white/5'}`}
            aria-label={lang === 'ES' ? 'Guardar Diseño' : lang === 'PT' ? 'Salvar Design' : 'Save Design'}
            aria-disabled={!viability.viable}
            title={!viability.viable ? (blockedMsg || '') : undefined}
          >
            {viability.viable ? <Save size={17} className="text-primary" /> : <ShieldAlert size={17} />}
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0D0D0D] border border-white/10 text-[10px] text-white/90 font-black uppercase tracking-widest py-1.5 px-3 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
              {lang === 'ES' ? 'Guardar Diseño' : lang === 'PT' ? 'Salvar Design' : 'Save Design'}
            </span>
          </button>

          <div className="w-px h-5 bg-white/10 mx-0.5" />

          {/* Exportar PNG */}
          <button
            onClick={handleExport}
            className="p-2.5 rounded-xl transition-all duration-200 group/btn relative hover:bg-white/10 text-white/70 hover:text-white"
            aria-label={lang === 'ES' ? 'Exportar PNG' : lang === 'PT' ? 'Exportar PNG' : 'Export PNG'}
          >
            <Download size={17} />
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0D0D0D] border border-white/10 text-[10px] text-white/80 font-black uppercase tracking-widest py-1.5 px-3 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
              {lang === 'ES' ? 'Exportar PNG' : lang === 'PT' ? 'Exportar PNG' : 'Export PNG'}
            </span>
          </button>

          {/* Vista AR */}
          <button
            onClick={handleViewInAR}
            disabled={isExportingAR || isEmpty}
            className="p-2.5 rounded-xl transition-all duration-200 group/btn relative hover:bg-primary/20 text-primary disabled:opacity-40 disabled:pointer-events-none"
            aria-label={lang === 'ES' ? 'Ver en AR' : lang === 'PT' ? 'Ver em AR' : 'View in AR'}
          >
            {isExportingAR ? <Loader2 size={17} className="animate-spin" /> : <Scan size={17} />}
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0D0D0D] border border-white/10 text-[10px] text-white/80 font-black uppercase tracking-widest py-1.5 px-3 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
              {lang === 'ES' ? 'Ver en AR' : lang === 'PT' ? 'Ver em AR' : 'View in AR'}
            </span>
          </button>
        </div>

      </div>

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

        {/* ★ 2026-10-10 — Herramientas de taller: girar, cotas, ejes */}
        <div className="h-px bg-white/10 mx-1.5" />

        <button
          onClick={() => { if (selectedModuleId && typeof onRotateModule === 'function') onRotateModule(selectedModuleId) }}
          disabled={!selectedModuleId || typeof onRotateModule !== 'function'}
          aria-label={lang === 'PT' ? 'Girar móvel 90°' : lang === 'EN' ? 'Rotate module 90°' : 'Girar mueble 90°'}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            selectedModuleId ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'text-white/25 cursor-not-allowed'
          }`}
        >
          <RotateCw size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {selectedModuleId
              ? (lang === 'PT' ? `Girar móvel 90° (agora ${transformInfo?.rotation ?? 0}°)` : lang === 'EN' ? `Rotate 90° (now ${transformInfo?.rotation ?? 0}°)` : `Girar mueble 90° (ahora ${transformInfo?.rotation ?? 0}°)`)
              : (lang === 'PT' ? 'Selecione um móvel para girar' : lang === 'EN' ? 'Select a module to rotate' : 'Seleccioná un mueble para girar')}
          </span>
        </button>

        <button
          onClick={() => setShowDims(v => !v)}
          aria-pressed={showDims}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            showDims ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]' : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <DraftingCompass size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'PT' ? 'Cotas (largura · altura · profundidade)' : lang === 'EN' ? 'Dimensions (W · H · D)' : 'Cotas (ancho · alto · profundidad)'}
          </span>
        </button>

        <button
          onClick={() => setShowAxes(v => !v)}
          aria-pressed={showAxes}
          className={`p-2.5 rounded-xl transition-all duration-200 group/btn relative ${
            showAxes ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.3)]' : 'hover:bg-white/10 text-white/80 hover:text-white'
          }`}
        >
          <Axis3d size={18} />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-black border border-white/10 text-white text-[10px] font-bold py-1 px-2 rounded-md opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'PT' ? 'Eixos X · Y · Z' : lang === 'EN' ? 'X · Y · Z axes' : 'Ejes X · Y · Z'}
          </span>
        </button>
      </div>

      {/* ★ 2026-10-10 — Posición del módulo seleccionado (mm). X/Z → `position`;
          Y → en aéreos edita `mountHeight` (altura de instalación), si no `position.y`. */}
      {transformInfo && typeof onUpdateTransform === 'function' && (
        <TransformPanel
          key={`${transformInfo.id}:${transformInfo.x}:${transformInfo.y}:${transformInfo.z}`}
          info={transformInfo}
          lang={lang}
          onCommit={(axis, value) => {
            if (!Number.isFinite(value)) return
            if (axis === 'y' && transformInfo.isAereo) onUpdateModule(transformInfo.id, { mountHeight: Math.max(0, Math.round(value)) })
            else onUpdateTransform(transformInfo.id, { position: { [axis]: Math.round(value) } })
          }}
        />
      )}

      {/* Floating Operations Bar — acciones de módulo (Agregar / Eliminar) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-2 px-4 rounded-full border border-white/10 shadow-2xl z-20">
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

        {/* Celda 4 — Presentación */}
        <button
          onClick={() => setIsPresentationMode(true)}
          className="p-2.5 rounded-xl transition-all duration-200 group/btn relative
                     hover:bg-white/10 text-white/80 hover:text-white"
          title="Modo Presentación (turntable)"
          aria-label="Activar modo presentación"
        >
          <MonitorPlay size={18} />
          <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-black border border-white/10
                           text-white text-[10px] font-bold py-1 px-2 rounded-md
                           opacity-0 group-hover/btn:opacity-100 pointer-events-none
                           transition-opacity whitespace-nowrap shadow-lg">
            {lang === 'ES' ? 'Presentación' : lang === 'PT' ? 'Apresentação' : 'Presentation'}
          </span>
        </button>
      </div>

      {/* ★ Modo Presentación (cinematic turntable) — antes el botón no renderizaba nada.
          Ahora se cablea pasando la cámara y los controles reales; PresentationMode
          orbita alrededor del centro del modelo (controls.target). */}
      {isPresentationMode && (
        <PresentationMode
          camera={camRef.current}
          controls={controlsRef.current}
          renderer={rendererRef.current}
          scene={sceneRef.current}
          composer={composerRef.current}
          isEnabled={isPresentationMode}
          onToggle={() => setIsPresentationMode(false)}
        />
      )}

      {/* ─── [2026-10-11] Old standalone right toolbar — fusionada en barra unificada ─── */}

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

      {/* ★ 2026-10-10 — Modal compacto "Guardar en Galería" (nombre + categoría) */}
      {saveOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !saving && setSaveOpen(false)}>
          <div className="w-[320px] max-w-[90%] bg-[#151518] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                <BookmarkPlus size={15} className="text-emerald-300" />
                {lang === 'PT' ? 'Salvar na Galeria' : lang === 'EN' ? 'Save to Gallery' : 'Guardar en Galería'}
              </h3>
              <button onClick={() => !saving && setSaveOpen(false)} className="text-white/50 hover:text-white p-1" aria-label="Cerrar"><X size={16} /></button>
            </div>
            <label className="block space-y-1">
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">{lang === 'PT' ? 'Nome do móvel' : lang === 'EN' ? 'Furniture name' : 'Nombre del mueble'}</span>
              <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSaveToGallery() }}
                placeholder="Balcão Cozinha 1200"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-400/60" />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">{lang === 'PT' ? 'Categoria' : lang === 'EN' ? 'Category' : 'Categoría'}</span>
              <select value={saveCat} onChange={e => setSaveCat(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-400/60 cursor-pointer">
                <option value="" className="bg-[#151518]">{lang === 'PT' ? 'Sem categoria' : lang === 'EN' ? 'Uncategorized' : 'Sin clasificar'}</option>
                {GALLERY_CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-[#151518]">{c.label}</option>)}
              </select>
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSaveOpen(false)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/70 border border-white/5 hover:text-white disabled:opacity-40">
                {lang === 'PT' ? 'Cancelar' : lang === 'EN' ? 'Cancel' : 'Cancelar'}
              </button>
              <button onClick={doSaveToGallery} disabled={saving || !saveName.trim()}
                className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {lang === 'PT' ? 'Salvar' : lang === 'EN' ? 'Save' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ★ 2026-10-10 — Toast de confirmación / aviso de bloqueo */}
      {toast && (
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[55] max-w-[92%] px-4 py-2.5 rounded-xl text-[11px] font-bold shadow-2xl border flex items-center gap-2
          ${toast.type === 'ok' ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40' : 'bg-rose-500/15 text-rose-200 border-rose-400/40'}`}>
          {toast.type === 'ok' ? <Check size={14} /> : <ShieldAlert size={14} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}


// ─── ★ 2026-10-10 — Panel compacto de coordenadas (mm) ─────────────────────────
function TransformPanel({ info, lang, onCommit }) {
  const [vals, setVals] = useState({ x: info.x, y: info.y, z: info.z })
  const L = lang === 'PT'
    ? { title: 'Posição (mm)', y: info.isAereo ? 'Y · instalação' : 'Y', rot: 'Giro' }
    : lang === 'EN'
      ? { title: 'Position (mm)', y: info.isAereo ? 'Y · mount' : 'Y', rot: 'Rotation' }
      : { title: 'Posición (mm)', y: info.isAereo ? 'Y · instalación' : 'Y', rot: 'Giro' }
  const commit = (axis) => {
    const v = Number(vals[axis])
    if (!Number.isFinite(v) || v === info[axis]) return
    onCommit(axis, v)
  }
  const field = (axis, label, color) => (
    <label className="flex items-center gap-1.5">
      <span className={`text-[10px] font-black w-auto ${color}`}>{label}</span>
      <input
        type="number"
        step={10}
        value={vals[axis]}
        onChange={e => setVals(v => ({ ...v, [axis]: e.target.value }))}
        onBlur={() => commit(axis)}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono text-white focus:border-primary/60 outline-none"
      />
    </label>
  )
  return (
    <div className="absolute bottom-24 right-4 z-30 bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted">{L.title}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-primary">{L.rot} {info.rotation}°</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {field('x', 'X', 'text-[#FF5A5A]')}
        {field('y', L.y, 'text-[#5AFF7A]')}
        {field('z', 'Z', 'text-[#5A9BFF]')}
      </div>
    </div>
  )
}
