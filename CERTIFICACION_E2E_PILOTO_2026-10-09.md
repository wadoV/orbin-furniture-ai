---
tipo: certificacion-qa
proyecto: Orbin AI
rama: demo/piloto-taller-martes
fecha: 2026-10-09
dictamen: APROBADO CON CONDICIONES
tags: [orbin, piloto, qa, e2e]
---

# Informe de Certificación en Navegador — Piloto Taller

**Entorno:** el navegador integrado de tu laptop sobre tus servicios reales (`:5174` Vite + `:3003` API), en un viewport de 1600×1000. La cinemática de cajones y las capturas visuales se verificaron con Playwright y eventos de ratón reales, sobre el mismo código.

## Hallazgos bloqueantes encontrados y corregidos durante la auditoría

| # | Hallazgo | Impacto en la demo | Corrección |
|---|---|---|---|
| 1 | El Vite de tu laptop no recibía `VITE_DEMO_MODE` y además corría con `DEV:false` (había `NODE_ENV=production` en la terminal) → `DEMO_MODE=false` | `/app?reset` **redirigía a `/login`** | `VITE_DEMO_MODE=true` en `client/.env` (ignorado por git; backup previo en el scratch del VM) |
| 2 | La tarjeta del visor heredaba el alto de toda la columna (canvas de **2797 px** en una pantalla de 1000) | El mueble quedaba centrado **fuera de pantalla** | Alto acotado a la ventana (`calc(100vh-7rem)`, máx. 900) |
| 3 | `InputPanel.setParam` llamaba a un setState del App dentro de un updater de React | **`Maximum update depth exceeded`** al editar medidas (bucle infinito) | Propagación movida fuera del updater |
| 4 | 11 claves i18n inexistentes, tapadas por un fallback muerto (`t(k) \|\| '...'`) | Botón con el texto crudo `save_viable_design` | Claves añadidas en PT/ES/EN |
| 5 | `preload` de fuentes con URL distinta de la hoja real + Plausible activo en localhost | 2 warnings recurrentes en consola | URL del preload alineada; Plausible solo fuera de localhost |
| 6 | La guarda `beforeunload` seguía activa en la demo | Diálogo "¿Salir del sitio?" al pulsar F5 | Desactivada solo en DEMO_MODE (el autosave ya persiste) |

## 1. DOM / arranque (`/app?reset`)

- [x] Entra en `/app` sin Landing, WelcomeScreen, Onboarding ni login.
- [x] 0 botones "Entrar", "Salir" o "Mejorar Plan" y ninguna pasarela de pago visible.
- [x] Insignia **PRO**; consola: `DEMO_MODE activo — sesión local "Demo Taller" (Pro)`.
- [x] `<canvas>` de 1078×886 px, con contexto WebGL vivo (`isContextLost() = false`).
- [x] El módulo base se ve completo y centrado en el visor.
- [x] Orbitar + zoom: mediana de 16,7 ms por cuadro (≈60 fps), p95 de 18,3 ms y máximo de 33,5 ms, sin perder el contexto.
- [x] Clic en un cajón: `openDrawers = {mod-base-demo-d1}` y el cajón sale visiblemente; un segundo clic lo cierra.
- [ ] **Corrección a tu brief:** el material del mueble es `oak_light` (madera). `#0D0D0D` es el fondo de la escena y de la app, no del mueble.

## 2. Matriz de cotas (motor real, leída en tu navegador)

| Caso | Lateral | Frente cajón | Caja ext. (vano − 26) | Cabecera caja | Badge placa | 3D |
|---|---|---|---|---|---|---|
| 800 × 2100 | 550 × 2100 | **760** × 176 | **738** (764 − 26) | 702 | 0 | ok |
| 1000 × 2100 | 550 × 2100 | **960** × 176 | **938** (964 − 26) | **902** | 0 | ok |
| 800 × **2800** | 550 × **2800** | 760 × 176 | 738 | 702 | **2** ámbar pulsante en los laterales: `⚠️ > 2750mm (Excede placa MDF)` | ok, no colapsa |
| vuelta a 2100 | 550 × 2100 | 760 × 176 | 738 | 702 | **0** (desaparece) | ok |

Holgura de frentes: 2 mm por lado (764 → 760). Correderas: 13 mm por lado (26 mm en total). Con 2800, el motor además deja los laterales fuera del plan de corte (`PIECE_EXCEEDS_PLATE`).

## 3. Consola y red (pestaña limpia, flujo completo)

- Errores rojos: **0**
- Advertencias: **0** (solo mensajes debug/info de Vite y de DEMO_MODE)
- `/api/*`: **100 % 200 OK** (`/health`, `/prices` y 4 llamadas a `POST /design/generate`)
- Build en tu máquina: 2036 módulos, salida 0. Tests del servidor: 281/281 (sesión anterior).

## 4. Riesgos residuales (no bloquean)

1. **Ancho de pantalla < 1280 px** (`xl`): el visor queda oculto detrás del botón "Ver 3D" (diseño móvil). Con un proyector a 1024 px o zoom del navegador > 100 %, el dueño ve primero el panel. Usa la ventana maximizada y zoom al 100 %.
2. `/?reset` **no** resetea (la redirección a `/app` pierde el parámetro). Usa siempre **`/app?reset`**.
3. Si el backend cae, el 3D sigue funcionando y la tabla muestra el aviso ámbar "desactualizado"; se recalcula sola al volver.
4. Los 6 archivos corregidos hoy están sin commit en la rama.

## Dictamen

**APROBADO PARA DEMO PRESENCIAL 🟢**, con dos condiciones: hacer commit de los fixes de esta sesión y abrir siempre `/app?reset` en una ventana de 1280 px o más.
