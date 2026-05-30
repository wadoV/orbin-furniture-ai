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
    └── coding_standards.md        ← Stack conventions, clean code, UX standards
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
- MDF/MDP plate max: 2750mm × 1840mm. No single piece may exceed this.
- Default thickness: 18mm structure · 6mm backs.
- Drawer clearance: 13mm per side (26mm total) for telescopic slides.
- Max span without support: 900mm (MDF 18mm shelf).
- Output format: always structured JSON ready for nesting optimization.
- Language: Spanish for UI copy · English for code identifiers and API outputs.
