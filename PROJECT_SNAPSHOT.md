# PROJECT_SNAPSHOT.md — Orbin AI v4.5 (COMMERCIAL_READY)
> Generated: 2026-05-31 | For clean-context resumption

---

## 1. ARCHITECTURAL STACK & SYSTEM OVERVIEW

### Runtime & Frameworks
| Layer | Tech | Port |
|---|---|---|
| Frontend | React 18 + Vite + React Router v6 | 5173 |
| Backend | Node.js + Express | 3003 |
| Styling | Tailwind CSS (custom design system) | — |
| Realtime | Socket.IO (collaboration) | via 3003 |
| DB | Supabase (PostgreSQL) + in-memory fallback | — |
| i18n | react-i18next (ES/PT/EN) | — |

### AI Orchestration (server/src/ai/)
- **Primary:** Gemini 2.5 Flash (`GEMINI_MODEL=gemini-2.5-flash`, Google AI Studio key configured)
- **Local fallback:** Ollama → `deepseek-r1:7b` (localhost:11434)
- **Tertiary:** Claude client (claudeClient.js) + Vertex AI client (vertexClient.js)
- **Orchestrator:** `aiOrchestrator.js` routes requests across providers with auto-fallback

### UI Design System
- **Theme:** Ultra-dark premium SaaS (`bg: #0D0D0D`, surface layers: `#111`, `#1A1A1A`, `#2E2E2E`)
- **Primary accent:** Gold `#F5A623` (hover: `#E8951A`, dark: `#D4890F`)
- **Typography:** Inter, all-caps tracking for labels (`tracking-[0.15em]`)
- **Component classes:** `.btn-primary`, `.btn-secondary`, `.card`, `.card-glass`, `.input-field`, `.label`, `.badge-validado`, `.badge-rechazado`, `.badge-warning`, `.text-gradient`, `.chip`
- **Scrollbar accent:** Gold on hover
- **Icons:** lucide-react

---

## 2. CURRENT STATE OF THE CODEBASE

### Root: `C:\Users\Azomarg\Documents\Claude_projects\Orbin\`

### Server (`server/src/`)

| File | Function |
|---|---|
| `index.js` | Express entry point, Socket.IO init, CORS, routes mount |
| `engine/closetEngine.js` | **CORE** — Parametric furniture engine v4.5.0. Generates full cut list, validates geometry. DNA V1 rules: sides floor-to-top, internal top/bottom = W-2T, 13mm slide clearance, vertical grain on plinths. Supports 15/18/25mm MDF. |
| `engine/validator.js` | Structural validation → returns VALIDADO / RECHAZADO + warnings |
| `engine/nlParser.js` | Regex NL parser ES/PT/EN. Normalizes units (cm→mm, inches→mm). Used as Gemini fallback. |
| `engine/constants.js` | Brazilian MDF/MDP standards: plate 2800×2070mm, kerf 3.2mm, margin 50mm |
| `routes/design.js` | `POST /api/design/generate`, `POST /api/design/parse`, `GET /api/design/defaults` |
| `routes/projects.js` | CRUD persistence — Supabase primary, in-memory fallback. `POST /save`, `GET /`, `GET /:id`, `DELETE /:id` |
| `routes/chat.js` | AI chat endpoint, routes through aiOrchestrator |
| `routes/vision.js` | Image-to-parametric vision endpoint |
| `routes/stressTest.js` | Load testing route (dev only) |
| `ai/aiOrchestrator.js` | Multi-provider AI router: Gemini → Ollama → Claude fallback chain |
| `ai/systemPrompts.js` | Carpentry-specific system prompts for each AI provider |

### Client (`client/src/`)

