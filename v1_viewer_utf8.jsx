/**
 * Orbin AI ÔÇö 3D Closet Viewer (Professional Edition)
 * Optimized Three.js implementation with real-time selection and module management.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { Layers, Maximize, MousePointer2, Info, Plus, Download, Loader2, Lightbulb, Move } from 'lucide-react'
import CarpentryAdvisor from './CarpentryAdvisor.jsx'

// ÔöÇÔöÇÔöÇ Color map by material/piece ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const MATERIAL_COLORS = {
  white:         0xffffff,
  oak_light:     0xC8A96E,
  oak_dark:      0x8B7355,
  graphite:      0x333333,
  green_matte:   0x7D8C71, // Sage Green from the image
  wood_dark:     0x5D4037,
  marble_white:  0xeeeeee,
  granite_black: 0x111111,
  led_warm:      0xFFD700,
  default:       0xC8A96E,
}

const TYPE_COLORS = {
  structural:    0xC8A96E,
  shelf:         0xD4B483,
  baseboard:     0x8B7355,
  // Drawer fronts: warm amber-gold ÔÇö visually warm and distinct
  drawer_front:  0xE8A020,
  // Standard doors: cool slate-blue ÔÇö clearly different from drawer fronts
  standard_door: 0x7A9BB5,
  drawer_box:    0xE8D5B0,
  drawer_bottom: 0xF0E0C0,
  feet:          0x222222,
  countertop:    0xeeeeee,
}

const SELECTION_COLOR = 0x00FF99; // Neon Green-Cyan for active piece selection
const MODULE_HIGHLIGHT_COLOR = 0xF5A623; // Premium Gold-Orange for module focus

export default function Viewer3D({ designs, selectedModuleId, selectedPieceIds, onSelectModule, onSelectPieces, onDeleteModule }) {
  const { t } = usePreferences()
  const mountRef = useRef(null)
  
  // Three.js Refs
  const sceneRef = useRef(new THREE.Scene())
  const rendererRef = useRef(null)
  const camRef = useRef(null)
  const controlsRef = useRef(null)
  const groupRef = useRef(new THREE.Group())
  const meshesRef = useRef([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const frameRef = useRef(null)
  const selectionHelperRef = useRef(null)

  // UI State
  const [exploded, setExploded] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [openDrawers, setOpenDrawers] = useState(new Set())
  const [hoveredInfo, setHoveredInfo] = useState(null)
  const [showAdvisor, setShowAdvisor] = useState(false)
  const [isReady, setIsReady] = useState(false)
  
  // Orbit / Navigate mode ÔÇö disables piece selection so user can rotate freely
  const [orbitMode, setOrbitMode] = useState(false)

  // Box selection state
  const [isDragging, setIsDragging] = useState(false)
  const [selectionBox, setSelectionBox] = useState(null) // { start: {x,y}, end: {x,y} }
  const dragStartRef = useRef(null)

  // Auto-select new modules
  useEffect(() => {
    if (designs.length > 0) {
      const last = designs[designs.length - 1];
      if (last.id !== selectedModuleId) {
        onSelectModule(last.id);
      }
    }
  }, [designs.length]);

  const stateRef = useRef({ exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode })
  useEffect(() => {
    stateRef.current = { exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode }
  }, [exploded, wireframe, selectedPieceIds, selectedModuleId, openDrawers, orbitMode])

  // 1. Initial Scene Setup
  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current
    container.innerHTML = ''

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x0f0f0f, 1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = sceneRef.current
    scene.background = new THREE.Color(0x0f0f0f)

    const cam = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 50000)
    cam.position.set(3500, 2500, 4500)
    camRef.current = cam

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.7)
    mainLight.position.set(2000, 4000, 3000)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.set(2048, 2048)
    scene.add(mainLight)

    const grid = new THREE.GridHelper(10000, 100, 0x222222, 0x111111)
    grid.position.y = -2 
    scene.add(grid)

    const controls = new OrbitControls(cam, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    scene.add(groupRef.current)

    const onResize = () => {
      if (!container || !renderer || !cam) return
      cam.aspect = container.clientWidth / container.clientHeight
      cam.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    renderer.domElement.addEventListener('mousemove', onMouseMove)

    const onMouseDown = (e) => {
      if (stateRef.current.orbitMode) return // orbit mode: OrbitControls handles all input
      if (e.button !== 0) return // Only left click
      const rect = renderer.domElement.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      dragStartRef.current = { x, y }
      
      // Start drag detection after a small threshold
      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - rect.left - dragStartRef.current.x
        const dy = moveEvent.clientY - rect.top - dragStartRef.current.y
        if (Math.sqrt(dx*dx + dy*dy) > 5) {
          setIsDragging(true)
          setSelectionBox({ 
            start: dragStartRef.current, 
            end: { x: moveEvent.clientX - rect.left, y: moveEvent.clientY - rect.top } 
          })
          controls.enabled = false
        }
      }
      
      const onUp = (upEvent) => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        
        const rectEnd = renderer.domElement.getBoundingClientRect()
        const endX = upEvent.clientX - rectEnd.left
        const endY = upEvent.clientY - rectEnd.top
        
        const dx = endX - dragStartRef.current.x
        const dy = endY - dragStartRef.current.y
        const isClick = Math.sqrt(dx*dx + dy*dy) < 5

        if (isClick) {
          // Normal Click Selection
          raycasterRef.current.setFromCamera(mouseRef.current, cam)
          const intersects = raycasterRef.current.intersectObjects(meshesRef.current)
          if (intersects.length > 0) {
            const mesh = intersects[0].object
            const { id, moduleId, drawerKey } = mesh.userData
            
            if (upEvent.shiftKey) {
              onSelectPieces(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            } else {
              onSelectModule(moduleId)
              onSelectPieces(new Set([id]))
              
              if (drawerKey) {
                setOpenDrawers(prev => {
                  const next = new Set(prev)
                  if (next.has(drawerKey)) next.delete(drawerKey)
                  else next.add(drawerKey)
                  return next
                })
              }
            }
          } else {
            onSelectModule(null)
            onSelectPieces(new Set())
          }
        } else {
          // Box Selection end
          const xMin = Math.min(dragStartRef.current.x, endX)
          const xMax = Math.max(dragStartRef.current.x, endX)
          const yMin = Math.min(dragStartRef.current.y, endY)
          const yMax = Math.max(dragStartRef.current.y, endY)
          
          const boxSelected = new Set()
          const width = rectEnd.width
          const height = rectEnd.height
          
          meshesRef.current.forEach(m => {
            const pos = m.position.clone().project(cam)
            const sx = (pos.x + 1) * width / 2
            const sy = (-pos.y + 1) * height / 2
            
            if (sx >= xMin && sx <= xMax && sy >= yMin && sy <= yMax) {
              boxSelected.add(m.userData.id)
            }
          })
          
          if (boxSelected.size > 0) {
            onSelectPieces(prev => upEvent.shiftKey ? new Set([...prev, ...boxSelected]) : boxSelected)
          }
        }

        setIsDragging(false)
        setSelectionBox(null)
        controls.enabled = true
      }
      
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    renderer.domElement.addEventListener('mousedown', onMouseDown)

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()

      const { exploded: isExp, wireframe: isWF, selectedPieceIds: selIds, selectedModuleId: selModId, openDrawers: openD, orbitMode: isOrbit } = stateRef.current
      scene.background.set(isWF ? 0xf5f5f5 : 0x0f0f0f)
      grid.visible = !isWF

      let currentHover = null
      if (isOrbit) {
        renderer.domElement.style.cursor = 'grab'
      } else {
        raycasterRef.current.setFromCamera(mouseRef.current, cam)
        const intersects = raycasterRef.current.intersectObjects(meshesRef.current)
        if (intersects.length > 0) {
          currentHover = intersects[0].object
          renderer.domElement.style.cursor = 'pointer'
        } else {
          renderer.domElement.style.cursor = 'default'
        }
      }

      meshesRef.current.forEach(m => {
        const { originalPosition, explodedPosition, drawerKey, originalColor, id, moduleId } = m.userData
        if (!originalPosition) return

        const SCALE = 0.1
        let target = isExp ? explodedPosition : originalPosition
        if (drawerKey && openD.has(drawerKey)) {
          target = target.clone().add(new THREE.Vector3(0, 0, 400 * SCALE))
        }
        m.position.lerp(target, 0.15)

        const isPieceSelected = selIds.has(id)
        const isModuleSelected = moduleId === selModId
        const isHovered = m === currentHover

        if (isWF) {
          m.material.color.set(isPieceSelected || (isModuleSelected && selIds.size === 0) ? SELECTION_COLOR : 0xffffff)
          m.material.opacity = isPieceSelected || isModuleSelected ? 0.9 : 1.0
        } else {
          const targetColor = new THREE.Color(isPieceSelected ? SELECTION_COLOR : ((isModuleSelected && selIds.size === 0) ? MODULE_HIGHLIGHT_COLOR : originalColor))
          m.material.color.lerp(targetColor, 0.2)
          const emissiveColor = new THREE.Color(isPieceSelected ? SELECTION_COLOR : (isHovered ? 0x333333 : 0x000000))
          m.material.emissive.lerp(emissiveColor, 0.2)
          m.material.emissiveIntensity = isPieceSelected ? 0.8 : 1.0
          
          // Selection highlight for module (subtle pulse if no piece selected)
          if (isModuleSelected && selIds.size === 0) {
             m.material.emissive.lerp(new THREE.Color(MODULE_HIGHLIGHT_COLOR), 0.1)
             m.material.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.005) * 0.2
          }

          m.material.opacity = (m.userData.type === 'drawer_box' || m.userData.type === 'feet') ? 0.7 : 1.0
        }

        const edge = m.userData.edgeHelper
        if (edge) {
          edge.position.copy(m.position)
          edge.visible = true
          const edgeColor = isWF ? (isPieceSelected || isModuleSelected ? 0x000000 : 0x333333) : (isPieceSelected || isModuleSelected ? 0xffffff : 0x000000)
          edge.material.color.set(edgeColor)
          edge.material.opacity = isWF ? 1.0 : (isHovered || isPieceSelected || isModuleSelected ? 0.5 : 0.1)
        }
      })

      if (currentHover) setHoveredInfo(currentHover.userData)
      else setHoveredInfo(null)

      renderer.render(scene, cam)
    }
    animate()
    setIsReady(true)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      renderer.dispose()
    }
  }, [])

  // 2. Build/Update Geometry
  useEffect(() => {
    if (!designs || designs.length === 0 || !isReady) return
    const group = groupRef.current
    group.clear()
    meshesRef.current = []

    const SCALE = 0.1
    let currentXOffset = 0

    designs.forEach((design, dIdx) => {
      const cfg = design?.configuration
      if (!cfg) return
      const W3 = (cfg.width || 2400) * SCALE
      const H3 = (cfg.height || 2400) * SCALE
      const D3 = (cfg.depth || 600) * SCALE
      const T3 = (cfg.thickness || 18) * SCALE
      const BT3 = (cfg.backThickness || 6) * SCALE
      const BH3 = (cfg.baseboardHeight || 100) * SCALE

      const makeMesh = (w, h, d, color, pieceName, type, drawerKey = null, isCylinder = false) => {
        const geo = isCylinder ? new THREE.CylinderGeometry(w, w, h, 16) : new THREE.BoxGeometry(w, h, d)
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.6,
          metalness: 0.1,
          transparent: true,
          opacity: 1
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        
        const edgesGeo = new THREE.EdgesGeometry(geo)
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
        const edgeHelper = new THREE.LineSegments(edgesGeo, edgesMat)
        
        mesh.userData = {
          id: `${type}-${pieceName}-${Math.random()}`,
          moduleId: design.id,
          w: w/SCALE, h: h/SCALE, d: d/SCALE,
          name: pieceName,
          type,
          originalColor: color,
          drawerKey,
          edgeHelper
        }
        
        meshesRef.current.push(mesh)
        group.add(edgeHelper)
        return mesh
      }

      const mGroup = new THREE.Group()
      const xOffset = currentXOffset + W3/2
      currentXOffset += W3 + 50 * SCALE // 50mm spacing between modules

      const isKitchenLow = cfg.type === 'kitchen_low' || cfg.type === 'kitchen_island'
      const isKitchenHigh = cfg.type === 'kitchen_high'
      
      const bodyColor = MATERIAL_COLORS[cfg.materialBody] || TYPE_COLORS.structural
      const frontColor = MATERIAL_COLORS[cfg.materialFront] || TYPE_COLORS.drawer_front
      const ctColor = MATERIAL_COLORS[cfg.countertopMaterial] || TYPE_COLORS.countertop

      // Y-Offset for high modules (suspended)
      const yBase = isKitchenHigh ? 1500 * SCALE : 0

      // Laterals
      const lp = makeMesh(T3, H3, D3, bodyColor, `Lateral Izquierdo`, 'structural')
      lp.position.set(-W3/2 + T3/2 + xOffset, yBase + H3/2, D3/2)
      mGroup.add(lp)

      const rp = makeMesh(T3, H3, D3, bodyColor, `Lateral Derecho`, 'structural')
      rp.position.set(W3/2 - T3/2 + xOffset, yBase + H3/2, D3/2)
      mGroup.add(rp)

      const iW3 = W3 - 2*T3
      const iH3 = H3 - 2*T3

      // Top
      const tp = makeMesh(iW3, T3, D3, bodyColor, `Techo`, 'structural')
      tp.position.set(xOffset, yBase + H3 - T3/2, D3/2)
      mGroup.add(tp)

      // Base Plate
      const bp = makeMesh(iW3, T3, D3, bodyColor, `Base`, 'structural')
      bp.position.set(xOffset, yBase + BH3 + T3/2, D3/2)
      mGroup.add(bp)

      // Back Panel
      const fullBkH = H3 - BH3 - T3 - T3
      const bk = makeMesh(iW3, fullBkH, BT3, bodyColor, `Fondo Estructural`, 'structural')
      bk.position.set(xOffset, yBase + BH3 + T3 + fullBkH/2, BT3/2 + 0.1 * SCALE)
      mGroup.add(bk)

      const iD3 = D3 - BT3 - 2 * SCALE 
      const zCenter = BT3 + iD3/2 + SCALE

      // Rodapie (advanced version with feet)
      if (cfg.baseboard !== false && !isKitchenHigh) {
        const fr = makeMesh(iW3, BH3, T3, bodyColor, `Z├│calo Frontal`, 'baseboard')
        fr.position.set(xOffset, BH3/2, D3 - T3/2 - 50*SCALE)
        mGroup.add(fr)

        // Feet for realism
        for (let fx of [-1, 1]) {
          const foot = makeMesh(30*SCALE, BH3, 30*SCALE, 0x222222, 'Pata Niveladora', 'feet')
          foot.position.set(xOffset + fx * (iW3/2 - 40*SCALE), BH3/2, D3/2)
          mGroup.add(foot)
        }
      }

      // Countertop
      if (cfg.hasCountertop) {
        const ctW = W3 + 40 * SCALE 
        const ctD = D3 + 20 * SCALE
        const ctH = 30 * SCALE
        const ct = makeMesh(ctW, ctH, ctD, ctColor, `Encimera`, 'countertop')
        ct.position.set(xOffset, yBase + H3 + ctH/2, ctD/2 - 10 * SCALE)
        mGroup.add(ct)
      }

      // Drawers Block
      const nD = cfg.numDrawers || 0
      const dH3 = (cfg.drawerHeight || 180) * SCALE
      const isHorizontal = cfg.drawerLayout === 'horizontal'
      let curY = yBase + BH3 + T3
      
      if (nD > 0) {
        if (isHorizontal) {
          // Horizontal Split (2 columns)
          const colW = iW3 / 2
          const drawersPerCol = Math.ceil(nD / 2)
          for (let col = 0; col < 2; col++) {
            let colY = yBase + BH3 + T3
            const startX = xOffset - iW3/2 + colW/2 + col * colW
            for (let i = 0; i < drawersPerCol; i++) {
              if (col * drawersPerCol + i >= nD) break
              const dKey = `m${dIdx}-d${col}-${i}`
              // Front ÔÇö 2mm perimetral gap each side = 4mm total W and H
              const df = makeMesh(colW - 4*SCALE, dH3 - 4*SCALE, T3, frontColor, `Frente Gaveta H-${col+1}-${i+1}`, 'drawer_front', dKey)
              df.position.set(startX, colY + dH3/2, D3 - T3/2)
              mGroup.add(df)
              // Box
              const db = makeMesh(colW - 30*SCALE, dH3 - 40*SCALE, iD3 - 40*SCALE, TYPE_COLORS.drawer_box, `Cuerpo Gaveta`, 'drawer_box', dKey)
              db.position.set(startX, colY + dH3/2, zCenter)
              mGroup.add(db)
              colY += dH3
            }
          }
          curY += drawersPerCol * dH3
        } else {
          // Vertical (Full width)
          for (let i = 0; i < nD; i++) {
            const dKey = `m${dIdx}-d${i}`
            const df = makeMesh(iW3 - 4*SCALE, dH3 - 4*SCALE, T3, frontColor, `Frente Gaveta ${i+1}`, 'drawer_front', dKey)
            df.position.set(xOffset, curY + dH3/2, D3 - T3/2)
            mGroup.add(df)
            const db = makeMesh(iW3 - 30*SCALE, dH3 - 40*SCALE, iD3 - 40*SCALE, TYPE_COLORS.drawer_box, `Cuerpo Gaveta`, 'drawer_box', dKey)
            db.position.set(xOffset, curY + dH3/2, zCenter)
            mGroup.add(db)
            curY += dH3
          }
        }
      }

      // Doors
      if (cfg.hasDoors) {
        const doorW = iW3 / 2
        const doorH = H3 - curY - (isKitchenHigh ? T3 : 0)
        const doorY = curY + doorH/2
        
        const d1 = makeMesh(doorW - 5*SCALE, doorH - 4*SCALE, T3, frontColor, `Puerta Izquierda`, 'standard_door')
        d1.position.set(xOffset - doorW/2, doorY, D3 - T3/2)
        mGroup.add(d1)

        const d2 = makeMesh(doorW - 5*SCALE, doorH - 4*SCALE, T3, frontColor, `Puerta Derecha`, 'standard_door')
        d2.position.set(xOffset + doorW/2, doorY, D3 - T3/2)
        mGroup.add(d2)
      }

      // Tapa for drawers if any
      if (nD > 0 && curY < yBase + H3 - T3) {
        const tapa = makeMesh(iW3, T3, iD3, bodyColor, `Divisoria Horizontal`, 'shelf')
        tapa.position.set(xOffset, curY + T3/2, zCenter)
        mGroup.add(tapa)
        curY += T3
      }

      // Internal Dividers (Lateral Interno)
      const nDiv = cfg.numDividers || 0
      if (nDiv > 0) {
        const divHeight = H3 - BH3 - 2 * T3
        const divSpacing = iW3 / (nDiv + 1)
        for (let i = 1; i <= nDiv; i++) {
          const divX = xOffset - iW3 / 2 + divSpacing * i
          const div = makeMesh(T3, divHeight, iD3 - 10 * SCALE, bodyColor, `Lateral Interno ${i}`, 'structural')
          div.position.set(divX, yBase + BH3 + T3 + divHeight / 2, zCenter)
          mGroup.add(div)
        }
      }

      // Shelves
      const nS = cfg.numShelves || 0
      const remainingH = H3 - (curY - yBase) - T3
      const spacing = nS > 0 ? remainingH / (nS + 1) : 0
      for(let i=0; i<nS; i++) {
        const s = makeMesh(iW3 - 2*SCALE, T3, iD3 - 25*SCALE, bodyColor, `Estante ${i+1}`, 'shelf')
        s.position.set(xOffset, curY + spacing*(i+1), zCenter + 10*SCALE)
        mGroup.add(s)
      }

      group.add(mGroup)
    })

    const bbox = new THREE.Box3().setFromObject(group)
    const bCenter = new THREE.Vector3()
    bbox.getCenter(bCenter)

    meshesRef.current.forEach(m => {
      m.userData.originalPosition = m.position.clone()
      m.userData.explodedPosition = m.position.clone().add(
        m.position.clone().sub(bCenter).normalize().multiplyScalar(50 * SCALE)
      )
    })

    if (controlsRef.current && camRef.current) {
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z) || 100
      const fov = camRef.current.fov * (Math.PI / 180)
      let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5
      camRef.current.position.set(bCenter.x + cameraDistance*0.4, bCenter.y + size.y*0.3, bCenter.z + cameraDistance)
      controlsRef.current.target.copy(bCenter)
      controlsRef.current.update()
    }
  }, [designs, isReady])

  const handleDeleteSelected = () => {
    if (selectedPieceIds.size > 0) {
      onSelectPieces(new Set())
    } else if (selectedModuleId) {
      onDeleteModule(selectedModuleId)
    }
  }

  return (
    <div className="relative w-full h-full group select-none flex">
      <div className="flex-1 relative">
        <div ref={mountRef} className="w-full h-full rounded-b-xl overflow-hidden" style={{ minHeight: '400px' }} />
        {isDragging && selectionBox && (
          <div 
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-30"
            style={{
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.start.x - selectionBox.end.x),
              height: Math.abs(selectionBox.start.y - selectionBox.end.y)
            }}
          />
        )}
        
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f]">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}
        
        {/* Tooltip */}
        {(hoveredInfo || selectedPieceIds.size > 0 || selectedModuleId) && (
          <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-xl border border-border/50 p-4 rounded-2xl pointer-events-none shadow-2xl animate-in fade-in slide-in-from-left-2 duration-300 z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${selectedPieceIds.size > 0 || selectedModuleId ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {selectedPieceIds.size > 1 ? t('multi_select') : (selectedModuleId && selectedPieceIds.size === 0 ? t('select_module') : t('information'))}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white">
              {selectedPieceIds.size > 1 ? `${selectedPieceIds.size} ${t('pieces')}` : (hoveredInfo?.name || "M├│dulo Seleccionado")}
            </h4>
            {selectedPieceIds.size <= 1 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { l: 'W', v: hoveredInfo?.w },
                  { l: 'H', v: hoveredInfo?.h },
                  { l: 'D', v: hoveredInfo?.d }
                ].map(d => d.v ? (
                  <div key={d.l} className="bg-black/20 p-1 rounded text-center">
                    <span className="text-[9px] text-muted block">{d.l}</span>
                    <span className="text-[11px] font-mono text-primary">{Math.round(d.v || 0)}</span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        )}

        {/* Floating Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface/80 backdrop-blur-md p-2 px-4 rounded-full border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-20">
          <button
            onClick={() => setOrbitMode(m => !m)}
            className={`p-2.5 rounded-full transition-all ${orbitMode ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`}
            title={t('orbit_mode')}
          >
            <Move size={18} />
          </button>
          <div className="w-[1px] h-4 bg-white/10" />
          <button onClick={() => setExploded(!exploded)} className={`p-2.5 rounded-full transition-all ${exploded ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`} title={t('exploded_view')}>
            <Maximize size={18} />
          </button>
          <button onClick={() => setWireframe(!wireframe)} className={`p-2.5 rounded-full transition-all ${wireframe ? 'bg-primary text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'hover:bg-surface-3 text-white'}`} title={t('wireframe_mode')}>
            <Layers size={18} />
          </button>
          <button onClick={() => setShowAdvisor(!showAdvisor)} className={`p-2.5 rounded-full transition-all ${showAdvisor ? 'bg-primary text-black' : 'hover:bg-surface-3 text-white'}`} title={t('carpentry_wisdom')}>
            <Lightbulb size={18} />
          </button>
          
          {(selectedModuleId || selectedPieceIds.size > 0) && (
            <>
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
              <button 
                onClick={handleDeleteSelected} 
                className="p-2.5 rounded-full hover:bg-danger bg-danger/10 text-danger hover:text-white transition-all" 
                title={selectedPieceIds.size > 0 ? t('delete_selection') : t('delete_module')}
              >
                <MousePointer2 size={18} />
              </button>
            </>
          )}
        </div>

        {/* Export */}
        <button onClick={() => {
          if (!rendererRef.current) return
          const link = document.createElement('a')
          link.download = `orbin-design-${Date.now()}.png`
          link.href = rendererRef.current.domElement.toDataURL('image/png')
          link.click()
        }} className="absolute top-4 right-4 p-2.5 bg-surface/40 hover:bg-primary text-white hover:text-black rounded-xl backdrop-blur-md transition-all border border-white/5 shadow-lg z-20">
          <Download size={16} />
        </button>
      </div>

      {/* Carpentry Advisor Sidebar */}
      {showAdvisor && (
        <div className="w-80 border-l border-white/10 p-4 bg-[#0d0d0d] hidden lg:block overflow-y-auto animate-in slide-in-from-right-full duration-300">
          <CarpentryAdvisor design={designs[designs.length-1]} />
        </div>
      )}
    </div>
  )
}

