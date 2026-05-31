# Orbin AI — Modular Kitchen & Cabinet System — COMMERCIAL_READY_V4.5

> **Status:** 🟢 COMMERCIAL_READY_V4.5 — SaaS Architecture Live

## 🚀 What's New in v4.5 — Commercial Launch

| Feature | Status |
|---|---|
| Landing Page pública (`/`) | ✅ |
| Auth Pages — Login `/login` + Register `/register` | ✅ |
| UserContext — Plan state `free / pro / enterprise` | ✅ |
| React Router v6 — rutas protegidas y públicas | ✅ |
| Free tier — máx 3 módulos, chat bloqueado, solo 18mm | ✅ |
| Pro tier — módulos/IA ilimitados, 15/18/25mm, PDF/CSV | ✅ |
| Enterprise tier — todo Pro + CNC G-code + BOM | ✅ |
| i18n trilingüe SaaS (ES/PT/EN) — 28 nuevas strings | ✅ |
| ZERO regression en Viewer3D / closetEngine | ✅ |

### SaaS Plan Matrix

| Feature | Free | Pro (R$99/mês) | Enterprise (R$249/mês) |
|---|:---:|:---:|:---:|
| Módulos 3D | Max 3 | ∞ | ∞ + prioridad |
| Chat IA (Gemini 1.5 Pro) | ❌ | ✅ | ✅ |
| Espesores MDF | 18mm | 15/18/25mm | 15/18/25mm |
| Exportar PDF / CSV | ❌ | ✅ | ✅ |
| Exportar CNC (G-code) | ❌ | ❌ | ✅ |
| Lista de Herrajes (BOM) | ❌ | ❌ | ✅ |

### New Files (v4.5)
```
client/src/
├── context/UserContext.jsx         # Global SaaS plan state
├── components/LandingPage.jsx      # Public commercial landing page
├── components/AuthPages.jsx        # Login + Register with plan injection
└── main.jsx                        # Updated: React Router + UserProvider
```

### Protected Files (UNCHANGED — Zero Regression Rule)
```
client/src/components/Viewer3D.jsx   # ★ PROTECTED — rendering engine
server/src/engine/closetEngine.js    # ★ PROTECTED — parametric math
server/src/engine/validator.js       # ★ PROTECTED — structural validation
```

---

Orbin is an industrial-grade parametric design engine and AI architect for modular furniture manufacturing. Powered by **Gemini 2.0 Flash** (Google AI Studio) with a 4-tier AI fallback chain, it enforces strict manufacturing precision, automated structural auditing, and high-fidelity 3D visualization.

## Key Features

- **Gemini 2.0 Flash Engine**: 4-tier AI chain (Gemini SDK → Gemini REST → Ollama → Regex fallback). Always generates a valid design even without internet.
- **Parametric Engine (100% offline)**: Core closet/cabinet generation runs entirely in Node.js — no AI required for basic use.
- **Ultra-Precision Construction**: Enforced 'Marceneiro Pro' rules including structural vertical baseboards and physical divider-integrated drawer banks.
- **Reactive Unit System**: Instant toggle between Millimeters (MM) and Centimeters (CM) across the entire UI and cutlist generation.
- **Parametric 3D Viewer**: High-fidelity Three.js visualization with dual render modes (Dark Solid + SketchUp Wireframe).
- **Advanced 3D Interaction**: Multi-selection, marquee drag selection, drawer open/close animation, exploded view, orbit mode.
- **Module Drag & Snap**: Drag modules freely on XZ plane; magnetic snap auto-aligns adjacent faces with visual blue guide lines.
- **Real-Time Quoting Engine**: Calculates material m², hardware count, labor, and sale price with CountUp animation.
- **Real-Time Collaboration**: Socket.IO rooms — share a `?room=ID` URL with teammates for live multiplayer cursors and state sync.
- **AI Vision (Image-to-Parametric)**: Upload a room photo → Gemini Vision estimates dimensions and generates furniture layout.
- **AR Export**: GLTFExporter + `<model-viewer>` for WebXR real-scale visualization on mobile.

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

