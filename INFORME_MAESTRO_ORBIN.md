# INFORME MAESTRO — ORBIN AI
### Auditoría técnica + comercial sobre código vivo
**Fecha:** 2026-07-19 · **Auditor:** Technical Co-founder / Lead Auditor
**Commit auditado:** `3587899` (HEAD) · **Foco de lanzamiento:** precisión matemática + estabilidad del motor paramétrico (AI Vision → V2)

---

## 0. VERDAD INCÓMODA PRIMERO (léela antes que nada)

**Hay dos "constituciones" matemáticas contradictorias corriendo en el mismo request de generación.** El generador (`closetEngine.js`) y el validador (`validator.js`) usan tamaños de plancha y kerf distintos. Con tu tesis de lanzamiento siendo "precisión matemática", este es el bug que puede quemar la confianza de un marcenario en la primera lista de corte. Detalle técnico en §1.2. Es P0 y se arregla en < 1 hora.

**Segunda verdad:** los archivos que me pasaste para auditar (`PROJECT_SNAPSHOT.md`, `ORBIN_STATUS_REPORT.md`, `AUDITORIA_SEO_ORBIN.md`, `VIABILIDAD_ORBIN.md`) están obsoletos o no existen. `VIABILIDAD_ORBIN.md` no está en el repo. Los otros tres son de mayo/junio y describen una versión (v3.0–v4.5) que ya quedó atrás. El código real (HEAD de julio) tiene billing Stripe + Mercado Pago, auth real con Supabase, exports DXF/DAE/OBJ/GLTF, Plano Ejecutivo PDF, etiquetas térmicas y un parche de escalación de privilegios. **Auditar sobre esos documentos te haría re-resolver problemas ya cerrados.** Por eso este informe está construido sobre el código, no sobre tus reportes. Riesgo latente de gobernanza: tu documentación deriva más rápido de lo que se actualiza; cualquier decisión tomada leyendo los `.md` viejos parte de datos falsos.

---

## 1. ANÁLISIS EXHAUSTIVO DEL ECOSISTEMA

### 1.1 Qué hace a Orbin viable HOY (verificado en código)

Orbin ya no es un prototipo. Es un SaaS con el aparato comercial cableado:

- **[Seguro] Motor paramétrico funcional** (`server/src/engine/closetEngine.js`): genera lista de corte completa con reglas de manufactura reales — laterales al piso, tapas internas a `W-2T`, holgura de corredera 13 mm, zócalos con veta vertical, soporte 15/18/25 mm. Auto-fit de cajones contra altura interna útil. Split automático de módulos > ancho de plancha.
- **[Seguro] Orquestación IA resiliente** (`ai/aiOrchestrator.js`): cadena Gemini 2.5 Flash → Ollama/DeepSeek local → Claude/Vertex → parser regex. **Funciona sin internet** (fallback local + regex). Ningún competidor tradicional puede decir esto.
- **[Seguro] Monetización real cableada** (`routes/billing.js`): checkout Stripe + Mercado Pago, webhooks con verificación de firma, portal de cliente, downgrade. Promo codes server-side (nunca en el bundle), validados contra `public.promo_redemptions`.
- **[Seguro] Auth real y segura** (`middleware/auth.js`): JWT Supabase vía `auth.getUser()`. El plan se lee de `app_metadata` (solo escribible por `service_role`), cerrando el bug donde un usuario se autoasignaba Enterprise gratis desde devtools. Verificado en vivo con ataque simulado.
- **[Seguro] Salida profesional de fábrica** (`engine/exportAdapters.js`): DXF R12 con **una capa por módulo**, COLLADA/OBJ/GLTF con nodo por módulo (abre en SketchUp/Blender), CNC G-code, CSV neto con descuento de tapacanto, Plano Ejecutivo PDF A4, etiquetas térmicas 60×40 mm. Esto es lo que convierte un diseño en producción real.
- **[Seguro] Colaboración en vivo** (Socket.IO, `index.js` + `collaboration.js`): rooms con validación de `roomId` (regex, tope de 5 rooms/socket), cursores multijugador, sync de estado bidireccional. → §3.
- **[Seguro] Base comercial**: SaaS free/pro/enterprise con enforcement por componente, trilingüe PT/ES/EN, stack SEO reescrito (robots, sitemap, JSON-LD, noindex en rutas de app), 25+ smoke tests en el motor.

**Traducción de founder:** el 80% del trabajo aburrido que mata startups (cobrar, autenticar, exportar a formatos que la fábrica acepta) ya está hecho. Estás mucho más cerca de vender de lo que tus propios reportes dicen.

