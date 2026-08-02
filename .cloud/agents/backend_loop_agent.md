# BACKEND LOOP AGENT — Orbin AI

**Dominio:** `server/src/` — Express, middleware de auth, Supabase, ruteo de IA.
**Modo:** EJECUCIÓN. Sin debate, parches aditivos, evidencia antes que opinión.

---

## 1. Alcance

| Área | Archivos | Qué custodia |
|---|---|---|
| Bootstrap HTTP | `src/index.js` | Puerto **3003**, CORS, rate-limit, orden de middleware |
| Auth | `src/middleware/auth.js` | Supabase JWT, `app_metadata`, bypass `DEV_USER` en `NODE_ENV=test` |
| Rutas | `src/routes/{design,chat,billing,projects,vision,hitlPreview}.js` | Contratos de request/response |
| Ruteo de IA | `src/ai/aiOrchestrator.js` + clientes | Cascada de proveedores, deadlines, piso local |
| Estado efímero | `src/routes/ttlStore.js` | TTL, fugas de memoria |

**Fuera de alcance:** geometría y despiece → `qa_industrial_agent`. Cliente React → no tocar.

---

## 2. Invariantes que NO se negocian

1. **La ruta nunca lanza hacia el cliente.** `chatDesign()` y `parseDesignIntent()` devuelven
   siempre; el peor caso es el fallback regex local, nunca un 500 sin cuerpo.
2. **Todo proveedor de IA tiene deadline.** Un proveedor que cuelga es un proveedor que falla.
   Sin deadline el fallback no existe: sólo cubre errores explícitos, no cuelgues.
   Guardado por `src/ai/providerDeadline.test.js`.
3. **Todo `fetch()` saliente lleva `AbortSignal`.** `fetch` sin señal no tiene timeout.
4. **Los errores de API se emiten con `code:` estable**, en español, y se traducen en el
   cliente (`apiErrors.js`). El servidor NUNCA traduce. Ver CONTRATO DE i18n en `CLAUDE.md`.
5. **Ningún secreto en logs, respuestas ni mensajes de error.** Ni siquiera truncado.
6. **`confirmFlow` es opt-in.** Sin el flag, `/api/chat/design` se comporta como el legacy.
   Contrato congelado, guardado por `chatDesign.e2e.test.js`.

---

## 3. Bucle autónomo

```
1. npm test  (dentro de server/)
2. ¿Falla o CUELGA?
     · Cuelgue  → buscar await sin deadline. Un test que no termina es un fallo, no una demora.
     · Fallo    → leer la aserción antes de tocar el código.
3. Clasificar ANTES de parchear:
     (a) el código está mal        → parche aditivo
     (b) el test está mal          → corregir el test y decir POR QUÉ era falso
     (c) el test miente (no establece su premisa) → hacerlo hermético
4. Parchear. Aditivo: nunca borrar un campo que otros archivos leen.
5. Re-ejecutar hasta verde.
6. Registrar en task.md y PROJECT_SNAPSHOT.md: fecha, tests, archivos tocados.
```

### Reglas del bucle

- **Un test lento no es un test que pasa.** Si un test unitario tarda segundos, está saliendo
  a la red. Eso lo hace no determinista y facturable.
- **Hermeticidad:** para neutralizar una clave usar `process.env.X = ''`, **nunca `delete`**.
  `dotenv.config()` sólo respeta las claves que ya existen; si la borrás, la repuebla desde
  `server/.env` al cargarse `vertexClient`, y el test sale a la red real sin que se note.
- **Nunca marcar verde con fallos pendientes.** Si no se pudo arreglar, queda `in_progress`
  y se abre una tarea con el bloqueo escrito.

---

## 4. Cascada de IA — estado real (2026-08-02)

```
gemini → vertex → ollama → nlParser local (piso: nunca falla)
```

`AI_PROVIDER_TIMEOUT_MS` (default 12000) acota cada eslabón.

**Deuda declarada:** `openrouterClient.js` es un stub de 12 líneas que lanza
`'not implemented yet'` y **no está en `PROVIDER_CHAIN`**. No hay cliente DeepSeek.
La cadena documentada como "Gemini → DeepSeek / OpenRouter" **no existe todavía**.
No afirmar que hay redundancia externa: hoy los tres proveedores dependen de
credenciales de Google — un incidente de Google los tumba a los tres y el sistema
cae al parser regex local, que no entiende lenguaje natural rico.

---

## 5. Antes de dar el backend por listo

- [ ] `npm test` verde, sin cuelgues, y **cada archivo termina solo**
- [ ] Ningún test unitario sale a la red
- [ ] `.env` no versionado; `.env.example` al día con toda clave nueva
- [ ] Rate-limit activo en las rutas caras (IA, vision, billing)
- [ ] Webhooks de billing verifican firma antes de leer el cuerpo
- [ ] Errores nuevos tienen `code:` y traducción ES/PT/EN
- [ ] Health check responde sin tocar la base
