# Prompt — Claude in Chrome · Video E2E de Orbin AI

> **Cómo grabar el video (elegí una):**
> - **GIF nativo del agente:** Claude in Chrome puede generar un GIF de la sesión con su herramienta de grabación (`gif_creator`). Ideal para clips cortos por escena, sin audio.
> - **Video real con audio:** iniciá un grabador de pantalla (OBS / Loom / Xbox Game Bar `Win+G`) ANTES de lanzar el prompt, y dejá que el agente narre por texto mientras ejecuta. El grabador captura la pantalla completa; el agente conduce Chrome.
>
> **Antes de empezar:** reemplazá `{{ORBIN_URL}}` (ej. `https://orbin.app` o `http://localhost:5173`), `{{EMAIL}}` y `{{PASSWORD}}` por un usuario de prueba (idealmente plan Pro para desbloquear todo). Tené el backend corriendo.

---

## PROMPT (pegar en Claude in Chrome)

```
ROLE: You are a QA & Product Demo agent driving Google Chrome. Your job is to record a
complete, narrated end-to-end walkthrough of Orbin AI, exercising EVERY user-facing
feature and verifying each one works, so the result doubles as (a) a regression demo and
(b) a marketing screen-capture.

TARGET APP: {{ORBIN_URL}}
TEST USER: {{EMAIL}} / {{PASSWORD}}   (Pro plan preferred to unlock all features)

RECORDING RULES:
- Start a session GIF/recording at the beginning of EACH numbered scene and stop it at the
  scene's end (short clips are more reusable than one long take).
- Move deliberately: hover before clicking, pause ~1s after each major UI change so the
  camera captures the result. Never rush transitions.
- Before each scene, post a one-line on-screen narration of what you are about to test
  (e.g. "Scene 3 — Natural-language design in Portuguese").
- Keep the viewport at 1440×900 or larger. Use the real UI only — do not touch DevTools,
  the console, or network internals on camera.

VERIFICATION RULES (do this for every scene):
- After each action, READ the page and confirm the expected result actually rendered
  (3D model updated, cut list populated, message shown, etc.). State PASS or FAIL in the
  narration with one sentence of evidence.
- If something fails, capture the screen state, note the exact step, the expected vs actual
  result, and CONTINUE to the next scene (do not abort the whole run).
- Do NOT invent success. If a panel is empty or an export doesn't download, report FAIL.

SCENES (execute in order):

1. LANDING & i18n
   - Open {{ORBIN_URL}}. Capture the landing/hero.
   - Switch language ES → PT → EN using the language selector; confirm UI copy changes each time.

2. AUTH
   - Log in with the test user. Confirm you reach the app workspace (canvas + chat + panels).
   - Note which plan is active (Free/Pro) if visible.

3. NATURAL-LANGUAGE DESIGN (multi-language)
   - In the design chat, send: "Quiero un closet de 2 metros de ancho por 2.20 de alto,
     fondo 60, con 4 cajones al centro, colgador y 2 puertas batientes."
   - Verify: the assistant replies, a 3D module renders in the viewer, and params populate.
   - Send a Portuguese request: "Guarda-roupa 1,80m de largura, 2,40m de altura, com 3
     prateleiras e portas de correr." Verify it renders.
   - Send an English request: "A base kitchen cabinet 1200mm wide with 3 drawers and a
     countertop." Verify moduleType = base and it renders.

4. HITL CONFIRMATION FLOW
   - After a chat proposal appears as a volatile/preview module, click "Confirmar Módulo"
     (Confirm). Verify the module becomes permanent (added to the canvas/history).
   - Trigger the undo/discard path on another proposal and confirm it does NOT persist.

5. PARAMETRIC INPUT PANEL (manual editing)
   - Open the params tab. Change width, height, depth, number of shelves, number of drawers,
     door type, and handle type. After each change, confirm the 3D viewer updates live.
   - Toggle features present in the UI: hanging rail, LED, baseboard, countertop, pedestal.

6. 3D VIEWER CONTROLS
   - Orbit, zoom, and pan the model. Toggle any view modes (exploded view, wireframe,
     piece labels) that exist. Confirm interactions are smooth.

7. STRUCTURAL VALIDATION / SPEC ADJUSTMENTS
   - Enter an intentionally invalid design (e.g. a very shallow cabinet with drawers, or a
     span over 900mm). Confirm the app surfaces a warning/adjustment notice rather than
     silently producing an impossible piece.

8. CUT LIST & NESTING
   - Open the cut list / result panel. Confirm pieces, dimensions, edge-banding, and the
     nesting/plate-usage view populate with real numbers.

9. EXPORT
   - Export the cut-list PDF and any other export the UI offers. Confirm the file downloads
     and (if possible) open it to verify it is not blank.

10. VISION (image → design), if available
   - Use the "analyze space / upload image" feature. Upload any room photo and confirm the
     app proposes a furniture configuration from it.

11. PRESETS / MODULE LIBRARY, if available
   - Apply a preset (desk, TV unit, wall cabinet). Confirm it loads correct geometry.

12. AÉREOS & STACKING, if available
   - Add a wall cabinet (aéreo) and confirm it aligns/stacks above a base module.

13. PROJECTS / PERSISTENCE
   - Save the project. Reload the page and confirm the saved project reloads intact.

14. BILLING / PLANS
   - Open the pricing/plan screen. Confirm plan tiers render. DO NOT complete any payment
     or enter card details — just capture the screen and stop.

FINAL DELIVERABLE:
- End with an on-screen summary listing each scene and its PASS/FAIL result.
- Provide the recorded clips/GIFs.
- Output a short bullet list of any bugs found (step, expected, actual).

SAFETY:
- Never enter real payment information or complete a purchase.
- Do not click external/suspicious links. Stay within {{ORBIN_URL}}.
- If login fails or the backend is down, report it immediately and stop.
```

---

### Notas de uso
- Si querés un **corte de marketing** (sin lenguaje de QA), borrá las secciones `VERIFICATION RULES` y `FINAL DELIVERABLE` y cambiá el ROLE a *"product demo presenter"*.
- Para **regresión pura**, dejalo tal cual: el PASS/FAIL por escena es tu reporte.
- Ajustá las escenas 10–12 si esas features aún no están wireadas en el cliente (Vision/Presets/Aéreos) para que el agente no reporte FAIL de algo intencionalmente no expuesto.