### 1.2 Cuellos de botella técnicos a evitar en el lanzamiento

**🔴 P0 — Doble fuente de verdad en constantes del motor (contradicción activa).**
Disiento con el estado "listo para lanzar" del motor por esto:

| Constante | `closetEngine.js` (genera) | `constants.js` → `validator.js` (valida) | Regla dura en `CLAUDE.md` |
|---|:---:|:---:|:---:|
| Plancha | **2800 × 2070** | **2750 × 1840** | 2750 × 1840 |
| Kerf sierra | **3.2 mm** | **4 mm** | — |
| Margen nesting | 50 mm | 10 mm | — |

- **Razón analítica:** el generador considera válida una pieza de, p. ej., 1900 mm en su lado menor (cabe en su plancha ficticia de 2070). El validador, que importa `constants.js`, lanza *error* "excede a largura máxima da chapa (1840 mm)". El motor **produce diseños que su propio validador rechaza** (o peor, según el orden de ejecución, aprueba cortes para una plancha de 2800×2070 que en Brasil no es el estándar dominante). Además el generador **viola la regla dura documentada** (2750×1840).
- **Riesgo latente:** un marcenario corta contra tu lista, la pieza no entra en la plancha real, y pierdes al cliente en el primer proyecto. En un producto cuyo pitch es "precisión industrial", esto es letal.
- **Alternativa recomendada:** una sola fuente de verdad. `closetEngine.js` debe `require('./constants')` y borrar su bloque `MATERIAL`/`HARDWARE` local. Decidir el estándar de plancha real (2750×1840 es lo correcto para MDF/MDP BR estándar; 2800×2070 aplica a proveedores específicos) y parametrizarlo por catálogo de material, no hardcodearlo dos veces. Esto conecta con la feature multi-tenant del roadmap: cada loja define su plancha.

**🟡 P1 — Nesting real ausente.** El "nesting optimizer" aparece en la matriz de planes pero el motor solo hace split lineal por ancho (`MAX_MODULE_WIDTH`). No optimiza aprovechamiento 2D de la plancha. Es vendible como está, pero no prometas "optimización" en copy hasta que exista, o expones un claim falso (riesgo E-E-A-T y de reputación en foros de marcenaria, que son implacables).

**🟡 P1 — Rooms sin autenticación.** [Probable] `join-room` valida formato de `roomId` pero no identidad: cualquiera con el link entra. Para B2B donde el diseño es propiedad del cliente, falta gate de sesión en el room. → §3.4.

**🟢 P2 — Prompts de IA hardcodeados** (`systemPrompts.js`): iterar el comportamiento del asistente exige redeploy. Moverlos a BD permite tuning sin tocar código. No bloquea lanzamiento.

**🟢 P2 — Sin caché de respuestas IA:** requests idénticos gastan tokens repetidos. Costo, no bloqueante.

---

## 2. MANUAL DE USO — NIVEL MARCENARIO PROFESIONAL

> Guía operativa para el carpintero. Directa, sin relleno.

### Paso 1 — Configurar el mueble
1. Entra a `orbin.app` y abre la herramienta (`/app`). No instalas nada.
2. En el **panel de entrada** define: tipo de módulo (clóset, gaveteiro, aéreo…), **ancho × alto × profundidad** en mm, y espesor de MDF (18 mm estructura / 6 mm fondo por defecto).
3. Alternativa rápida: escribe en lenguaje natural — *"clóset 1800 de ancho, 2400 de alto, con 4 cajones y barra"*. El parser NL (PT/ES/EN) normaliza unidades (cm→mm) y arma la configuración.
4. Genera. El **visor 3D** muestra el módulo al instante; el motor calcula la lista de corte en el mismo request.

### Paso 2 — Validar los parámetros técnicos (lo que NO puedes saltarte)
El motor estampa un badge **VALIDADO** o **RECHAZADO** con avisos. Antes de cortar, revisa:
- **Holgura de corredera:** el sistema descuenta **13 mm por lado (26 mm total)** para correderas telescópicas. Verifica que el ancho interno del cajón = ancho del hueco − 26 mm.
- **Tapacantos (edgebanding):** el CSV neto **ya descuenta** el espesor del tapacanto de las cotas de la pieza. No vuelvas a descontar tú — cortas de menos. Confirma el tipo (PVC 0.45 / PVC 2.0 / ABS) en el material.
- **Fondo:** ranura a 6 mm, a 20 mm del borde. Pieza de fondo = 6 mm por defecto.
- **Vanos sin apoyo:** el validador avisa si un estante MDF 18 mm supera **900 mm** de luz libre (riesgo de pandeo). Añade un divisor o refuerzo.
- **Límite de plancha:** el validador rechaza piezas que exceden el tamaño de plancha configurado. ⚠️ *Mientras el equipo no cierre el P0 de §1.2, confía en el número del validador, no en el del visor, y verifica manualmente cualquier pieza > 1840 mm en su lado corto.*