- **Frontend**: React 18 + Vite 5, Three.js (vanilla), TailwindCSS, Lucide Icons, Socket.IO Client.
- **Backend**: Node.js 20+, Express, `@google/generative-ai` (Gemini 2.0 Flash), Socket.IO Server.
- **AI Fallback Chain**: Gemini SDK → Gemini REST → Ollama (deepseek-r1:7b) → Regex parser (offline).
- **Database**: Supabase (PostgreSQL) for project persistence. Falls back to in-memory if not configured.
- **Design System**: Dark theme with premium glassmorphism aesthetics.
- **3D Engine**: Three.js with OrbitControls, Raycasting, EdgesGeometry, BoxGeometry parametric construction.
- **AR**: `<model-viewer>` + GLTFExporter for WebXR / Scene Viewer / Quick Look.
- **Real-time**: Socket.IO rooms for multi-user collaboration + multiplayer cursors.
- **Deployment**: Railway (backend) + Vercel (frontend). `railway.json` + `vercel.json` included.

## Architecture

```
Orbin/
├── client/                          # React 18 + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── Viewer3D.jsx          # ★ CORE: Three.js 3D viewer + AR export
│       │   ├── InputPanel.jsx        # Parametric input form
│       │   ├── ResultPanel.jsx       # Cut list & validation
│       │   ├── ChatPanel.jsx         # AI chat interface
│       │   ├── Header.jsx            # Top navigation bar
│       │   ├── MultiplayerLayer.jsx  # ★ Real-time cursors overlay
│       │   ├── ImageToParametricPanel.jsx # ★ AI Vision upload UI
│       │   ├── CutListTable.jsx      # CSV cutlist display
│       │   ├── ExportPanel.jsx       # Export hub (PNG, CSV, BOM, CNC)
│       │   ├── WelcomeScreen.jsx
│       │   ├── CarpentryAdvisor.jsx
│       │   ├── DesignHealthPanel.jsx
│       │   ├── MemoryPanel.jsx
│       │   ├── ProjectsPanel.jsx
│       │   ├── PresentationMode.jsx
│       │   ├── AIVisualStylist.jsx
│       │   └── ViralShare.jsx
│       ├── engine/
│       │   ├── CutlistGenerator.js   # ★ CNC cutlist with edgebanding deductions
│       │   ├── collaboration.js      # ★ Socket.IO client (rooms, state sync)
│       │   ├── exportAdapters.js     # CSV / BOM / CNC export adapters
│       │   ├── designAnalyzer.js     # Structural health analysis
│       │   ├── materialLibrary.js    # PBR material presets
│       │   └── projectMemory.js      # Version history + memory
│       ├── context/
│       │   └── PreferencesContext.jsx # i18n + units + theme
│       ├── data/materials.js
│       ├── api/client.js             # Backend API client
│       ├── i18n.js                   # PT/ES/EN translations
│       ├── App.jsx                   # Main app (undo/redo, collaboration, vision)
│       ├── main.jsx                  # Entry point (React.StrictMode)
│       └── index.css                 # Tailwind + custom design tokens
├── server/                          # Express + Socket.IO backend
│   └── src/
│       ├── index.js                  # ★ Server entry + Socket.IO rooms
│       ├── routes/
│       │   ├── design.js             # POST /api/design/generate
│       │   ├── chat.js               # POST /api/chat
│       │   ├── projects.js           # GET/POST /api/projects
│       │   └── vision.js             # ★ POST /api/vision/analyze-space
│       ├── ai/
│       │   ├── aiOrchestrator.js     # Gemini/Ollama/Claude routing
│       │   ├── claudeClient.js       # Anthropic API client
│       │   ├── geminiClient.js       # ★ Gemini Vision + text client
│       │   ├── ollamaClient.js       # Local Ollama fallback
│       │   └── systemPrompts.js      # Prompt engineering
│       └── engine/
│           ├── closetEngine.js       # Parametric piece generator
│           ├── nlParser.js           # NL → JSON parser
│           ├── validator.js          # Structural validator
│           └── constants.js          # Manufacturing constants
├── start-orbin.bat                  # Windows launcher
├── start-servers.ps1                # PowerShell launcher
└── README.md                        # This file
```

## Patch Notes

