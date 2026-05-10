# Orbin AI — Modular Kitchen & Cabinet System (V2.4.0 STABLE)

Orbin is an industrial-grade parametric design engine and AI architect for modular furniture manufacturing. Powered by **Gemini 1.5 Pro** on Google Cloud, it enforces strict manufacturing precision, automated structural auditing, and high-fidelity 3D visualization.

## Key Features

- **Gemini 1.5 Pro Engine**: Advanced reasoning for technical designs with 4096 token output and zero-shot precision in measurements (15mm/18mm).
- **Two-Pass AI Orchestration**: Every design generated is automatically audited by a secondary AI instance to verify lateral alignment, shelf clearance, and vertical baseboard integrity.
- **Ultra-Precision Construction (v4)**: Enforced 'Marceneiro Pro' rules including structural vertical baseboards and physical divider-integrated drawer banks.
- **Reactive Unit System**: Instant toggle between Millimeters (MM) and Centimeters (CM) across the entire UI and cutlist generation.
- **Parametric 3D Viewer**: High-fidelity Three.js visualization with dual render modes (Dark Solid + SketchUp Wireframe).
- **Advanced 3D Interaction**: Multi-selection, marquee drag selection, drawer open/close animation, exploded view, orbit mode.
- **Module Drag & Snap**: Drag modules freely on XZ plane; magnetic snap auto-aligns adjacent faces with visual blue guide lines.

## THICKNESS_LOGIC_STABLE_V4 (Manufacturing Standards)

The following geometric rules are the "Immutable v4 Standard" for Orbin AI:

0. **Variable Thickness (15/18/25mm)**: All structural components scale based on the selected MDF thickness. Internal widths and spacing are recalculated automatically.
1. **Vertical Baseboards (Zocalos)**: Baseboards must be pieces of `T` thickness standing vertically (structural reinforcement), not laid flat. `grainDirection` must be `vertical`.
2. **Laterals to Ground**: External laterals strictly extend to the floor (`y = H/2`). Internal laterals are captured between the top and base.
3. **Physical Drawer Separation**: When `divideDrawers` is active, internal laterals physically separate the drawer boxes and fronts, ensuring realistic manufacturing constraints.
4. **Space Validation**: Server-side protection ensures a minimum internal clearance of 50mm. Designs that 'overflow' the structure are rejected before processing.
5. **Audit Logic**: Designs failing the two-pass structural check are automatically refined before being presented to the user.
6. **Pivot Logic**: Doors rotate 90 degrees on animation; Drawers slide 400mm. Rotation axis must be the lateral edge.

## Tech Stack

- **Frontend**: React 18 + Vite 5, Three.js (vanilla), TailwindCSS, Lucide Icons.
- **Backend**: Node.js, Express, **Gemini 1.5 Pro (Vertex AI)**.
- **Design System**: Dark theme with premium glassmorphism aesthetics.
- **Local AI**: Support for Ollama (`llama3.2:1b`) as a secondary low-latency fallback.
- **3D Engine**: Three.js with OrbitControls, Raycasting, EdgesGeometry, BoxGeometry parametric construction.

## Architecture

```
Orbin/
├── client/                    # React 18 + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── Viewer3D.jsx   # ★ CORE: Three.js 3D viewer (StrictMode-safe)
│       │   ├── InputPanel.jsx # Parametric input form
│       │   ├── ResultPanel.jsx# Cut list & validation
│       │   ├── ChatPanel.jsx  # AI chat interface
│       │   ├── Header.jsx     # Top navigation bar
│       │   ├── WelcomeScreen.jsx
│       │   ├── CarpentryAdvisor.jsx
│       │   ├── ExportPanel.jsx
│       │   └── ProjectsPanel.jsx
│       ├── context/
│       │   └── PreferencesContext.jsx  # i18n + units + theme
│       ├── api/client.js      # Backend API client
│       ├── i18n.js            # PT/ES translations
│       ├── App.jsx            # Main app with undo/redo
│       ├── main.jsx           # Entry point (React.StrictMode)
│       └── index.css          # Tailwind + custom tokens
├── server/                    # Express backend
│   ├── index.js               # API routes
│   ├── closetEngine.js        # Parametric piece generator
│   └── aiOrchestrator.js      # Gemini/Ollama routing
├── start-orbin.bat            # Windows server launcher
└── README.md                  # This file
```