| File | Function |
|---|---|
| `App.jsx` | Main orchestrator. Manages global state: design, modules, activeTab, plan limits, undo/redo, Socket.IO collaboration lifecycle |
| `main.jsx` | React entry, Router, context providers wrapping |
| `index.css` | Full design system (Tailwind layers + custom component classes) |
| `api/client.js` | Axios wrapper → `http://localhost:3003/api` |
| `context/UserContext.jsx` | **SaaS plan system** — `free | pro | enterprise`. Defines limits: maxModules, export permissions, AI access, allowed thicknesses. Simulated auth (no real backend auth yet). |
| `context/PreferencesContext.jsx` | User preferences: language, units, UI settings |
| `components/LandingPage.jsx` | Marketing landing page. Entry point for unauthenticated users. |
| `components/AuthPages.jsx` | Login + Register with plan injection (`?plan=pro` param). Routes to `/app` after auth. |
| `components/PricingDisplay.jsx` | Pricing table: Free / Pro (R$99/U$19) / Enterprise (R$249/U$49) |
| `components/InputPanel.jsx` | Main design input: dimensions, module type, NL input field |
| `components/ResultPanel.jsx` | Renders validation badge + design summary |
| `components/CutListTable.jsx` | Cut list UX: synchronized selection, delete by piece, Ctrl+Z undo, eye toggle per piece |
| `components/Viewer3D.jsx` | Three.js 3D visualization of generated module |
| `components/ChatPanel.jsx` | AI chat assistant panel (Pro/Enterprise gated) |
| `components/CarpentryAdvisor.jsx` | Specialized carpentry advice AI component |
| `components/ExportPanel.jsx` | Export to PDF/CSV/CNC/BOM (plan-gated) |
| `components/ProjectsPanel.jsx` | Project save/load/delete UI (calls /api/projects) |
| `components/MemoryPanel.jsx` | Project memory/version history UI |
| `components/DesignHealthPanel.jsx` | Visual design quality metrics panel |
| `components/ValidationReport.jsx` | Detailed structural validation display |
| `components/AIVisualStylist.jsx` | AI-powered visual style suggestions |
| `components/ImageToParametricPanel.jsx` | Image → parametric params via vision AI |
| `components/MultiplayerLayer.jsx` | Socket.IO real-time collaboration cursor overlay |
| `components/PresentationMode.jsx` | Client presentation / full-screen mode |
| `components/OnboardingFlow.jsx` | New user onboarding steps |
| `components/WelcomeScreen.jsx` | First-run welcome screen |
| `components/ViralShare.jsx` | Social sharing component |
| `components/Header.jsx` | Top nav: plan badge, tab navigation, undo/redo controls |
| `engine/CutlistGenerator.js` | Client-side cut list generation utilities |
| `engine/PricingEngine.js` | Material cost estimation engine |
| `engine/designAnalyzer.js` | Design health scoring logic |
| `engine/materialLibrary.js` | Materials catalog with prices |
| `engine/exportAdapters.js` | PDF/CSV/CNC export format adapters |
| `engine/projectMemory.js` | Version history, undo stack, project snapshots, localStorage |
| `engine/collaboration.js` | Socket.IO client — room join, cursor broadcast, design sync |
| `data/materials.js` | Brazilian market material prices |
| `i18n.js` | i18next setup, ES/PT/EN namespaces |

### Infra
| File | Notes |
|---|---|
| `server/.env` | `SUPABASE_URL` ✅ `SUPABASE_ANON_KEY` ✅ `SUPABASE_SERVICE_KEY` ✅ `GEMINI_MODEL=gemini-2.5-flash` ✅ `OLLAMA_MODEL=deepseek-r1:7b` ✅ |
| `server/supabase/migrations/001_create_projects.sql` | Migration SQL created — **status unknown if executed against live DB** |
| `start.bat` | One-click launcher: installs deps, starts server + client, opens browser |
| `.cloud/agents/orbin_engine.md` | Agent definition for Orbin engine cloud operations |

---

## 3. RECENT CHANGES & LOGS