### v3.0.0 — FAST-LAUNCH UX/UI & SECURITY HARDENING (2026-05-28)
- **★ Professional Left-Hand CAD Sidebar**:
    - Integrated a SketchUp-style, always-visible glassmorphic vertical toolbar on the left side of the 3D viewport.
    - Prominently showcases **Tape Measure / Ruler** (Neon Green), Orbit Mode, Selection Mode, Exploded View, and Wireframe Mode.
    - Features full multilingual tooltips (ES, PT, EN) explaining each tool to ensure a highly discoverable and professional UX.
- **★ Redesigned CAD Export Panel**:
    - Heavy visual redesign in `ExportPanel.jsx` with massive, full-width primary buttons for professional exports.
    - **AutoCAD (.dxf)**: Styled with a steel blue gradient, custom tags, and vector microcopy.
    - **SketchUp (.gltf)**: Styled with an emerald green gradient, 3D cube icons, and textured model microcopy.
    - Organized CNC, CSV, and Nesting optimization into a dedicated secondary "Fabrication & Reports" grid.
- **★ Backend Hardening & Memory DoS Prevention**:
    - Installed and configured `express-rate-limit` middleware on `/api/design` and `/api/chat` routes (max 15 requests/minute).
    - Reduced default global body parser payload size in `express.json()` from `50mb` to `5mb` to avoid memory exhaustion attacks, while safely supporting room picture analysis.
- **★ AI Master Prompt Engineering**:
    - Replaced existing system prompts with an optimized **Master Prompt** in `systemPrompts.js` with structured, strict few-shot examples in 3 languages.
    - Enforces rigid manufacturing limits (e.g., MDF structural thickness default 18mm, back 6mm, min 2 doors if width > 600mm).

### v2.9.0 — DYNAMIC QUOTING ENGINE (2026-05-16)
- **★ PricingEngine.js**: New real-time quoting service in `client/src/engine/`.
    - Calculates **total m² consumed per material** from live module dimensions (W×H×D panels: 2 sides + top + base + back + dividers).
    - **Infers hardware count** from module type: 2 hinges per door (`COCINA_BASE_PUERTA` → 4 bisagras), 1 drawer slide pair per drawer (`COCINA_BASE_CAJONES` → 3 correderas), handles, shelf pins.
    - `MODULE_HARDWARE_PROFILE` table maps 14 module types across COCINA, CUARTO, BAÑO, SALA.
    - Applies **Cost Matrix**: material $/m² (from `MATERIALS_DB`) + hardware unit costs + labor $18/m² + 12% overhead + configurable commercial margin (default 35%).
    - Returns structured `QuoteResult` with full cost breakdown per category.
- **★ PricingDisplay.jsx**: Fixed overlay UI in top-left corner.
    - **CountUp animation** (odómetro): `useCountUp` hook animates price transitions at 60fps using `requestAnimationFrame` + easeOutExpo easing.
    - Flash pulse (amber glow) triggers on every price change.
    - Expandable panel shows: materials by m², hardware chips (bisagras/correderas/manijas), labor, overhead, margin, and final sale price.
    - Zero external dependencies — pure React hooks + CSS transitions.
- **★ Integration**: `PricingDisplay` mounted in `App.jsx` as a fixed overlay, receives `modules` prop and recalculates on every state update.
- **Key files added**:
    - `client/src/engine/PricingEngine.js`
    - `client/src/components/PricingDisplay.jsx`

### v2.8.0 — UNIFIED COUNTERTOP SYSTEM (2026-05-15)
- **★ Merged Countertop Across Adjacent Modules**:
    - When two or more modules with `hasCountertop: true` are placed side by side, their countertops fuse into a **single continuous slab** — no visible seam or gap between laterals.
    - Individual per-module countertops are suppressed entirely; the unified system takes over.
- **★ 2-Pass Rendering Architecture**:
    - **Pass 1**: All module geometries are built normally, countertop block is skipped.
    - **Pass 2**: After `modules.forEach` completes, the Unified Countertop System runs and creates merged slabs in the parent group (spanning module boundaries).
- **★ Analytical Bounding Box Computation (Critical Fix)**:
    - Bounding boxes are computed directly from `cfg.width/height/depth + mGroup.position`, NOT via `THREE.Box3().setFromObject()`.
    - Root cause avoided: `setFromObject()` requires a world matrix update (render pass) — using it immediately after setting `mGroup.position` gives stale/incorrect results (all positions reported as 0).
