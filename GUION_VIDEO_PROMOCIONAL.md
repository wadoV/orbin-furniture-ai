# Guion de grabación — Video promocional Orbin AI

> Todos los prompts de este documento fueron **ejecutados contra el motor real**
> (`parseNaturalLanguage → generateProject → validateDesign`) antes de escribirse.
> Sonda reproducible: `node server/src/engine/_videoPrompts.probe.js`
> Resultado: **14/14 sin fallo de motor · 14/14 plausibles en taller.**

---

## 0. Lo que las pruebas descartaron (leer antes de grabar)

Estos casos **pasan todos los tests del repo y aun así arruinan el video**, porque un
marcenaria los detecta en dos segundos. Salieron de correr la sonda, no de suponer.

| Caso probado | Qué produce | Por qué no grabarlo |
|---|---|---|
| Closet 2.40m **con cajones** | frentes de gaveta de **2360 × 176mm** | Ninguna corredera telescópica comercial pasa de ~1200mm. Ratio 13:1. Un cliente carpintero cierra el video ahí. |
| Cómoda 1.20m con **6 cajones** en 90cm de alto | frentes de **1160 × 96mm** | 12:1. Parece una persiana, no una cómoda. |
| "Closet con 2 divisores y 4 cajones" | los cajones **siguen siendo de ancho completo** | El motor no acota las gavetas a los vanos de los divisores. Poner divisores no arregla el caso anterior. |
| `"Armário para escritório"` (PT) | closet 1200×2000, 9 piezas | Correcto que NO lo clasifique como escritorio, pero el mueble sale pobre. Sirve solo si querés demostrar robustez del parser. |
| `"Quiero un closet para mi habitación"` | 2400×2400, **confianza 0**, 9 piezas | Útil solo como contraste deliberado (ver Escena 6). |

**Regla de oro para el video:** *cajones solo en muebles de ≤1.0m de ancho.*
Los muebles anchos van con repisas y puertas corredizas.

---

## 1. Los 5 proyectos

Cada uno trae prompt en **ES** y **PT-BR**, y **exactamente** lo que va a aparecer en
pantalla. Si ves algo distinto a lo listado, algo cambió: no sigas grabando.

---

### E1 · Closet / Guarda-roupa — *el hero shot*

**ES**
```
Closet de 2.40m de ancho, 2.40m de alto y 60cm de fondo con 6 repisas y puertas corredizas
```
**PT**
```
Guarda-roupa 2.40m de largura, 2.40m de altura, 60cm de profundidade com 6 prateleiras e portas de correr
```

| En pantalla | |
|---|---|
| Dimensiones | 2400 × 2400 × 600 mm · tipo `standard/closet` |
| Piezas / cortes | **15 piezas · 15 cortes** |
| Puertas | 2 corredizas de **1198 × 2278 mm** |
| Aviso amarillo | `BACK_PANEL_SPLIT` — *"El fondo no cabe entero en la chapa 2750×1840: se cortará en 2 partes"* |
| Validador | ✓ VALIDADO |

**El aviso amarillo es el momento de venta, no un error.** Guionalo:
> *"Fijate que no me dejó pasar: el fondo no entra en una chapa. Ya me dice que va en dos
> partes. Eso, en un presupuesto hecho a mano, aparece cuando el material ya está cortado."*

---

### E2 · Escritorio / Escrivaninha — *la topología que nadie más hace*

**ES**
```
Escritorio de 1.60m de ancho, 75cm de alto y 60cm de fondo con 3 cajones
```
**PT**
```
Escrivaninha 1.60m de largura, 75cm de altura, 60cm de profundidade com 3 gavetas
```

| En pantalla | |
|---|---|
| Dimensiones | 1600 × 750 × 600 mm · tipo `desk/desk` |
| Piezas / cortes | **20 piezas · 26 cortes** |
| Frentes de gaveta | **360 × 201 mm** (pedestal lateral, no de ancho completo) |
| Aviso azul | `DRAWER_PRIVACY_PANEL` — travesaño de 50mm bajo el tampo; gavetas ajustadas a 205mm |
| Validador | ✓ VALIDADO |

