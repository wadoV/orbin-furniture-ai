# Orbin AI — Observabilidad Básica

## 1. Error Boundary (cliente React)

`client/src/App.jsx` — clase `ErrorBoundary` envuelve el árbol completo de la app.

- **`getDerivedStateFromError`** → captura el error, muestra la pantalla de fallback con botón "Reiniciar".
- **`componentDidCatch`** (añadido C4) → envía `POST /api/errors` al servidor de forma **no-bloqueante** (falla silenciosamente si el server está caído). Payload:
  ```json
  { "message": "...", "stack": "...(800 chars)", "componentStack": "...(400 chars)", "url": "...", "ts": "ISO8601" }
  ```

## 2. Endpoint de errores (servidor)

`server/src/index.js` — `POST /api/errors` (sin auth, rate-limit global aplica).

- Loguea el error en Railway con prefijo `[ClientError]` — visible en Railway → Deployments → Logs.
- No persistencia en DB por ahora (ver mejora futura §5).

## 3. Monitoreo de beta_feedback

### Cómo revisar manualmente (Supabase)
1. Supabase → Table Editor → `beta_feedback`
2. Ordenar por `created_at DESC`
3. Filtrar por `type` si hay categorías (bug / feature / general)

### Señales de alarma
| Señal | Acción |
|---|---|
| > 3 errores del mismo `message` en 24h | Abrir issue en GitHub |
| OTP sin llegar (campo `type: 'bug'` + "OTP") | Revisar Supabase Auth logs + SMTP config |
| > 10 feedbacks sin respuesta | Sprint de UX urgente |

## 4. Railway Logs

- **Acceso:** Railway → Proyecto `orbin-api` → Deployments → el deploy activo → Logs
- **Prefijos clave a filtrar:**
  - `[ClientError]` — errores de React capturados por ErrorBoundary
  - `[Billing Webhook]` — eventos de Stripe/MP
  - `[Server Error]` — errores 500 no manejados
  - `[Auth]` — intentos fallidos de autenticación

## 5. Métricas de "estado sano" (definición mínima)

| Métrica | Target |
|---|---|
| Errores de console en flujo principal (OTP → generate → export) | 0 |
| Tasa de éxito OTP (llega en < 60s) | > 95 % |
| P95 tiempo de respuesta `/api/design` | < 5 s |
| Registros en `beta_feedback` con `resolved = false` | < 10 acumulados |

## 6. Mejoras futuras (post-GA)

- Persistir errores en tabla `client_errors` (Supabase) para análisis histórico.
- Integrar Sentry (SDK de React + Node) para alertas automáticas por email.
- Dashboard simple en `/admin` que muestre conteo de errores + feedback por día.