## Patch Notes

### v2.4.0 — UX TOOLS + LAYER SYSTEM + MEASUREMENT INDEPENDENCE (2026-05-05)
- **★ Measurement Independence (CRITICAL FIX)**:
    - InputPanel parameter changes NO LONGER auto-modify the selected module.
    - New `editMode` toggle: user must explicitly enter "Edit Mode" to modify an existing module.
    - Default behavior: panel always creates NEW modules — existing modules stay untouched.
    - "Agregar Módulo" button disabled while in edit mode (prevents confusion).
- **★ CAD-Style Layers Panel**:
    - Horizontal bottom panel (type CAD) with tabs per module.
    - Shows module type, index, and dimensions (W×H×D mm).
    - Click to select module; checkbox to toggle visibility in 3D viewer.
    - Hidden modules skip geometry generation (performance-friendly).
    - Toggle button (Layers icon, top-left) opens/closes the panel.
- **★ Ruler / Measurement Tool**:
    - Click Ruler button in floating toolbar to enter measurement mode.
    - Click two points on any piece to measure distance (displays in mm).
    - Green visual line drawn between measurement points.
    - Click again to start new measurement (auto-clears previous).
    - Distance displayed in HUD overlay (top-center, green).
- **★ Undo/Redo Navigation Buttons**:
    - Visual Undo/Redo buttons in the left panel header.
    - Disabled state when stack is empty (20% opacity).
    - Complements existing Ctrl+Z / Ctrl+Y keyboard shortcuts.
- **★ Drawer Presets**:
    - 4 quick-apply presets: 2+2, 3+3, 4 Centro, 3 Centro.
    - One click sets both `numDrawers` and `drawerLayout`.
    - Horizontal layout (2×2) option added to drawer placement buttons.
- **★ Central Divider Height Fix**:
    - When drawers span full width (horizontal layout), central dividers only extend UP to the shelf where drawers start.
    - Prevents dividers from unrealistically cutting through drawer space.
- **★ Delete Key + Trash Button**:
    - Delete/Backspace key removes the selected module (with input/textarea guard).
    - Trash button in toolbar provides alternative for mouse-only users.
    - Position cache automatically cleaned for deleted modules.
- **★ Translations Complete (ES/PT/EN)**:
    - All new v2.4 keys added across 3 languages.
    - Drawer presets, layers, ruler, edit mode, undo/redo all translated.
- **Export Functions Verified**: CSV, BOM, CNC all functional via blob download.
- **Code Protection**: All new logic marked with `★ PROTECTED` markers.

### v2.3.0 — INDEPENDENT_MODULES + DRAG_SNAP (2026-05-04)
- **★ Independent Module Positioning**:
    - Adding a new module with "+" no longer rebuilds or repositions existing modules.
    - Each module's position is saved in `modulePositionsRef` and restored on rebuild.
    - New modules are placed to the right of the rightmost existing module.
    - Camera auto-frame only triggers on the first build, not on subsequent module additions.
- **★ Drag-to-Move Modules**:
    - Click and drag any module to reposition it freely on the XZ plane.
    - OrbitControls automatically disabled during drag to prevent camera movement.
    - Visual indicator "Moviendo módulo" appears during drag.
    - Final position persisted in `modulePositionsRef` across rebuilds.
- **★ Magnetic Snap (Pegar Módulos)**:
    - When dragging a module within `SNAP_THRESHOLD` (3 scene units / ~30mm) of another module's face, it auto-snaps flush.
    - Supports X-axis snap (side-by-side) and Z-axis snap (front-to-back).
    - X-snap also auto-aligns front faces (Z alignment) for clean compositions.
    - Blue guide lines (`SNAP_COLOR = 0x00AAFF`) appear at snap points.