Aquí se muestra faldón + pedestal + travesaño de privacidad: geometría que el
competidor promedio no modela. **No digas "escritório" en PT** — en portugués eso es
la *oficina*; el mueble es *escrivaninha*, y el parser lo distingue a propósito.

---

### E3 · Cocina pequeña — *4 módulos, 4 prompts separados*

El pedido explícito: cada módulo se genera con su propio prompt. ~2.8m lineales.
**Grabá los 4 seguidos, sin cortar**, para que se vea el ensamble creciendo.

**3.1 — Bajo con cajones (ES)**
```
Mueble bajo de cocina de 80cm de ancho, 90cm de alto y 60cm de fondo con 3 cajones y encimera
```
→ 800×900×600 · `base/kitchen_low` · **23 piezas · 29 cortes** · frentes 760×176mm · encimera ✓

**3.2 — Bajo con puertas (ES)**
```
Mueble bajo de cocina de 60cm de ancho, 90cm de alto y 60cm de fondo con 2 puertas y encimera
```
→ 600×900×600 · **12 piezas · 12 cortes** · 2 puertas de 298×778mm

**3.3 — Aéreo grande (ES)**
```
Módulo aéreo de cocina de 80cm de ancho, 70cm de alto y 35cm de fondo con 2 puertas, instalado a 1450mm del piso
```
→ 800×700×350 · `aereo/kitchen_high` · **mount 1450mm** · **9 piezas** · puertas 398×696mm
→ ⚠ `AEREO_BACK_FORCED_STRUCTURAL`: *fondo elevado de 6mm a 15mm — transmite la carga al riel de pared*

**3.4 — Aéreo chico (ES)**
```
Módulo aéreo de cocina de 60cm de ancho, 70cm de alto y 35cm de fondo con 1 puerta, instalado a 1450mm del piso
```
→ 600×700×350 · **8 piezas** · 1 puerta de 598×696mm

**Versión PT de los dos primeros** (los otros dos son análogos):
```
Balcão de cozinha 80cm de largura, 90cm de altura, 60cm de profundidade com 3 gavetas e bancada
Módulo aéreo de cozinha 80cm de largura, 70cm de altura, 35cm de profundidade com 2 portas, instalado a 1450mm do piso
```

**El momento fuerte de esta escena es el aviso del aéreo.** Guion:
> *"Le pedí un aéreo con fondo de 6mm y me lo subió a 15. No es capricho: ese fondo es
> lo que aguanta el mueble colgado. Un aéreo que se cae de la pared es un juicio."*

⚠ **Cuidado en cámara:** verificá que los aéreos aparezcan **a 1450mm del piso** y los
bajos apoyados. Si un aéreo aparece en el piso, el `mountHeight` no se aplicó — cortá.

---

### E4 · Cómoda / Gaveteiro — *la escena de las etiquetas*

**ES**
```
Cómoda de 90cm de ancho, 1.10m de alto y 50cm de fondo con 4 cajones, sin puertas
```
**PT**
```
Gaveteiro 90cm de largura, 1.10m de altura, 50cm de profundidade com 4 gavetas, sem portas
```

→ 900×1100×500 · **26 piezas · 34 cortes** · frentes **860 × 176mm** ✓ proporción real

Es el proyecto con **más piezas por metro** de los cinco: ideal para mostrar la
**lista de corte, las etiquetas térmicas y el nesting**. Cada gaveta son 5 piezas
(2 laterales + frente interno + trasera + fundo) — se ve el despiece de verdad.

---

### E5 · Estantería / Estante — *el plano limpio*

**ES**
```
Estantería de 1.80m de ancho, 2m de alto y 35cm de fondo con 5 repisas, sin puertas
```
**PT**
```
Estante 1.80m de largura, 2m de altura, 35cm de profundidade com 5 prateleiras, sem portas
```

