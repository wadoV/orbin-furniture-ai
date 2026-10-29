# Orbin AI – Project Context for Claude

## Project Summary
Orbin is an AI-powered parametric furniture design automation tool (MVP: Closets).
Stack: React + Tailwind · Node.js/Python · Supabase · Claude/Gemini · Ollama/DeepSeek (local routing).

## Folder Structure
```
Orbin/
├── CLAUDE.md               ← This file (project context)
├── README.md               ← Vision, architecture, roadmap
├── .claude/                ← Claude Code project config
├── skills/                 ← Reusable skill prompts for Claude
│   ├── furniture_logic.md  ← Parametric engine + cut list rules
│   ├── rag_architect.md    ← RAG / knowledge base queries
│   ├── token_guard.md      ← Context window & token optimization
│   └── b2b_deploy.md       ← Production deployment checklist
├── agentes/                ← Specialized sub-agents
│   ├── structural_validator.md  ← Validates furniture JSON (carpentry rules)
│   ├── security_auditor.md      ← Credential & data security checks
│   └── ux_ui_critic.md          ← UI/UX quality review
└── rules/                  ← Hard constraints (always apply)
    ├── parametric_constraints.md  ← Dimensions, tolerances, structural limits
    ├── coding_standards.md        ← Stack conventions, clean code, UX standards
    └── execution_directives.md   ← Agent workflow, NO IMPLEMENTADO boundaries, gates
```

## Active Skills (load before related tasks)
- `skills/furniture_logic.md` — Before generating any cut list or JSON design.
- `skills/token_guard.md`     — Before any large processing task (>60% context).
- `skills/rag_architect.md`   — Before querying technical manuals or catalogs.
- `skills/b2b_deploy.md`      — Before any production deployment.

## Active Agents (invoke as sub-agents)
- `agentes/structural_validator.md`    — Must respond VALIDADO or RECHAZADO on all furniture JSON.
- `agentes/security_auditor.md`        — Must run before every deploy.
- `agentes/ux_ui_critic.md`            — Must run before any UI release or component change.
- `.cloud/agents/orbin_engine.md`      — Parametric calculation + Gemini budget audit engine.
  Invoke for: cut lists >10 pieces | budget audits | clinic/lab material validation.
  API: GOOGLE_API_KEY in server/.env | gemini-1.5-flash (classify) / gemini-1.5-pro (audit).

## i18n Route Architecture (Roadmap — implement before public launch)
Target structure for SEO-optimized multilingual routing:
```
src/
├── pages/
│   ├── pt/           ← Mercado Brasil (primary — PT-BR)
│   ├── es/           ← Hispanoamérica (secondary)
│   ├── en/           ← Global Anglo (tertiary)
│   └── components/   ← Shared interactive modules (language-agnostic)
```
i18n config: `client/src/i18n.js` already bootstrapped.
Next step: add `react-router-dom` locale prefix + `hreflang` meta tags in `index.html`.
Canonical URL pattern: `orbin.app/pt/armario-sob-medida` | `/es/armario-a-medida` | `/en/custom-closet`.

## Hard Rules (always enforced)
- Before modifying the repo: `rules/execution_directives.md` (NO IMPLEMENTADO boundaries,
  validation gates, explicit-path git commits). Never invent fields or relax constants.
- MDF/MDP plate max: 2750mm × 1840mm. No single piece may exceed this.
- Default thickness: 18mm structure · 6mm backs.
- Drawer clearance: 13mm per side (26mm total) for telescopic slides.
- Max span without support: 900mm (MDF 18mm shelf).
- Output format: always structured JSON ready for nesting optimization.
- Language: Spanish for UI copy · English for code identifiers and API outputs.

## CONTRATO DE i18n (regla dura — hay un test que la hace cumplir)

**Todo texto que ve el usuario se emite con un CÓDIGO estable y se traduce en el cliente.
El servidor NUNCA traduce: emite español + código. El cliente traduce por código.**

Tres diccionarios, misma arquitectura, todos en `client/src/engine/`:

| Qué | Diccionario | Función |
|---|---|---|
| Nombres de pieza | `pieceNames.js` | `localizePieceName(name, lang)` |
| Observaciones del plano | `adjustmentMessages.js` | `localizeAdjustment(adj, lang)` |
| Errores de API | `apiErrors.js` | `localizeApiError(err, lang)` |

**Si agregás un `code:` nuevo, agregás su traducción ES/PT/EN.** No hay opción de
"después lo traduzco": `server/src/engine/i18nContract.test.js` escanea el CÓDIGO FUENTE
y falla nombrando el código y el archivo. Si de verdad no es user-facing, declaralo en
`OUT_OF_SCOPE` de ese test **con el motivo escrito** — el test también valida que el
motivo exista y que el código no aparezca en una superficie user-facing.

Reglas de implementación que ya costaron caro:

1. **El motor NUNCA traduce.** Los nombres de pieza son identificadores (nesting, BOM,
   hash, tests golden). Traducir en el motor rompe la correspondencia.
2. **NUNCA borres `message` de un specAdjustment.** 17 archivos lo leen y es el fallback.
   Se le AGREGA `params` con los valores que hoy quedan atrapados dentro del string.
3. **El fallback esconde la falta de traducción.** Devolver el español es lo correcto
   (un aviso vacío es peligroso), pero hace INVISIBLE que falte la plantilla. Por eso la
   cobertura se verifica con un test estático, no mirando la pantalla.
4. **Coherencia de taller:** plano, CSV y etiqueta térmica se pegan a la misma pieza
   física. Los tres deben nombrarla IGUAL, o el operario no puede emparejarlos.
5. **Un test que no puede ejecutarse debe FALLAR, no saltarse.** Para cargar código del
   cliente desde tests del server usá `server/src/engine/clientBundle.helper.js`; nunca
   `try/catch` + `return` (dos candados reportaron "pass" sin correr durante horas).
