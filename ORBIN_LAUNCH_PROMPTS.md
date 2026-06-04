# ORBIN AI — Launch Prompts by Phase
**Prompt Engineer:** Claude Sonnet 4.6 | **Generated:** 2026-06-03 | **Version:** v4.6

> **Usage Protocol:** These prompts are designed for use with Cursor (code tasks) or Claude (strategy/content tasks).
> All prompts are in English for maximum AI performance. Run them in sequence within each phase.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 1 — SECURITY HARDENING & PRODUCTION DEPLOY
### Semana 1 · Objetivo: Blindar el sistema antes del primer usuario externo
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

### PROMPT 1.1 — JWT Secret Rotation

```
You are a Node.js security engineer working on the Orbin AI backend.

CONTEXT:
- Stack: Node.js 20 + Express, Supabase Auth, server entry at `server/src/index.js`
- Current problem: JWT_SECRET is set to a weak placeholder string in server/.env
- Auth middleware exists but JWT_SECRET has never been properly configured for production

TASK:
1. Generate a cryptographically secure 64-character random hex string to use as the new JWT_SECRET.
   Use Node.js crypto: `require('crypto').randomBytes(32).toString('hex')`
2. Locate every reference to JWT_SECRET across the server/ directory.
3. Verify the secret is only read from process.env — never hardcoded inline.
4. Add a startup guard in server/src/index.js that throws a clear error if JWT_SECRET is missing or equals the placeholder value 'orbin-dev-secret-change-in-production'.
   The guard must run BEFORE the Express server binds to the port.
5. Update server/.env.example with a comment explaining the format requirement.

OUTPUT FORMAT:
- Show the guard code block ready to paste into index.js (exact location with surrounding context)
- Show the updated .env.example entry
- Confirm all file locations where changes are needed
- Do NOT write the actual secret value to any file — show it only in the terminal output instructions

CONSTRAINTS:
- Do not modify closetEngine.js, Viewer3D.jsx, or any engine file
- Do not change the Express route structure
- The guard must be non-blocking in test environments (NODE_ENV === 'test')
```

---

### PROMPT 1.2 — Auth Middleware for Project Routes

```
You are a Node.js security engineer working on the Orbin AI API.

CONTEXT:
- Stack: Node.js + Express + Supabase Auth (JWT tokens issued by Supabase)
- Supabase client: server/src/lib/supabase.js (or similar path — verify before modifying)
- Routes file to protect: server/src/routes/projects.js
- Current state: ALL /api/projects endpoints (GET, POST, DELETE) are publicly accessible with no authentication check
- Auth system: Supabase issues JWTs; the frontend sends them as `Authorization: Bearer <token>`

TASK:
1. Create a reusable Express middleware function `requireAuth` in a new file: `server/src/middleware/auth.js`
   The middleware must:
   a. Extract the Bearer token from the Authorization header
   b. Verify the token using Supabase's `auth.getUser(token)` method
   c. Attach `req.user` with `{ id, email }` from the Supabase response
   d. Return 401 JSON `{ error: 'Unauthorized' }` if token is missing or invalid
   e. Return 403 JSON `{ error: 'Forbidden' }` if user is found but lacks permissions

2. Apply `requireAuth` middleware to all routes in server/src/routes/projects.js:
   - GET /api/projects — user sees only their own projects (filter by req.user.id)
   - POST /api/projects/save — project is saved with owner_id = req.user.id
   - GET /api/projects/:id — only return if project.owner_id === req.user.id
   - DELETE /api/projects/:id — only delete if project.owner_id === req.user.id

3. Update the Supabase `projects` table query to filter by user_id where applicable.

OUTPUT FORMAT:
- Full content of `server/src/middleware/auth.js`
- Diff-style changes for `server/src/routes/projects.js` (show only changed lines with context)
- List any Supabase RLS policies that should be added for defense-in-depth

CONSTRAINTS:
- Do not touch /api/design/* routes (they remain public for the free tier)
- Do not modify the frontend — only backend changes
- Keep the in-memory fallback functional for local development without Supabase
```

---

### PROMPT 1.3 — Railway + Vercel Production Deploy