→ 1800×2000×350 · **12 piezas · 12 cortes** · sin avisos

Contraste deliberado: mueble simple, **sin un solo aviso**, plano de cotas limpísimo.
Sirve para el cierre — *"y cuando el mueble es simple, no te molesta con nada."*

---

## 2. Escena 6 (opcional, alto impacto): el prompt vago

```
Quiero un closet para mi habitación
```
→ 2400×2400×600 · **confianza 0** · 0 cajones · 9 piezas

Mostrá cómo el sistema **no inventa**: marca confianza baja y te pide precisar.
Es la respuesta a la objeción *"¿y si la IA se equivoca?"*. Grabalo **después** de
E1 para que el contraste sea directo: mismo mueble, prompt pobre vs prompt preciso.

---

## 3. Orden de grabación (disiento del plan original)

Tu plan era: generar todos → después planos → después etiquetas. **Ese orden te obliga
a re-navegar y recuperar cada proyecto**, y ahí es donde se pierden las tomas.

**Orden propuesto — por proyecto, no por función:**

| # | Bloque | Duración objetivo |
|---|---|---|
| 1 | E1 closet: prompt → 3D → gira el modelo | 60–90 s |
| 2 | E1: plano ejecutivo (cajetín + cotas) → lista de corte | 60 s |
| 3 | E3 cocina: los 4 prompts seguidos, ensamble creciendo | 2–3 min |
| 4 | E3: plano de conjunto + plano por módulo | 60 s |
| 5 | E4 cómoda: prompt → **etiquetas térmicas** → nesting | 90 s |
| 6 | E2 escritorio: prompt → 3D → aviso de privacidad | 60 s |
| 7 | E5 estantería + E6 prompt vago (contraste) | 60 s |
| 8 | Exportación: DXF/DAE/PDF, abrir uno en visor CAD | 60 s |

**Reglas de captura que le sirven a quien edite después:**

1. **Anunciá cada bloque en voz alta antes de empezar:** *"Bloque 3, cocina, módulo 1 de 4."*
   Eso le da a la IA (y a un editor humano) puntos de corte inequívocos en el audio.
2. **Un archivo por bloque.** Un take de 20 minutos es casi inservible para resumen automático.
3. **3 segundos de silencio** antes y después de cada bloque: margen de corte limpio.
4. **Zoom del navegador al 110–125%** — los avisos y las cotas son texto chico; en 1080p
   se pierden.
5. **Corré la sonda antes de grabar** (`node server/src/engine/_videoPrompts.probe.js`).
   Si algún número cambió, el guion quedó desactualizado y lo vas a descubrir en cámara.

---

## 4. Sobre la IA que va a resumir el video

**Nano Banana no procesa video: es un modelo de imagen** (edición y generación). Le podés
pasar frames, no clips. Para "mirá este video y armame el promocional" necesitás un modelo
con entrada de video — Gemini acepta video nativo; Claude no.

Ruta realista, en orden de esfuerzo:

1. **Gemini** (acepta video) → le pasás los 8 clips + este guion como contexto → te devuelve
   guion de edición con timestamps. **Pasarle este documento es la mitad del trabajo**: ya
   sabe qué se está mostrando en cada bloque y no tiene que adivinar.
2. **Nano Banana** → miniaturas, portada, placas de texto entre bloques. Para eso sí es la
   herramienta correcta.
3. **El montaje final lo hace un editor** (o vos en CapCut/Resolve). Ninguna IA hoy te
   entrega un promocional terminado a partir de clips crudos sin retoque.

**Punto ciego a decidir antes de grabar:** ¿el video es en **PT-BR o ES**? El mercado
primario del proyecto es Brasil. Si el promocional es para Brasil, grabá con los prompts
PT — y verificá que el selector de idioma de la app esté en PT antes de empezar, porque
los avisos en pantalla salen traducidos por el cliente y en el video se van a leer.
