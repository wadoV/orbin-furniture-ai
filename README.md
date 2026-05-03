# Orbin AI — Modular Kitchen & Cabinet System v3.0.0 (CONSTRUCTION_STABLE_V3)

Orbin is a state-of-the-art parametric design engine and AI assistant for modular furniture manufacturing. It transforms natural language descriptions and technical parameters into precise manufacturing data, 3D visualizations, and optimized cutlists.

## 🚀 Key Features

- **Multi-Typology Engine**: Support for Standard Closets, Kitchen Base Modules (with structural tie-strips), and Upper (Aéreo) Cabinets.
- **Reactive Unit System**: Instant toggle between Millimeters (MM) and Centimeters (CM) across the entire UI and cutlist generation.
- **Parametric 3D Viewer**: High-fidelity Three.js visualization with SketchUp-style rendering (White Solid + Black Edges).
- **AI Design Assistant**: Multi-lingual (ES/PT/EN) conversational agent with persistence and direct engine integration.
- **Divided Drawer Logic**: Column-specific drawer instantiation within multi-section modules.
- **Manufacturing Precision**: Automatic back-thickness deductions and zero-gap structural alignments.

## 📐 CONSTRUCTION_STABLE_V3 (Master Standard)
The following geometric rules are the "Master Standard" for Orbin AI. Any engine refactor must strictly adhere to these formulas:

1. **Internal Lateral Depth**: `D_internal = D_total - Back_Thickness - Front_Recess`. `Front_Recess` is 50mm if doors are present, else 2mm.
2. **Technical Recess**: Internal shelves must have a 50mm recess from the front if the module has doors, to prevent hinge/door interference.
3. **Structural Drawer Cap**: The shelf immediately above a drawer bank MUST be full depth (no recess) to serve as a structural seal.
4. **Multi-Door Calculation**: Door width is calculated as `(Total_Width - (Num_Doors + 1) * 3mm) / Num_Doors`.
5. **Lateral Alignment**: External laterals go to ground. Internal laterals are captured between the top/base (`Height - 2*Thickness`).
6. **Interaction Standard**: Doors rotate 90° on animation; Drawers slide 400mm. Camera reset is manual only.

## 🛠 Tech Stack
- **Frontend**: React 18, Three.js (R3F), TailwindCSS, Lucide.
- **Backend**: Node.js, Express, Claude 3.5 Sonnet / Gemini 1.5 Flash.
- **Design System**: Glassmorphism 2.0 with premium dark mode aesthetics.
- **Local AI**: Support for Ollama (`llama3.2:1b`) for private, offline design generation.

## 🚀 Hybrid AI Architecture (Cloud-First)
Orbin AI utilizes a robust hybrid orchestration logic to ensure high-performance design generation:
1.  **Primary: Google Cloud Vertex AI**: Leverages **Gemini 1.5 Flash** for low-latency, high-precision parametric design parsing.
2.  **Fallback: Local Ollama**: Seamlessly switches to `llama3.2:1b` if cloud latency exceeds thresholds or connectivity is lost.
3.  **Safety Net: Regex Parser**: A deterministic fallback engine for basic structural generation if all LLMs are unavailable.

## 🔧 Patch Notes

### v3.5.0 — Cloud Integration & Stabilization
- **Vertex AI Implementation**: Migrated primary generation logic to Google Cloud (GCP) for superior reasoning and speed.
- **AI Orchestrator**: Centralized routing logic in `aiOrchestrator.js` for managed failover (Cloud → Local → Regex).
- **v3.5 Construction Stabilization**: 
    - **Laterales al Suelo**: External laterals strictly extend to the floor (y=H/2).
    - **Vertical Baseboards**: Optimized grain direction for baseboard structural pieces.
    - **Back Deduction Sync**: Unified depth calculation for internal laterals across all generation engines.
- **UI/UX "Cloud Active"**: New status indicators and initial greeting: *"Nuestro motor ya está en la nube."*

### v3.0.0 — CONSTRUCTION_STABLE_V3 (Precision Upgrade)
- **Technical Recess Engine**: Automated 50mm recess for internal shelving when doors are present.
- **Structural Drawer Capping**: Guaranteed full-depth seal for shelves directly above drawer banks.
- **Multi-Door Parametric Control**: Support for 1-4 doors with automatic gap calculation (3mm).
- **Interactive 3D Mechanics**: Implemented correct pivot points for door rotation (90°) and extended drawer travel (400mm).
- **Free Camera Control**: Disabled auto-reset of camera during configuration to allow free structural inspection.
- **Enhanced i18n**: Full technical terminology support for ES/PT/EN.
- **Precise Depth Deductions**: Implemented automatic subtraction of back thickness (3/6mm) from internal lateral pieces.
- **Dividir Gavetas por Coluna**: Added sidebar toggle and logic to place drawers within specific columns created by internal dividers.
- **AI Chat Restoration**: Reconnected `ChatPanel` with `App.jsx` state; added message persistence and design generation feedback loop.
- **Zero-Gap Integration**: Refactored shelf placement to eliminate air gaps between drawer fronts and base shelving.
- **State Locking Fix**: Resolved "Input Snapping" by skipping external state sync while fields are focused, allowing full value deletion.
- **Defensive Rendering**: Resolved `TypeError: Cannot read properties of undefined (reading length)` in `ResultPanel` via robust prop validation.

## 🛡️ PROTECTED Features (Zero Regression Policy)
1. **Drawer Layouts (`drawerLayout`)**: Left, Right, and Center configurations.
2. **Vertical Dividers (`numDividers`)**: Multiple internal vertical partitions.
3. **Kitchen Structural Logic**: `hasCountertop` toggle and `travesaños` (tie-strips).
4. **CAD Interaction**: Multi-Selection (`Shift+Click`), Marquee Selection, and Orbit Mode toggles.
5. **Unit System (MM/CM)**: Reactive conversion across all modules.
6. **SketchUp Render Style**: White-solid + black-edge (`EdgesGeometry`) mandatory default.
7. **Industrial Export**: CSV, BOM hardware count (auto-hinge/slide detection), and CNC G-code.
8. **Master Construction Logic**: All 4 rules defined in the 📐 section above are immutable.