- **★ Adjacency Chain Algorithm**:
    - Modules sorted left→right by `box.min.x`.
    - Two modules are in the same chain if `xGap ≤ X_TOUCH (15 units = 150mm)` AND `zDiff ≤ Z_ALIGN (15 units = 150mm)`.
    - One merged `THREE.BoxGeometry` slab is created per chain.
    - Slab dimensions: `width = (xMax - xMin) + 4` (20mm overhang each side), `depth = moduleDepth + 2` (10mm front overhang), `height = 30mm`.
    - Slab sits at `topY = Math.max(...heights)` — flush on the tallest module in chain.
- **★ EdgeHelper Position Fix**:
    - The `LineSegments` edge helper for the unified slab is now explicitly positioned at the same coordinates as the slab mesh (`edgeHelper.position.set(ctPosX, ctPosY, ctPosZ)`). Previously it was placed at group origin (0,0,0).
- **Verified via data**: `chainCount: 1`, `xGap: 5 units (50mm)` for two standard 600mm COCINA modules placed with default positioning (gap = 5 scene units < X_TOUCH = 15).
- **Presets with `hasCountertop: true`**: COCINA (600×720), BAÑO (500×600), and the InputPanel default. ARMARIO, OFICINA, ESTANTE remain `false`.

### v2.7.0 — AI SPATIAL ARCHITECT (Image-to-Parametric) (2026-05-14)
- **★ AI Vision Panel (ImageToParametricPanel)**:
    - New "AI Vision" tab in the left panel for uploading room photos.
    - Upload JPG / PNG / WebP (max 10MB) — front-end validation + base64 encoding.
    - Optional natural-language instruction field ("I want a TV unit that fills the wall").
    - Calls `POST /api/vision/analyze-space` with `imageBase64` + `userPrompt`.
- **★ Gemini 1.5 Pro Vision Backend (`/api/vision`)**:
    - New route `server/src/routes/vision.js` registered at `/api/vision`.
    - Calls `callGeminiVision()` in `geminiClient.js` (multimodal API).
    - Returns validated JSON: `{width, height, depth, hasCountertop, modules[], obstacles[]}`.
    - Obstacle detection alerts shown to user post-generation.
- **★ Parametric Injection from Vision (`handleGenerateFromVision`)**:
    - Vision result maps to `configuration{}` objects — Viewer3D renders geometry immediately.
    - `obstacles` array surfaced to user via alert after modules are loaded.