### Paso 3 — Exportar la lista de corte para CNC
Desde el **panel de exportación** (funciones gateadas por plan):
- **CSV neto** → para plotter de corte / seccionadora. Cotas finales, listo para nesting externo.
- **DXF (AutoCAD R12)** → una **capa por módulo**; ábrelo en tu software de máquina y cada módulo llega separado.
- **CNC G-code** → para mesa CNC directa (Enterprise).
- **DAE/OBJ/GLTF** → para SketchUp/Blender si quieres render o presentación.
- **Plano Ejecutivo PDF A4** → alzado + planta + isométrico + cajetín editable (empresa/diseñador/material) para el taller o el cliente.
- **Etiquetas térmicas 60×40 mm** → una por pieza, para identificar en el flujo de corte (Enterprise).

**Regla de oro para el marcenario:** corta contra el **CSV neto** o el **DXF**, nunca contra lo que mides "a ojo" en el visor 3D. El visor es para comunicar; los archivos de export son la fuente de fabricación.

---

## 3. SALA COMPARTIDA — DEEP DIVE

### 3.1 Qué es
La **Sala Compartida** es la capa de colaboración en tiempo real de Orbin, sobre **Socket.IO**. Un marcenario abre un diseño y comparte un link de *room*; quien entra ve el mismo módulo 3D y los **cursores en vivo** de los demás. Los cambios se sincronizan bidireccionalmente (`state-change` → `modulesState`) sin bucles de eco. Arquitectura correcta: el servidor HTTP monta Socket.IO (no la app Express directamente), con validación de `roomId` y tope de 5 rooms por socket para evitar abuso.

### 3.2 Por qué es vital para el B2B
El error más caro en muebles a medida **no es de corte, es de comunicación**: el cliente imaginó otra cosa. El ciclo tradicional es: carpintero dibuja → manda PDF/foto por WhatsApp → cliente no entiende el plano → pide cambios por texto → carpintero reinterpreta → repetir. Cada iteración son días y ambigüedad.

La Sala Compartida colapsa ese ciclo: **el marcenario en São Paulo y su cliente en Buenos Aires manipulan el mismo armario, en vivo, al mismo tiempo.** El cliente señala "esa gaveta más ancha" sobre el modelo real, no sobre una descripción. Se elimina la capa de traducción donde nacen los errores y las devoluciones.

### 3.3 Cómo cierra ventas más rápido
- **Convierte la cotización en sesión de co-diseño.** El prospecto que participa del diseño ya está psicológicamente comprometido (efecto IKEA: valoramos más lo que ayudamos a crear).
- **Colapsa el "déjame pensarlo".** En la misma llamada el cliente ve el diseño *y* el precio (motor de precios) *y* recibe el Plano PDF. Se decide en la reunión, no en tres días de mensajes.
- **Diferenciador de venta del propio marcenario.** El carpintero que co-diseña en vivo se ve 10 años más profesional que el competidor que manda un boceto a lápiz. Orbin lo hace ver así → el marcenario vende más → el marcenario no cancela su suscripción. Ese es tu verdadero foso de retención.

**Guion de venta sugerido (para el marcenario, cárgalo en el onboarding):** "Antes de cotizarle, diseñémoslo juntos ahora mismo — le paso un link y lo vamos armando en pantalla." Cierre en vivo con Plano PDF + precio.

### 3.4 Riesgo latente
Sin autenticación en el room (§1.2 P1), el link es la única llave. Para B2B con diseños que son propiedad intelectual del cliente, esto es una fuga potencial. **Alternativa recomendada:** token de room firmado + expiración, atado a la sesión Supabase del dueño del proyecto. No bloquea el MVP pero ciérralo antes de vender a lojas con catálogo propio.

---

## 4. PROYECCIÓN Y POSICIONAMIENTO

### 4.1 Qué te hace imbatible frente a lo tradicional (Promob, KD Max)
El foso no es una feature — es **la acumulación de ventajas que un competidor legacy no puede copiar sin reescribir su arquitectura:**

