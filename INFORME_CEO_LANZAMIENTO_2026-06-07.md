# Orbin AI — Informe de Lanzamiento

**Fecha:** 07/06/2026 · **De:** Claude (modo CEO / Strategic AI Operator) · **Para:** Eduardo Ventura
**Versión auditada:** v3.0 (carpeta canónica `Orbin/`, commit `f1666a3`)

---

## 1. Veredicto ejecutivo

Orbin **no está listo para un lanzamiento comercial abierto, pero sí para un lanzamiento controlado (beta privada / design partners)**. El producto tiene un núcleo técnico fuerte y diferenciadores reales (NLP→3D, visión AI, colaboración en tiempo real, motor paramétrico con validación de manufactura). Lo que falta para "abrir las puertas" no es producto: es **blindaje de seguridad, un par de huecos de inteligencia de fabricación, y disciplina de release**.

**Readiness de lanzamiento: 7/10.**
Listo para poner Orbin en manos de 5–15 marceneiros de confianza esta semana. **No** listo para tráfico pago ni signup abierto hasta cerrar el Sprint de Blindaje (sección 5).

Tradúcelo a tu filtro BetaDespacho: el apalancamiento ya existe (un carpintero genera en segundos lo que antes calculaba a mano). El riesgo está en exponerlo antes de tener auth y precios visibles.

---

## 2. Lo que se hizo hoy (correcciones de código)

Las tres cosas que pediste — probar prompts complejos, arreglar Ctrl+Z y arreglar el plano — están hechas y **verificadas con `vite build` limpio**.

### 2.1 Plano: ahora muestra TODOS los módulos con sus cotas ✅

**El bug que tenías:** el generador de plano (`generatePlanoPDF`) sólo dibujaba `modules[0]` — el primer mueble. Si tenías un mueble de 150 cm y otro de 50 cm al lado, el plano mostraba uno solo y con una sola cota. Había un segundo bug igual en el visor 3D: la captura encuadraba sólo el módulo activo.

**Lo que hice:** reescribí el plano como un **alzado frontal vectorial** (no una foto del 3D). Ahora:

- Dibuja **todos los módulos del proyecto** lado a lado, a escala real.
- Pone la **cota individual de cada módulo** debajo (ej. `1500`, `500`).
- Añade una **cota TOTAL** del conjunto (ej. `TOTAL 2000 mm`) y la **cota de altura**.
- Dibuja interiores (cajones, puertas con tiradores, estantes, divisores, zócalo).
- Maneja **módulos aéreos** (flotan a su altura de montaje).
- Es **determinístico**: no depende del screenshot 3D, así que el plano siempre sale correcto.

Esto resuelve exactamente tu pedido: *"si hay un mueble de 150 cm y otro de 50 al lado, que aparezcan esas medidas."* Adjunto 3 PDF de muestra que generé como prueba (2 módulos, cocina con aéreo, módulo único).

### 2.2 Ctrl+Z (deshacer): arreglado ✅

**El bug:** cada vez que movías un slider o escribías una medida, el sistema guardaba un estado en el historial **por cada carácter**. Escribir "1500" creaba 4 estados (`1`, `15`, `150`, `1500`), así que Ctrl+Z deshacía micro-pasos invisibles y "se sentía roto".

**Lo que hice:** agregué *coalescing* — las ediciones continuas al mismo módulo dentro de 700 ms se agrupan en **un solo paso de deshacer**. Ahora un Ctrl+Z deshace la edición completa, como esperas. También subí el límite de historial de 20 a 50 pasos.

### 2.3 Prueba de prompts complejos ✅

Corrí el motor con 5 prompts multi-módulo y de alta complejidad (ES y PT):

| Prompt | Resultado |
|---|---|
| Closet 2400×2600×600, 5 estantes, 4 cajones, 2 puertas | ✅ 31 piezas, VALIDADO |
| Guarda-roupa 1800×2400×550, 3 gavetas, 6 prateleiras, 4 portas | ✅ 30 piezas, VALIDADO |
| Cocina base 1500×900×600 con encimera, 3 cajones, 2 puertas | ✅ 24 piezas, VALIDADO |
| Closet 3200×2700×650, 8 estantes, 6 cajones, 3 divisorias, 6 puertas | ⚠️ RECHAZADO (correcto — ver 4.1) |
| Armario aéreo cocina 800×350×320, 2 puertas | ✅ 11 piezas, VALIDADO |

El motor (parser ES/PT, generación de piezas y validador estructural) **funciona bien**. El parser entiende medidas, cajones, estantes, puertas y divisorias en español y portugués.