- **Bug Fixes in this release**:
    - `handleGenerateFromVision`: modules now created with `configuration{}` wrapper (was missing — Viewer3D couldn't render).
    - `handleApplyModification`: `design` variable was undefined; now uses `selectedModuleId` to find the correct module.
    - `handleGenerate`: removed duplicate `catch` block (invalid JS causing SyntaxError at runtime).
    - `Viewer3D.jsx`: `currentXOffset` variable declared before `modules.forEach()` (was causing ReferenceError for hidden modules and fallback builds).

### v2.6.0 — REAL-TIME COLLABORATION (WebSockets) (2026-05-13)
- **★ Socket.IO Real-Time State Sync**:
    - Server upgraded to `http.createServer(app)` + `new Server(server)` pattern to support WebSockets.
    - Rooms via URL: `http://localhost:5173?room=ROOM_ID` — share link to invite collaborators.
    - `state-change` events broadcast parametric module state to all room members.
    - Each slider/parameter change emits instantly; recipients update their 3D viewer live.
- **★ Multiplayer Cursors (MultiplayerLayer)**:
    - `cursor-move` events throttled to 50ms (~20fps) to minimize bandwidth.
    - Color per user derived from username hash (HSL — always unique, always readable).
    - Cursor labels show user names in colored badges.
    - Stale cursors auto-removed after 5s of inactivity.
- **★ Room Architecture**:
    - `initCollaboration(roomId, userName)` — creates Socket.IO connection + joins room.
    - `disconnectCollaboration()` — clean teardown on tab close.
    - `isRemote` flag in `saveHistory()` prevents echo loops (remote changes don't re-emit).

### v2.5.0 — AR + FACTORY CUTLIST (2026-05-13)
- **★ Augmented Reality (WebXR)**:
    - Integrated `GLTFExporter` to export the `moduleGroupsRef` scene in memory.
    - Added a floating "Ver en mi espacio" (View in AR) button for mobile devices via `<model-viewer>`.
    - Real-world scaling: Orbin units (1 = 10mm) converted to AR meters (scale = 0.01) for precise life-size projection.
- **★ Industrial Factory Cutlist (CSV)**:
    - New `CutlistGenerator.js` core engine to process parametric modules.
    - Calculates Net Dimensions (Medidas Netas) by automatically deducting edgebanding thickness based on piece type and grain direction.
    - Edgebanding rules applied (e.g., all 4 edges for doors/fronts, front edge only for shelves/structurals).
    - Fully integrated into `exportAdapters.js` as `CSVAdapter`.
    - Downloadable CSV with format: `[Nombre Pieza, Cantidad, Largo, Ancho, Material, Tapacanto L1...]`.

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
16. **Unified Countertop System (2-Pass)**: Individual countertop blocks are suppressed (`// ★ Individual countertops suppressed`). The unified system runs AFTER `modules.forEach` and creates one merged slab per adjacency chain. DO NOT re-enable individual countertops or move the unified block inside `modules.forEach`. Bounding boxes MUST be computed analytically (from `cfg + mGroup.position`), never via `setFromObject()` immediately post-position.

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

### Viewer3D.jsx — Unified Countertop System (2-Pass, Post-forEach)
```jsx
// PASS 1: Inside modules.forEach — individual countertop SUPPRESSED:
// ★ Individual countertops suppressed — handled by UNIFIED COUNTERTOP SYSTEM below

// PASS 2: After modules.forEach closes — run chain detection:
const ctModules = modules.filter(m =>
  m?.configuration?.hasCountertop && !hiddenModules.has(m.id) && moduleGroupsRef.current[m.id]
)
// ★ Analytical bounding boxes (NOT setFromObject — world matrix race condition)
const ctBoxes = ctModules.map(m => {
  const W = (cfg.width || 600) * SCALE, H = (cfg.height || 720) * SCALE
  const mGrp = moduleGroupsRef.current[m.id]
  return { box: { min: { x: mGrp.position.x - W/2 }, max: { x: mGrp.position.x + W/2, y: H } } }
}).sort((a, b) => a.box.min.x - b.box.min.x)

const X_TOUCH = 15  // 150mm — catches default placement (50mm gap) and snapped modules
const Z_ALIGN = 15  // 150mm — front-face depth alignment tolerance

// Chain detection: if xGap ≤ X_TOUCH → same chain
// One THREE.BoxGeometry slab per chain, added to parent group (not mGroup)
// edgeHelper.position.set(ctPosX, ctPosY, ctPosZ)  ← must match mesh position
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

### Prerequisites
- Node.js 20+
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/wadoV/orbin-furniture-ai.git
cd orbin-furniture-ai
npm run install:all

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY

# 3. Run (Windows)
start-orbin.bat

# OR manually
cd server && npm run dev     # Backend on :3003
cd client && npm run dev     # Frontend on :5173
```

Open `http://localhost:5173` in your browser.

### Environment Variables (server/.env)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google AI Studio key — get free at aistudio.google.com |
| `GEMINI_MODEL` | Optional | Default: `gemini-2.0-flash` |
| `SUPABASE_URL` | Optional | For project persistence. Falls back to memory. |
| `SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `PORT` | Optional | Default: `3003` |
| `NODE_ENV` | Optional | `development` or `production` |

### Collaboration Mode
Add `?room=ROOM_ID` to the URL — share that URL with teammates. Everyone in the same room sees live parameter changes and multiplayer cursors.

### AI Vision Mode
Go to the **AI Vision** tab, upload a room photo, and click "Generate Parametric Design". The AI will estimate dimensions and propose a furniture configuration injected directly into the 3D viewer.

### AR Mode
Generate a furniture design, then click the **"Ver en mi espacio"** button (gold button, top-right of 3D viewer). On mobile, this will launch your device's AR viewer for real-scale visualization.

---
**Orbin Furniture AI v3.0.0** — Design for manufacture. Zero regression. Build with precision.