```
You are a DevOps engineer specializing in Railway and Vercel deployments.

CONTEXT:
- Project: Orbin AI — monorepo with separate client/ (React + Vite) and server/ (Node.js + Express) directories
- Existing config files: railway.json (backend), vercel.json (frontend)
- Backend must be deployed to Railway at a custom domain (e.g., api.orbin.app)
- Frontend must be deployed to Vercel at root domain (e.g., orbin.app)
- Socket.IO is used for real-time collaboration — must work through Railway's proxy

TASK:
1. Audit and fix railway.json:
   - Ensure startCommand points to `node server/src/index.js` or the correct entry
   - Add healthcheckPath: "/api/health"
   - Set NODE_ENV: "production" as a build variable
   - Verify PORT binding uses process.env.PORT (Railway injects this dynamically)

2. Audit and fix vercel.json:
   - Set the root to client/
   - Add rewrites so all non-asset routes serve index.html (SPA routing)
   - Add an environment variable VITE_API_URL pointing to the Railway backend URL

3. Create a production .env checklist file `DEPLOY_ENV_CHECKLIST.md` listing every required environment variable for both Railway and Vercel with:
   - Variable name
   - Where to get the value
   - Whether it's required or optional
   - Security classification (public/secret)

4. Verify Socket.IO compatibility:
   - Railway uses HTTP/1.1 — confirm that Socket.IO polling fallback is enabled
   - Show the server/src/index.js Socket.IO init options needed for Railway

OUTPUT FORMAT:
- Final content of railway.json
- Final content of vercel.json
- Full content of DEPLOY_ENV_CHECKLIST.md
- Socket.IO config snippet for Railway compatibility

CONSTRAINTS:
- Do not modify any engine or component files
- Keep local dev (start-orbin.bat) fully functional — production config must be additive only
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2 — ACTIVATION & ONBOARDING
### Semana 2 · Objetivo: Convertir visitantes en usuarios activos
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

### PROMPT 2.1 — 3-Step Onboarding Flow

```
You are a senior React UX engineer and conversion specialist.

CONTEXT:
- App: Orbin AI — parametric furniture design SaaS
- Stack: React 18 + Vite + TailwindCSS + Lucide Icons
- Current state: New users land directly in the full app with no guidance
- Problem: The app has AR, AI Vision, real-time collaboration, CNC export — a new user has no idea where to start
- Target user: Brazilian/Latin American carpinteiro or furniture designer, non-technical, motivated by speed and professional output
- Existing auth: Supabase Auth with plan state (free/pro/enterprise) in UserContext

TASK:
Create a new component `client/src/components/OnboardingWizard.jsx` — a 3-step guided flow shown only on first login (track with localStorage key 'orbin_onboarded').

STEP 1 — "O que você quer projetar?" (What do you want to design?)
- 4 large clickable cards with icons: Closet/Guarda-roupa | Cozinha | Banheiro | Personalizado
- Each card sets a default configuration in context
- Progress: 1/3

STEP 2 — "Como prefere começar?" (How do you want to start?)
- 3 options with visual previews:
  a. "Digitar medidas" — shows InputPanel preview (fast, precise)
  b. "Descrever em texto" — shows ChatPanel preview (AI natural language)
  c. "Foto do ambiente" — shows AI Vision preview (magic, wow factor)
- Progress: 2/3

STEP 3 — "Seu primeiro projeto em 30 segundos" (Your first project in 30 seconds)
- Auto-generates a default design based on Step 1 selection
- Shows a simplified preview of the 3D result
- CTA button: "Ver meu projeto completo →" — dismisses wizard and opens main app
- Progress: 3/3