### Git History (chronological):
```
da141e0  Initial commit
dcce563  feat(ai): Ollama llama3.2:1b + Gemini fallback + precision fixes v3.1.0
77ccd83  feat: Vertex AI integration + AI Orchestrator + carpentry stabilization v3.5
013f06f  Orbin v2.6.0 — Fabrication Intelligence Phase 1
d3cd5ba  feat(v2.7): Visual Intelligence + Project Memory evolution
c779302  feat(v4.0): CutList UX — synchronized selection, delete by piece, Ctrl+Z, eye button
98ec9f2  feat(v4.5): COMMERCIAL_READY — Landing, Auth, SaaS plan system [LATEST]
```

### v4.5 Critical Changes (last commit — LATEST):
- **LandingPage.jsx** — Full marketing landing page added (public entry point)
- **AuthPages.jsx** — Login/Register pages with `?plan=` query param injection
- **UserContext.jsx** — Complete SaaS plan system: `free | pro | enterprise` with feature gates
- **PricingDisplay.jsx** — Pricing table component (BRL + USD pricing)
- **App.jsx** — Integrated plan-limit enforcement: `PlanLimitAlert` modal, plan-gated features
- **React Router** — Added routes: `/` (Landing), `/login`, `/register`, `/app` (main tool)

### v4.0 Critical Changes:
- **CutListTable.jsx** — Rewritten UX: click-to-select synced with 3D viewer, per-piece delete, Ctrl+Z undo stack, eye visibility toggle
- **closetEngine.js** — `[LEGACY_RESTORATION]` tag: DNA V1 rules restored: sides floor-to-top, internal plates at W-2T, 13mm slide clearance hardcoded in HARDWARE constants

### Supabase Status (verified 2026-05-17):
- SELECT ✅ INSERT ✅ GET ✅ DELETE ✅ — **Fully operational**
- Both ANON_KEY and SERVICE_KEY configured (both point to anon key — valid for MVP with RLS allow_all policy)

---

## 4. ACTIVE BACKLOG & IMMEDIATE NEXT STEPS

### 🔴 Critical / Blockers
- **Real authentication not implemented** — `UserContext.jsx` simulates auth state locally (no JWT, no Supabase Auth). Users can bypass plan limits by editing state. Next: implement Supabase Auth (`supabase.auth.signUp`, `signIn`, session persistence).
- **Migration execution unknown** — `001_create_projects.sql` was created but confirm via Supabase dashboard whether it was run. If not, run it before any data persistence testing.

### 🟡 Pending / Medium Priority
- **`GEMINI_API_KEY` not shown in .env** — Key is described as configured but not visible in env dump (may be present but masked). Verify key is active in `server/.env`.
- **Vertex AI / Claude client** — `vertexClient.js` and `claudeClient.js` exist but likely have no credentials configured. Low priority for MVP.
- **Export adapters** — PDF/CSV export components exist but export functionality may be UI-only stubs without real file generation logic. Needs audit of `exportAdapters.js`.
- **OnboardingFlow.jsx** — Created but integration into routing flow needs verification.
- **ViralShare.jsx** — Created, integration status unknown.

### 🟢 Immediate Next Step (Start Here)
**Implement Supabase Auth** — This is the critical path to a real commercial product:
1. `server/.env`: add `SUPABASE_ANON_KEY` to client-side (already have it)
2. `client/src/context/UserContext.jsx`: replace mock auth with `supabase.auth.signUp()` / `signIn()` / `onAuthStateChange()`
3. Store `plan` field in Supabase `users` table or `user_metadata`
4. Gate `UserContext` plan state on real session — not localStorage
5. Add `supabase.auth.signOut()` to Header logout button

---

## QUICK START (for new session)
```bash
# Project location
C:\Users\Azomarg\Documents\Claude_projects\Orbin\

# Launch
start.bat              # starts both server (3003) and client (5173)

# Or manually:
cd server && npm run dev
cd client && npm run dev
```

**Supabase Dashboard:** https://supabase.com/dashboard/project/fqbqdsmwnulvbysqukam  
**Project URL:** https://fqbqdsmwnulvbysqukam.supabase.co