- **Architecture Change: Group-Based Module Positioning**:
    - Pieces are now positioned relative to module center (`xOffset = 0`), not absolute scene coords.
    - `mGroup.position` controls world placement — enables clean drag/snap math.
    - Edge helpers added to `mGroup` (not scene root) for correct positioning during drag.
    - Exploded view uses `getWorldPosition()` for correct explosion direction.
    - Box selection uses `getWorldPosition()` for correct screen projection.
- **Code Protection**: All new logic marked with `★ PROTECTED` markers.

### v2.2.1 — STRICTMODE_FIX + SKETCHUP_WIREFRAME (2026-05-04)
- **CRITICAL FIX: React 18 StrictMode 3D Rendering**:
    - Root cause: StrictMode double-mount (mount -> cleanup -> remount) was destroying the Three.js renderer in cleanup, leaving the second mount with a dead canvas.
    - Solution: `initRef` guard pattern prevents double-initialization. Scene init runs exactly ONCE regardless of StrictMode.
    - `setIsReady(true)` now correctly triggers UI state after the single init.
- **SketchUp-Style Wireframe Mode**:
    - White background (0xffffff) with solid white faces (not wireframe mesh).
    - Black edges via EdgesGeometry — architectural look matching SketchUp.
    - Grid adapts to light gray in wireframe mode.
    - Selection highlights preserved (green for selected, dark green edges).
- **Parametric Construction from Configuration**:
    - Generates geometry from `configuration` object (width, height, depth, thickness, numShelves, numDrawers, etc.)
    - Fallback to raw `pieces` array when no configuration present.
    - Correct internal width calculation: `iW = W - 2*T`
    - Proper drawer bank stacking with horizontal/vertical layouts.
- **Chat Greeting Simplified**: Removed verbose V1 restoration message, now just "Hola, soy Orbin."
- **Code Protection**: Added `★ PROTECTED` markers on critical rendering logic to prevent regression.

### v2.2.0 — App.jsx Compatibility + Viewer3D Rewrite
- **Viewer3D V2 Rewrite**: Complete Three.js viewer with parametric construction logic from V1 DNA.
- **App.jsx Props Fix**: Aligned prop interface (`modules`, `onSelectPiece`, `onAddModule`).
- **ErrorBoundary**: Wrapped entire app for graceful 3D crash recovery.
- **Undo/Redo**: Ctrl+Z / Ctrl+Y with history stack (20 levels).

### v4.0.0 — ULTRA_CREDIT_PRO_V4 (High-Tier Upgrade)
- **Engine Upgrade**: Swapped Gemini Flash for **Gemini 1.5 Pro** on Vertex AI.
- **AI Orchestrator v2**: Implemented the **Double-Pass Audit** logic in `aiOrchestrator.js`.
- **v4 Structural Enforcement**: Vertical Zocalos, Internal Lateral Physics.
- **Animation Refinement**: Smoothed transitions for piece opening/closing.

### v3.5.0 — Cloud Integration & Stabilization
- **Vertex AI Implementation**: Migrated primary generation logic to GCP.
- **AI Orchestrator**: Centralized routing logic (Cloud -> Local -> Regex).
- **v3.5 Construction Stabilization**: External laterals to floor and back deduction synchronization.

## PROTECTED Features (Zero Regression Policy)

> Lines marked with `★ PROTECTED` in source code MUST NOT be modified without full regression testing.

