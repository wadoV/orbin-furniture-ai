/**
 * Orbin AI — 3D Closet Viewer (V2.3 StrictMode-Safe + Drag & Snap)
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
import { usePreferences } from '../context/PreferencesContext.jsx'
import { Layers, Maximize, Download, Loader2, Move, Plus, Trash2, Box, GripVertical, Ruler, ArrowLeft } from 'lucide-react'

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

const SELECTION_COLOR = 0x00FF99
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
}) {
  const { t } = usePreferences()
  const mountRef = useRef(null)

  // ★ StrictMode guard — prevents double init
  const initRef = useRef(false)

  // Three.js persistent refs (survive StrictMode remount)
  const sceneRef     = useRef(null)
  const rendererRef  = useRef(null)
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

    const container = mountRef.current
    container.innerHTML = ''

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x0f0f0f, 1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // --- Scene ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f0f)
    sceneRef.current = scene

    // --- Camera ---
    const cam = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 50000)
    cam.position.set(350, 250, 450)
    camRef.current = cam

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7)
    mainLight.position.set(200, 400, 300)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.set(2048, 2048)
    scene.add(mainLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-200, 200, -100)
    scene.add(fillLight)

    // --- Grid ---
    const grid = new THREE.GridHelper(1000, 100, 0x222222, 0x111111)
    grid.position.y = -0.2
    scene.add(grid)
    gridRef.current = grid

    // --- Controls ---
    const controls = new OrbitControls(cam, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // --- Group for furniture ---
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // --- Resize ---
    const onResize = () => {
      if (!container.parentElement) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // --- Mouse tracking ---
    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    renderer.domElement.addEventListener('mousemove', onMouseMove)

    // --- Click / Box select / ★ PROTECTED: Drag-to-move ---
    const onMouseDown = (e) => {
      if (stateRef.current.orbitMode) return
      if (e.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
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
            modulePositionsRef.current[moduleId] = { x: mGroup.position.x, z: mGroup.position.z }
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
    renderer.domElement.addEventListener('mousedown', onMouseDown)

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

      renderer.render(scene, cam)
    }
    animate()
    setIsReady(true)

    // ★ NO cleanup that destroys the renderer — it persists for the component lifetime.
    // React StrictMode will call cleanup then re-run, but initRef prevents re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ★ PROTECTED: Delete key handler — removes selected module from scene
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Ignore if user is typing in an input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
        const modId = stateRef.current.selectedModuleId
        if (modId) {
          e.preventDefault()
          // Clean position cache for deleted module
          delete modulePositionsRef.current[modId]
          delete moduleGroupsRef.current[modId]
          onDeleteModule(modId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDeleteModule])

  // ─── 2. Build Geometry from Configuration (Parametric Construction Logic) ──
  useEffect(() => {
    if (!modules || modules.length === 0 || !isReady) return
    if (!groupRef.current) return

    const group = groupRef.current
    const scene = sceneRef.current
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
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.6,
          metalness: 0.1,
          transparent: true,
          opacity: 1,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const edgesGeo = new THREE.EdgesGeometry(geo)
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
        const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
        edgeHelper.userData._isEdge = true

        mesh.userData = {
          id: `${design.id}-${type}-${pieceName}-${dIdx}-${Math.random().toString(36).substr(2, 5)}`,
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
      const saved = modulePositionsRef.current[design.id]
      if (saved) {
        mGroup.position.x = saved.x
        mGroup.position.z = saved.z
      } else {
        const newX = maxRightEdge + W / 2 + (maxRightEdge > 0 ? 5 : 0)
        mGroup.position.x = newX
        maxRightEdge = newX + W / 2
        modulePositionsRef.current[design.id] = { x: newX, z: 0 }
      }
      moduleGroupsRef.current[design.id] = mGroup
      mGroup.userData.moduleId = design.id
      mGroup.userData.moduleWidth = W
      const xOffset = 0  // ★ PROTECTED: Pieces positioned relative to module center

      const bodyColor  = MATERIAL_COLORS[cfg.materialBody]  || TYPE_COLORS.structural
      const frontColor = MATERIAL_COLORS[cfg.materialFront] || TYPE_COLORS.drawer_front
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
      if (cfg.hasCountertop) {
        const ctW = W + 4
        const ctD = D + 2
        const ctH = 3
        const ct = makeMesh(ctW, ctH, ctD, ctColor, 'Encimera', 'countertop')
        ct.position.set(xOffset, yBase + H + ctH / 2, ctD / 2 - 1)
        mGroup.add(ct)
      }

      // === DRAWERS ===
      const nD = cfg.numDrawers || 0
      const dH = (cfg.drawerHeight || 180) * SCALE
      const isHorizontal = cfg.drawerLayout === 'horizontal'
      let curY = yBase + BH + T

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
              const db = makeMesh(colW - 3, dH - 4, iD - 4, TYPE_COLORS.drawer_box, 'Cuerpo Gaveta', 'drawer_box', dKey)
              db.position.set(startX, colY + dH / 2, zCenter)
              mGroup.add(db)
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
            const db = makeMesh(iW - 3, dH - 4, iD - 4, TYPE_COLORS.drawer_box, 'Cuerpo Gaveta', 'drawer_box', dKey)
            db.position.set(xOffset, curY + dH / 2, zCenter)
            mGroup.add(db)
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
  }, [modules, isReady, hiddenModules])

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
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, transparent: true })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.position.set((p.x || 0) * SCALE, (p.y || 0) * SCALE, (p.z || 0) * SCALE)

      const edgesGeo = new THREE.EdgesGeometry(geo)
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
      const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
      edgeHelper.userData._isEdge = true

      mesh.userData = {
        id: p.id || `piece-${dIdx}-${i}`,
        moduleId: design.id,
        w: p.width, h: p.height, d: p.thickness,
        name: p.name || p.type,
        type: p.type,
        originalColor: color,
        edgeHelper,
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

  // --- Empty State ---
  const isEmpty = modules.length === 0

  return (
    <div className="relative w-full h-full group select-none overflow-hidden" style={{ minHeight: '600px' }}>
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '600px' }} />

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

      {/* Floating controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface/80 backdrop-blur-md p-2 px-4 rounded-full border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
        <button
          onClick={() => setOrbitMode(m => !m)}
          className={`p-2.5 rounded-full transition-all ${orbitMode ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`}
          title="Orbit Mode"
        >
          <Move size={18} />
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        <button onClick={() => setExploded(e => !e)} className={`p-2.5 rounded-full transition-all ${exploded ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`} title="Exploded View">
          <Maximize size={18} />
        </button>
        <button onClick={() => setWireframe(w => !w)} className={`p-2.5 rounded-full transition-all ${wireframe ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`} title="Wireframe">
          <Layers size={18} />
        </button>
        {/* ★ PROTECTED: Ruler tool — measure distances between modules/points */}
        <button
          onClick={() => { setRulerMode(m => !m); setRulerPoints([]); setRulerDistance(null) }}
          className={`p-2.5 rounded-full transition-all ${rulerMode ? 'bg-[#00FF99] text-black shadow-[0_0_15px_rgba(0,255,153,0.4)]' : 'hover:bg-surface-3 text-white'}`}
          title="Ruler / Measure"
        >
          <Ruler size={18} />
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        <button onClick={onAddModule} className="p-2.5 rounded-full hover:bg-surface-3 text-white transition-all" title="Add Module">
          <Plus size={18} />
        </button>
        {selectedModuleId && (
          <button
            onClick={() => onDeleteModule(selectedModuleId)}
            className="p-2.5 rounded-full hover:bg-danger bg-danger/10 text-danger hover:text-white transition-all"
            title="Delete Module"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        className="absolute top-4 right-4 p-2.5 bg-surface/40 hover:bg-primary text-white hover:text-black rounded-xl backdrop-blur-md transition-all border border-white/5 shadow-lg z-20"
        title="Export PNG"
      >
        <Download size={16} />
      </button>

      {/* ★ PROTECTED: Layers panel toggle (top-left) */}
      <button
        onClick={() => setShowLayers(l => !l)}
        className={`absolute top-4 left-4 p-2.5 rounded-xl backdrop-blur-md transition-all border shadow-lg z-20 ${
          showLayers ? 'bg-primary text-black border-primary' : 'bg-surface/40 hover:bg-primary text-white hover:text-black border-white/5'
        }`}
        title="Layers"
      >
        <Layers size={16} />
      </button>

      {/* ★ PROTECTED: CAD-style Layers Panel (bottom horizontal bar) */}
      {showLayers && modules.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 z-20 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={12} className="text-primary" />
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">{t('layers') || 'Capas'}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-3 pb-1">
            {modules.map((mod, idx) => {
              const isHidden = hiddenModules.has(mod.id)
              const isSelected = selectedModuleId === mod.id
              return (
                <div
                  key={mod.id}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary/50 shadow-[0_0_8px_rgba(245,166,35,0.2)]'
                      : 'bg-surface-3/50 border-white/5 hover:border-white/20'
                  } ${isHidden ? 'opacity-40' : ''}`}
                  onClick={() => onSelectModule(mod.id)}
                >
                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setHiddenModules(prev => {
                        const next = new Set(prev)
                        next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id)
                        return next
                      })
                    }}
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${
                      isHidden ? 'border-white/20 bg-transparent' : 'border-primary bg-primary'
                    }`}
                  >
                    {!isHidden && <span className="text-[8px] text-black font-black">✓</span>}
                  </button>
                  <div>
                    <p className="text-[10px] font-bold text-white leading-none">
                      {mod.configuration?.moduleType || 'Módulo'} #{idx + 1}
                    </p>
                    <p className="text-[8px] text-muted mt-0.5">
                      {mod.configuration?.width || '?'}×{mod.configuration?.height || '?'}×{mod.configuration?.depth || '?'} mm
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