DESIGN REQUIREMENTS:
- Full-screen modal overlay with dark glassmorphism backdrop (consistent with Orbin's premium dark theme)
- Step indicator with animated progress bar
- Back button on steps 2 and 3
- Skip link at top-right: "Pular introdução"
- Mobile-responsive (the wizard must work on phones — AR users are on mobile)
- Trilingüe: ES / PT / EN using the existing i18n system

OUTPUT FORMAT:
- Full content of OnboardingWizard.jsx
- Changes needed in App.jsx to mount the wizard (show exact insertion point)
- New i18n keys to add to client/src/i18n.js for all 3 languages
- Do NOT create new dependencies — use only existing packages

CONSTRAINTS:
- Protected files: Viewer3D.jsx, closetEngine.js, validator.js — do not modify these
- The wizard must be completely removable without affecting core app logic
```

---

### PROMPT 2.2 — n8n Material Price Sync Workflow

```
You are a senior n8n automation architect and Node.js developer.

CONTEXT:
- System: Orbin AI — furniture parametric design SaaS
- Problem: Material prices (MDF, MDP, hardware) are hardcoded in client/src/engine/PricingEngine.js
  Current hardcoded values will become inaccurate within 1-2 months in the Brazilian market
- Database: Supabase (PostgreSQL) — project ref: fqbqdsmwnulvbysqukam
- Goal: Weekly automated price update from a reliable source → Supabase → PricingEngine reads from DB

TASK — Part A: Supabase Schema
Write the SQL migration to create a `material_prices` table:
```sql
-- Fields needed:
-- id, material_code (varchar), display_name, price_per_m2 (numeric), 
-- unit, region (BR/CL/AR), updated_at, source_url
```
The PricingEngine should fall back to hardcoded values if the DB is unreachable.

TASK — Part B: n8n Workflow JSON
Create a complete n8n workflow (exportable JSON) that runs every Monday at 07:00 BRT:
1. HTTP Request node → GET from a public Brazilian MDF price source or a manually maintained Google Sheet (design for both options)
2. Data transformation node → normalize to { material_code, price_per_m2, region: 'BR' }
3. Supabase node → upsert into material_prices (on conflict: update price + updated_at)
4. IF node → check if any price changed by more than 15% from last week
5. IF true → HTTP Request to a webhook (Slack/WhatsApp/email) with an alert summary

TASK — Part C: Backend Integration
Modify server/src/routes/design.js to:
- Add a new endpoint: GET /api/prices — returns current material_prices from Supabase
- Add cache: prices are cached in-memory for 1 hour (avoid DB hit on every design generation)

TASK — Part D: Frontend Integration  
Modify client/src/engine/PricingEngine.js to:
- On app init, fetch /api/prices and store in module-level variable `LIVE_PRICES`
- Use LIVE_PRICES in cost calculations if available, fallback to MATERIALS_DB constants
- Show a small "Preços atualizados: DD/MM/YYYY" badge in PricingDisplay.jsx

OUTPUT FORMAT:
- SQL migration file content
- n8n workflow JSON (complete, importable)
- Diff for server/src/routes/design.js
- Diff for client/src/engine/PricingEngine.js
- Diff for client/src/components/PricingDisplay.jsx

CONSTRAINTS:
- Do not break existing PricingEngine logic — the live prices layer must be purely additive
- The fallback to hardcoded values must be silent (no error shown to user)
```

---

### PROMPT 2.3 — Analytics & Conversion Tracking

```
You are a growth engineer specializing in SaaS activation funnels.

CONTEXT:
- App: Orbin AI — parametric furniture SaaS, React 18 + Vite frontend
- Plans: free / pro (R$99/mês) / enterprise (R$249/mês)
- Key conversion events to track:
  1. User completes onboarding wizard
  2. User generates first 3D design
  3. User hits a plan gate (tries a Pro feature on Free plan)
  4. User views the pricing/upgrade modal
  5. User successfully upgrades plan
  6. User exports a file (PDF, CSV, CNC)
  7. User shares a collaboration room link

TASK:
Implement a lightweight analytics layer using Plausible Analytics (privacy-first, GDPR compliant, no cookies — ideal for Brazil/LATAM):

1. Add Plausible script to client/index.html with the correct data-domain attribute (use orbin.app as placeholder)

2. Create a utility file `client/src/lib/analytics.js`:
   - Export a `trackEvent(eventName, props)` function
   - It must gracefully no-op if Plausible is not loaded (local dev)
   - It must respect a user's Do Not Track header
   - Define and export all event name constants as an EVENTS object to prevent typos

3. Integrate trackEvent calls at each of the 7 conversion events listed above:
   - Show the exact file and line where each call should be inserted
   - Include relevant props (e.g., plan: 'free', featureBlocked: 'pdf_export', moduleCount: 3)

4. Create a `client/src/components/UpgradePrompt.jsx` modal:
   - Triggered when a free user hits a plan gate
   - Shows: which feature they tried, what plan unlocks it, pricing
   - CTA: "Upgrade para Pro — R$99/mês" with link to /pricing
   - Secondary CTA: "Ver todos os planos"
   - Tracks: plan_gate_viewed, upgrade_cta_clicked events

OUTPUT FORMAT:
- Updated client/index.html (script tag only)
- Full content of client/src/lib/analytics.js
- Integration diff for each of the 7 events (file + line + code snippet)
- Full content of client/src/components/UpgradePrompt.jsx

CONSTRAINTS:
- Zero new npm dependencies for analytics (Plausible is script-tag based)
- Do not modify Viewer3D.jsx or any engine file
- UpgradePrompt must use existing Tailwind classes and Lucide icons
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 3 — GO-TO-MARKET
### Semana 3 · Objetivo: Primeros 100 usuarios reales
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

### PROMPT 3.1 — Landing Page Optimization

```
You are a senior conversion copywriter and React developer specialized in B2B SaaS for the Brazilian market.

CONTEXT:
- Product: Orbin AI — parametric furniture design tool for marceneiros and furniture designers
- Current landing page: client/src/components/LandingPage.jsx (exists but needs conversion optimization)
- Target audience: Brazilian small/medium marcenarias, furniture designers, kitchen/closet stores
- Pain points:
  1. Software atual (Promob/KD Max) custa R$8.000-20.000/ano e só funciona no Windows
  2. Fazer orçamento manual leva 2-3 horas por projeto
  3. Cliente não consegue visualizar o projeto antes de aprovar
- Unique differentiators: Web-based (zero install), AI design from text/photo, real-time collaboration, 30-second quote generation

TASK:
Rewrite client/src/components/LandingPage.jsx with a high-conversion structure:

SECTION 1 — Hero (above the fold)
- Headline formula: [Specific outcome] + [Time frame] + [Without pain point]
  Example: "Projete e orce qualquer armário em 30 segundos — sem instalar nada"
- Sub-headline: 1 sentence on the core mechanism (AI + parametric engine)
- Primary CTA: "Criar meu projeto grátis →" (links to /register)
- Secondary CTA: "Ver demo em 90 segundos" (links to a YouTube demo)
- Social proof bar: "Usado por marceneiros em São Paulo, Curitiba e Santiago"

SECTION 2 — Problem/Solution (3 columns)
- Column 1: Pain (Promob) → Solution (Orbin web)
- Column 2: Pain (orçamento manual) → Solution (motor de preços em tempo real)
- Column 3: Pain (cliente não visualiza) → Solution (3D + AR no celular)

SECTION 3 — Feature Demo (alternating layout)
- Feature 1: AI Vision (foto → projeto) — most viral feature first
- Feature 2: Lista de Corte CNC automática — professional credibility
- Feature 3: Colaboração em tempo real — modern differentiator
Each with: screenshot placeholder, headline, 2-sentence description, micro-CTA

SECTION 4 — Pricing (3 tiers, monthly billing)
- Free: R$0 — "Para conhecer o Orbin" — 3 modules, no exports
- Pro: R$99/mês — "Para marceneiros ativos" — unlimited modules, PDF/CSV, AI chat
- Enterprise: R$249/mês — "Para lojas e equipes" — everything + thermal labels, CNC, BOM
- Include: "Comece grátis — upgrade quando precisar"
- Promo: Banner for code KIRA2080 → Enterprise free for 30 days

SECTION 5 — FAQ (Schema.org markup for SEO)
5 questions targeting long-tail keywords:
1. "Orbin substitui o Promob?" 
2. "Funciona sem instalar nada?"
3. "O AI Vision funciona com qualquer foto?"
4. "Posso exportar para CNC?"
5. "Como funciona a colaboração em tempo real?"

SECTION 6 — Footer CTA
- "Pronto para projetar com inteligência?" + primary CTA button

OUTPUT FORMAT:
- Complete rewrite of LandingPage.jsx
- New i18n keys for PT (primary), ES, EN
- Meta tags for index.html (title, description, og:image placeholder)

CONSTRAINTS:
- Use only existing Tailwind classes, Lucide icons, and installed packages
- Mobile-first responsive design
- Do not import Viewer3D or any Three.js component on the landing page (performance)
- Maintain the existing React Router structure (/ route = LandingPage)
```

---

### PROMPT 3.2 — Community Launch Posts

```
You are a viral growth copywriter specialized in Brazilian artisan and maker communities.

CONTEXT:
- Product: Orbin AI — free parametric furniture design tool with AI
- Launch target: Brazilian marceneiros, furniture designers, carpinteiros
- Primary communities:
  1. Facebook groups: "Marcenaria Brasil", "Marceneiros e Carpinteiros do Brasil", "Móveis Planejados - Profissionais"
  2. WhatsApp groups: marcenaria profissional, lojas de MDF
  3. Reddit: r/Marcenaria, r/brasil (tech angle)
  4. LinkedIn: furniture industry professionals
- Tone: peer-to-peer, NOT corporate. Written as if from a fellow marceneiro who found an amazing tool.
- Key hook: "Criei isso pra acabar com o Excel de orçamento"

TASK:
Write 5 distinct launch posts — each optimized for a different platform and intent:

POST 1 — Facebook Group (curiosity hook, long-form)
- Lead with a problem story (2-3 sentences of pain)
- Introduce the tool as the solution you built/found
- Show the workflow: texto ou foto → projeto 3D → lista de corte em segundos
- Include 3 specific numbers (time saved, cost comparison, accuracy)
- End with a question to drive comments: "Vocês ainda fazem orçamento no Excel?"
- Length: 200-300 words
- Tone: conversational Brazilian Portuguese, no jargon

POST 2 — WhatsApp (short, direct, shareworthy)
- Max 5 lines
- One killer stat or before/after
- Link to free signup
- Emoji-forward for WhatsApp context
- Designed to be forwarded

POST 3 — LinkedIn (professional credibility angle)
- Angle: "The Brazilian furniture industry is still using Windows-only software from 2005"
- Position Orbin as the modern alternative
- Include a brief competitive comparison (no brand names, just categories)
- Length: 150-200 words
- Bilingual: Portuguese primary, English secondary for international reach

POST 4 — Reddit r/Marcenaria (authentic, no-hype)
- Reddit tone: honest, show-don't-tell, acknowledge limitations
- Lead with: "Fiz uma ferramenta de design de móveis com IA e estou dando de graça — feedback bem-vindo"
- Include: what it does, what it doesn't do yet, how to try it
- Length: 150-200 words

POST 5 — Instagram Caption + Hashtag Stack
- Caption for a 90-second Reel showing: type → 3D render → cut list
- Hook in first line (before "more" truncation)
- 3-sentence body
- CTA: link in bio
- 25 hashtags: mix of PT/ES, niche (#marcenaria #moveleiro) and broad (#designdeinteriores #IA)

OUTPUT FORMAT:
- Each post as a separate labeled block, ready to copy-paste
- Platform-specific character counts noted
- Recommended posting time for each platform (Brazilian timezone BRT)
- A/B variant headline for Post 1 (for testing)

CONSTRAINTS:
- No false claims — all capabilities described must exist in Orbin v4.6
- Do not mention competitor brand names directly
- All Portuguese must be Brazilian PT, not European PT
```

---

### PROMPT 3.3 — 90-Second Demo Video Script

```
You are a product demo specialist and video scriptwriter for B2B SaaS tools.

CONTEXT:
- Product: Orbin AI — parametric furniture design for marceneiros
- Demo format: Screen recording with voiceover, 90 seconds max
- Target viewer: Brazilian marceneiro or furniture store owner, scrolling Facebook/Instagram
- Goal: Show the magic moment (AI → 3D design → cut list) in under 60 seconds, then show proof (professional exports) in remaining 30 seconds
- Primary hook: "30 seconds from description to cut list"
- The demo must work as a silent video too (Instagram Reels without sound) — all key info must appear as on-screen text captions

TASK:
Write a complete production-ready video script including:

STRUCTURE:
[0:00-0:05] HOOK — Problem statement on screen. No words spoken yet. Text: "Quanto tempo você gasta fazendo orçamento de armário?"
[0:05-0:15] SETUP — Show the empty Orbin interface. Voiceover: "Esse é o Orbin. Vou criar um guarda-roupa agora — do zero."
[0:15-0:35] THE MAGIC — Type a natural language description or use AI Vision with a room photo. Show the 3D model appearing in real time. Voiceover highlights the speed.
[0:35-0:55] THE PROOF — Show the automatic cut list (CSV), the automatic quote (with real R$ values), and the PDF executive plan generating in one click.
[0:55-1:10] THE CLOSER — Show the collaboration URL being shared. Show AR on mobile. Voiceover: "Isso roda no seu navegador. Zero instalação."
[1:10-1:20] CTA — Screen: "Grátis para sempre no plano básico. orbin.app" + plan pricing briefly shown
[1:20-1:30] OUTRO — Logo + tagline + URL

DELIVERABLES:
1. Full script with: [TIMESTAMP] [ON-SCREEN TEXT] [VOICEOVER] [CURSOR ACTION] [CAPTION]
2. Shot list — exactly which UI elements to show in each segment
3. Voiceover text — written for a warm, confident Brazilian accent, natural pace
4. On-screen captions — all key points visible without sound
5. Suggested background music style (royalty-free category)
6. Thumbnail concept — one frame description that would get clicks

OUTPUT FORMAT:
- Script as a formatted table: Timestamp | Visual | Voiceover | Caption | Action
- Shot list as a numbered checklist
- Separate voiceover transcript (for recording)
- Thumbnail description

CONSTRAINTS:
- 90 seconds maximum — every second must earn its place
- No feature that doesn't exist in Orbin v4.6 may be shown
- Must work as silent video (captions cover all key info)
- Brazilian Portuguese primary — but product name "Orbin" always in English
```

---

### PROMPT 3.4 — Beta Tester Outreach Email

```
You are a growth copywriter specializing in cold outreach for B2B SaaS tools targeting artisans and small business owners.

CONTEXT:
- Product: Orbin AI — AI-powered parametric furniture design
- Target: Brazilian furniture stores, marcenarias, and designers who currently use Promob or KD Max
- Goal: Recruit 20 beta testers from direct outreach — not ad-driven
- Offer: Free Enterprise access for 60 days using promo code KIRA2080
- Tone: Peer-to-peer, from one professional to another — NOT a mass marketing email

TASK:
Write 3 cold outreach messages for different contexts:

MESSAGE 1 — Direct email to a marcenaria owner
- Subject line: 3 variants to A/B test (curiosity / benefit / question formats)
- Body: 5-7 sentences max. Problem → solution → specific offer → CTA
- PS line: adds urgency or social proof
- Personalization placeholder: [NOME], [CIDADE], [TIPO_DE_MOVEL]

MESSAGE 2 — LinkedIn DM (300 chars max)
- Ultra-short, one specific pain point, one ask (not a sale — just a conversation)
- End with a question, not a CTA link

MESSAGE 3 — WhatsApp message (first contact)
- Conversational, feels like a recommendation from a mutual contact
- Max 3 lines
- Include: what it is, the free offer, the link

FOLLOW-UP SEQUENCE (for Message 1):
- Day 3 follow-up (if no reply): 3 sentences, different angle
- Day 7 follow-up (if no reply): final send, close the loop graciously

OUTPUT FORMAT:
- Each message as a separate labeled block
- 3 subject line variants for Message 1 with expected open rate reasoning
- Follow-up sequence labeled as Day 3 and Day 7
- Notes on personalization variables

CONSTRAINTS:
- All Brazilian Portuguese — natural, not translated from English
- No false urgency ("apenas hoje!", "últimas vagas!") — the offer is genuine
- All capabilities mentioned must exist in Orbin v4.6
- The promo code KIRA2080 must appear in all messages
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PROMPT MASTER — CEO STRATEGIC REVIEW
### Usar ao final de cada Sprint para avaliação executiva
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
You are acting as CEO of Orbin AI — a bootstrapped SaaS product targeting the Latin American furniture manufacturing market.

CONTEXT:
- Product: Orbin AI v4.6 — parametric furniture design with AI, running on React + Node.js + Supabase
- Current status: Pre-launch, fully built, zero paying users
- Market: Brazilian and Chilean marceneiros, furniture stores, designers
- Competition: Promob (R$8-20k/year, Windows-only), KD Max (R$5-10k/year), no AI competitors in LATAM
- Team: Solo founder (Eduardo Ventura) — designer, developer, and marketer

WEEKLY SPRINT REVIEW PROTOCOL:
Answer these 7 questions with brutal honesty and strategic clarity:

1. MOMENTUM: What was the single most important thing completed this week? Why does it matter for revenue?

2. RISK INVENTORY: What are the top 3 risks that could kill this launch in the next 30 days? Rate each: Probability (1-5) × Impact (1-5).

3. USER SIGNAL: What feedback, data, or signals do we have from real users this week? If zero — what's the plan to get the first signal in the next 7 days?

4. CONVERSION BOTTLENECK: Where in the funnel is the biggest drop-off right now? What's the one change most likely to fix it?

5. COMPETITIVE DRIFT: Has anything changed in the competitive landscape this week? Any new entrants, price changes, or marketing moves by Promob/KD Max?

6. RESOURCE ALLOCATION: Is Eduardo's time being spent on the highest-leverage activity? What should he STOP doing to create space for what matters most?

7. NEXT SPRINT DECISION: Define the single most important goal for next week. It must be: specific, measurable, achievable in 7 days, and directly connected to getting the first 10 paying users.

OUTPUT FORMAT:
- Answer each question in 3-5 sentences maximum
- End with a "Sprint Score" 1-10 with one sentence justification
- Highlight any decision that needs to be made THIS WEEK (not deferred)

CONSTRAINTS:
- No platitudes or generic startup advice
- All recommendations must be specific to Orbin's actual product and market
- If a question can't be answered without data, say so and define exactly what data to collect
```

---

*Orbin AI Launch Prompts — v1.0 · Generated 2026-06-03 · Strategic AI Operator*