1. **StrictMode Guard (`initRef`)**: The `useEffect` in Viewer3D.jsx that initializes Three.js uses `initRef.current` to skip re-initialization. DO NOT remove this guard or add a cleanup that disposes the renderer.
2. **SketchUp Wireframe Rendering**: White solid faces + black EdgesGeometry. The wireframe toggle sets `material.wireframe = false` (solid faces), NOT true. Background switches to `0xffffff`.
3. **Drawer Layouts (`drawerLayout`)**: Left, Right, Center, and Horizontal configurations.
4. **Vertical Dividers (`numDividers`)**: Multiple internal vertical partitions.
5. **Kitchen Structural Logic**: `hasCountertop` toggle and baseboard configuration.
6. **CAD Interaction**: Multi-Selection (`Shift+Click`), Marquee Box Selection, and Orbit Mode toggles.
7. **Unit System (MM/CM)**: Reactive conversion across all modules.
8. **Edge Helpers**: EdgesGeometry attached to every mesh for architectural visualization.
9. **Master Construction Logic**: All 7 rules defined in the THICKNESS_LOGIC section above are immutable.
10. **Parametric Engine Priority**: Always build from `configuration` object first; `pieces` array is fallback only.
11. **Module Position Persistence (`modulePositionsRef`)**: Saved positions must be restored on every geometry rebuild. Never reset this ref during module addition.
12. **Group-Based Module Positioning (`mGroup.position`)**: Pieces at local coords (xOffset=0), group position for world placement. DO NOT add xOffset back to individual pieces.
13. **Drag-to-Move Handler**: mouseDown detects mesh hit → starts drag on XZ plane → snap detection → position save. Do not remove the `dragMoveRef` guard logic.
14. **Magnetic Snap (`performSnapDetection`)**: Compares bounding boxes of all module groups. `SNAP_THRESHOLD = 3` scene units. Blue guide lines at snap points.
15. **Edge Helpers in mGroup**: Edges are children of their module group, not scene root. This ensures correct positioning during drag operations.

## Critical Code Patterns — DO NOT BREAK

### Viewer3D.jsx — StrictMode-Safe Init
```jsx
const initRef = useRef(false)

useEffect(() => {
  if (initRef.current) return   // ★ Skip StrictMode re-run
  if (!mountRef.current) return
  initRef.current = true
  // ... scene init ...
  setIsReady(true)
  // NO cleanup function that disposes renderer
}, [])
```

### Viewer3D.jsx — SketchUp Wireframe
```jsx
if (st.wireframe) {
  m.material.wireframe = false     // Solid faces, NOT wireframe mesh
  m.material.color.set(0xfafafa)   // Near-white
  edge.material.color.set(0x222222) // Black edges
  edge.material.opacity = 1.0
}
```

### Viewer3D.jsx — Module Position Persistence
```jsx
// Before rebuild: save positions
Object.entries(moduleGroupsRef.current).forEach(([modId, mGrp]) => {
  modulePositionsRef.current[modId] = { x: mGrp.position.x, z: mGrp.position.z }
})

// During build: restore or calculate new
const saved = modulePositionsRef.current[design.id]
if (saved) { mGroup.position.x = saved.x; mGroup.position.z = saved.z }
else { mGroup.position.x = maxRightEdge + W/2 + 5 }
const xOffset = 0  // Pieces are local to module center
```

### Viewer3D.jsx — Drag-to-Move + Snap
```jsx
// Drag: intersect horizontal plane, apply delta to mGroup.position
// Snap: performSnapDetection(mGroup, moduleId) checks SNAP_THRESHOLD
// Finalize: modulePositionsRef[moduleId] = { x, z }
```

### App.jsx — Viewer3D Props Contract
```jsx
<Viewer3D
  modules={modules}
  selectedModuleId={selectedModuleId}
  selectedPieceIds={selectedPieceIds}
  onSelectModule={setSelectedModuleId}
  onSelectPiece={setSelectedPieceIds}
  onDeleteModule={handleDeleteModule}
  onUpdateModule={handleUpdateModule}
  onAddModule={() => { ... }}
/>
```

## Quick Start

```bash
# Windows
start-orbin.bat

# Manual
cd server && npm run dev     # Backend on :3003
cd client && npm run dev     # Frontend on :5173
```

Open `http://localhost:5173` in your browser.

---
**Orbin Furniture AI v2.3.0** — Design for manufacture. Zero regression. Build with precision.