1. **Zero instalación.** Promob es Windows-only, licencia R$8.000–20.000/año. Orbin abre en el browser. El costo de entrada y la fricción se derrumban.
2. **IA nativa (NLP → diseño).** Promob nació pre-IA; agregarlo exige reescribir el core. Orbin nació con esto.
3. **Colaboración en vivo (§3).** Estructuralmente imposible en un desktop mono-usuario.
4. **Resiliencia offline.** Fallback Cloud → local → regex. Un SaaS competidor caído deja al taller parado; Orbin no.
5. **Salida CAD/CNC seria por capas** (DXF/DAE/OBJ/CNC). No es un juguete: entra al flujo de fábrica real.
6. **Trilingüe PT/ES/EN** desde el origen → toda Latam + Brasil, no solo un país.

**Contrapeso honesto (sé imparcial):** Promob y Cabinet Vision te ganan hoy en **madurez del motor de fabricación** (nesting real, biblioteca de herrajes de proveedores, integración directa con seccionadoras específicas, décadas de casos borde resueltos). Tu ventaja es arquitectónica y de go-to-market, **no** de profundidad de manufactura. No pelees en su terreno (precisión industrial extrema para fábricas grandes); ganas en el segmento que ellos desatienden: **el marcenario pequeño/mediano que hoy dibuja a mano o usa Promob pirateado.** Ahí eres 10 años más moderno y 20× más barato.

### 4.2 Próximo paso estratégico para monetizar de inmediato

**La verdad cruda:** tu cuello de botella hoy **no es producto, es distribución.** Tienes billing, auth, exports y colaboración funcionando. Lo que no tienes verificado es **un solo marcenario pagando**. Construir más features antes de validar pago es la trampa clásica del founder-ingeniero.

Secuencia recomendada, en orden estricto (cada paso es prerequisito del siguiente):

1. **[Esta semana] Cerrar el P0 de constantes (§1.2).** No vendas precisión con dos matemáticas contradictorias. 1 hora de trabajo, riesgo reputacional enorme si sale mal en vivo.
2. **[Semana 1–2] Conseguir 3–5 marcenarios reales usando el producto contra un proyecto real**, gratis, contigo mirando. No busques feedback de UI; busca una sola señal: ¿la lista de corte que exportaron **entró en la plancha** sin reproceso? Esa es tu única métrica de verdad ahora.
3. **[Semana 2–3] Cobrar al primero.** Pon el checkout de Pro (R$99/mes) delante de quien ya obtuvo valor. Con Stripe + Mercado Pago ya cableados, el bloqueo es psicológico, no técnico. Un pago real > mil validaciones teóricas.
4. **[Semana 3–4] Monetización de expansión sin features nuevas:** el plan **Enterprise (R$249)** ya desbloquea CNC + BOM + etiquetas térmicas. Empaquétalo como "modo taller/fábrica" y súbelo al marcenario que factura. No necesitas construir nada — necesitas *nombrar* y *vender* lo que ya existe.
5. **[Paralelo, bajo esfuerzo] Activar el motor SEO que ya escribiste.** El stack (sitemap, JSON-LD, blog long-tail PT/ES) ya está. Publica los artículos "software lista de corte MDF" y "calculadora móveis planejados" — captura demanda existente sin gasto de ads.

**Filtro BetaDespacho aplicado:** este orden prioriza *leverage* (vender lo construido) y *ownership* (clientes pagando, no features huérfanas) sobre el impulso de seguir codeando. La palanca más grande que tienes esta semana no es una línea de código nueva — es el primer marcenario que te pasa su tarjeta.

---

## 5. TABLERO DE RIESGOS (resumen)

| # | Riesgo | Severidad | Acción | Esfuerzo |
|---|---|:---:|---|:---:|
| 1 | Constantes contradictorias motor/validador | 🔴 P0 | Unificar a `constants.js`, parametrizar plancha por material | < 1 h |
| 2 | "Nesting optimizer" prometido pero inexistente | 🟡 P1 | Implementar o retirar el claim del copy | Media |
| 3 | Rooms sin auth de sesión | 🟡 P1 | Token de room firmado + expiración | Media |
| 4 | Documentación derivada/obsoleta | 🟡 P1 | Un solo `PROJECT_SNAPSHOT` versionado en cada release | Baja |
| 5 | Cero pago validado | 🔴 Negocio | Conseguir primer cliente pagando esta quincena | Alta (comercial) |
| 6 | Prompts IA hardcodeados | 🟢 P2 | Mover a BD | Baja |
| 7 | Sin caché de IA | 🟢 P2 | Cache de requests idénticos | Baja |

---

*Informe construido sobre auditoría del código en HEAD `3587899`, no sobre los reportes referenciados (obsoletos). Si quieres, el siguiente paso natural es que ejecute yo mismo el fix P0 de constantes y corra los smoke tests para confirmar cero regresión.*