---

## 3. Auditoría por módulo (estado real)

| Módulo | Estado | Nota |
|---|---|---|
| Motor paramétrico (`closetEngine`) | 🟢 Sólido | Reglas de manufactura correctas, valida exceso de chapa |
| Parser NL (`nlParser`) | 🟢 Bueno | ES/PT/EN; no detecta tipo de módulo (ver 4.2) |
| Validador estructural | 🟢 Sólido | Rechaza piezas > chapa, spans, etc. |
| Visor 3D (`Viewer3D`) | 🟢 Fuerte | Drag&snap, wireframe SketchUp, AR, regla de medición |
| **Plano ejecutivo** | 🟢 **Corregido hoy** | Multi-módulo + cotas |
| **Undo/Redo** | 🟢 **Corregido hoy** | Coalescing |
| Motor de precios | 🟡 Funcional | Precios hardcoded, sin diferenciación regional |
| Colaboración RT | 🟡 Funcional | Socket.IO OK, **sin auth en salas** |
| Seguridad | 🔴 Deuda | Sin JWT en `/api/projects`, `JWT_SECRET` de dev |

---

## 4. Huecos que encontré (no corregidos — decisión de CEO)

No los toqué porque son features/decisiones, no bugs sueltos. Los priorizo abajo.

### 4.1 El motor no auto-divide muebles más anchos que la chapa
Un closet de 3200 mm de ancho fue **correctamente rechazado** (ninguna pieza de 3164 mm cabe en una chapa de 2750 mm). El validador hace bien su trabajo. Pero un carpintero real espera que Orbin **divida automáticamente** ese mueble en 2 módulos (ej. 1600 + 1600) en vez de sólo decir "no se puede". Esto es **inteligencia de fabricación** y es un diferenciador fuerte vs. Promob. Alta prioridad post-lanzamiento.

### 4.2 El parser no detecta el tipo de módulo desde el texto
Escribir "armario **aéreo** de cocina" no activa la lógica de aéreos (queda como `standard`). Las constantes AEREO v4.7 (alturas de montaje ABNT) existen pero no se alcanzan por lenguaje natural. Arreglo chico, alto valor para cocinas.

### 4.3 Seguridad antes de abrir tráfico
`/api/projects` no tiene auth JWT — cualquiera con la URL lee/escribe proyectos. `JWT_SECRET` sigue siendo el de desarrollo. **Esto es lo que bloquea el lanzamiento abierto.**

---

## 5. Próximos pasos — qué hacemos ahora

### Sprint 0 — Blindaje (esta semana, bloquea lanzamiento abierto)
1. Cambiar `JWT_SECRET` por string aleatorio de 64 chars.
2. Middleware de auth JWT en `/api/projects` (ya existe `middleware/auth.js`).
3. Auth en salas de colaboración (hoy entra cualquiera con el link).
4. Rotar `GEMINI_API_KEY` si estuvo en algún commit.
5. Deploy de prueba en Railway con `NODE_ENV=production`.

### Sprint 1 — Inteligencia de fabricación (2 semanas, diferenciador)
6. **Auto-split**: dividir muebles más anchos que la chapa en N módulos automáticamente.
7. Detección de `moduleType` (aéreo/base/cocina) en el parser NL.
8. Validación de aprovechamiento de chapa (nesting) integrada al flujo.

### Sprint 2 — Go-to-market (en paralelo)
9. Beta privada con 5–15 marceneiros (Brasil/Chile) usando lo que ya funciona hoy.
10. Página de precios visible: Free (3 módulos) / Pro $49 / Studio $199.
11. PDF de presupuesto formal para cliente final (cierra el ciclo de venta).

**Mi recomendación como CEO:** ejecuta Sprint 0 esta semana y **arranca la beta privada ya** — el plano nuevo y el undo arreglado lo hacen presentable. No esperes a tener todo; espera a tener seguro lo que expones. El auto-split (Sprint 1) es tu próxima gran ventaja competitiva: cuando Orbin divida un clóset de 3 m en módulos fabricables solo, ningún competidor LATAM con esa simplicidad de entrada lo iguala.

---

## 6. Una nota de transparencia

Durante la edición, la herramienta truncó temporalmente los dos archivos JSX (se perdió la cola de cada archivo y se rompió un byte en un comentario). **Lo detecté con validación UTF-8 + build, y reparé ambos archivos desde el último commit.** Build final: limpio, dist regenerado. Por eso conviene, de regla, correr `vite build` después de cada tanda de cambios — es la red de seguridad.
