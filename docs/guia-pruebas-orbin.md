# Guía de Pruebas — Orbin AI
Cómo probar cada preset con parámetros, prompts de lenguaje natural, y el prompt de cocina grande por Visión IA.

> **Reglas duras que el diseño SIEMPRE debe respetar** (para validar cada prueba):
> - Chapa MDF/MDP máx **2750 × 1840 mm** — ninguna pieza estructural puede excederla.
> - Estructura **18 mm** · fundos **6 mm**.
> - Holgura de gaveta **13 mm por lado** (26 mm total, corredera telescópica).
> - Vão máximo sin apoyo **900 mm** (estante MDF 18 mm).
> - Ancho > **2700 mm** → el motor **auto-divide** en módulos.
> - Cada prueba debe terminar en **✓ Validado** (avisos de eficiencia de nesting son normales).

---

## 1) Presets con parámetros

Para cada preset: aplicalo, ajustá los parámetros sugeridos, clic en **Adicionar Módulo**, y verificá el checklist.

| # | Preset | Dimensiones sugeridas (L×A×P mm) | Parámetros a probar | Resultado esperado |
|---|--------|----------------------------------|---------------------|--------------------|
| 1 | **Cocina (base)** | 800 × 720 × 580 | 2 puertas · rodapé 100mm · sin gavetas | Gabinete base 2 puertas · ✓ Validado · ~10 piezas |
| 2 | **Isla de Cocina** | 1200 × 900 × 900 | con bancada (tampo) · 4 gavetas | Isla con tampo · gavetas con 5 paneles c/u · ✓ Validado |
| 3 | **Armario / Guarda-roupa** | 1800 × 2200 × 600 | 2 puertas · 3 estantes · 2 gavetas | Ropero mixto · estantes ≤900mm de vão · ✓ Validado |
| 4 | **Baño** | 600 × 500 × 400 | aéreo · 2 puertas · 1 estante | Módulo aéreo (sin rodapé) · ✓ Validado |
| 5 | **Oficina (escritorio)** | 1200 × 750 × 600 | 1 estante · 2 gavetas | Escritorio con cajonera · ✓ Validado |
| 6 | **Estante / Prateleira** | 800 × 1800 × 300 | 4 estantes · sin puertas | Librero abierto · vão entre estantes ≤900mm · ✓ Validado |
| 7 | **Cómoda (chest of drawers)** | 800 × 1100 × 500 | 5 gavetas · 0 estantes · sin puertas | **Cómoda pura** · debe dar ✓ Validado (bug corregido) · cada gaveta = frente + 2 laterales + frente/trasera + fundo 6mm |
| 8 | **Cocina Modular con Puertas** | 900 × 720 × 580 | 3 puertas · rodapé | Multi-puerta · divisores internos · ✓ Validado |
| 9 | **Mueble TV / Sala** | 1800 × 500 × 450 | 2 puertas · 2 nichos abiertos | Rack bajo · ✓ Validado |

### Pruebas de estrés (casos límite)
| Caso | Cómo | Qué verificar |
|------|------|---------------|
| **Auto-split** | Armario 3600 × 2400 × 600 | Se divide en 2 módulos; cada uno cabe en chapa |
| **Pieza al límite** | Ancho 2700 mm | 1 solo módulo, fondo/piezas ≤ límites |
| **Gaveta estrecha (debe rechazar)** | Ancho 200 mm con gavetas | Aviso: caja de gaveta muy estrecha |
| **Vão excesivo (debe avisar)** | Estante de 1000 mm sin apoyo | Aviso de vão > 900 mm |

---

## 2) Prompts de Lenguaje Natural (pestaña "Lenguaje Natural" o chat IA)

El parser entiende **PT, ES e IN** y medidas en **m, cm o mm**. Copiá y pegá:

**Roperos / Guarda-roupas**
- `Guarda-roupa 1800x2400x600 com 2 portas de correr e 3 gavetas`
- `Armario 2000 de ancho, 2200 de alto, 60 de profundidad con 4 puertas y 4 cajones`
- `Closet de 3200mm de largura — divide se precisar`  *(dispara auto-split)*

**Cocinas**
- `Módulo base de cozinha 800x720x580 com 2 portas e tampo de granito`
- `Gabinete aéreo de cozinha 1200x700x350 com 2 portas`
- `Balcão de pia 1500x850x600 sem tampo, com travessas para granito`

**Cómodas / Gaveteros**
- `Cômoda de 5 gavetas 800x1100x500`
- `Gaveteiro alto 600x1500x500 com 6 gavetas`

**Estantes / Librerías**
- `Estante 900x2000x300 com 5 prateleiras`
- `Prateleira flutuante 1200x300x250`

**Baños / Oficina**
- `Espelheira de banheiro 800x600x150`
- `Escrivaninha 1400x750x600 com 2 gavetas e 1 nicho`

**Estrés (para QA)**
- `Armário de 4 metros de largura` *(auto-split en 2)*
- `Cômoda 300x1800 só com gavetas` *(cómoda pura — debe validar)*

> Tip para el video: generá 3-4 de estos seguidos y capturá cada render con el snippet de Descargas.

---

## 3) Prompt para COCINA GRANDE por Visión IA

Pegá esto en **"Diseñar con IA" / Visión IA**. Incluye medidas para que genere directo (si la IA pide dimensiones, ya están dentro):

```
Preciso de uma cozinha planejada grande em "L", modular, com lista de corte pronta:

1) Balcão base esquerdo: 2400 x 900 x 600 mm — 3 gavetas à esquerda e 2 portas à direita, rodapé de 100 mm.
2) Balcão base direito: 1800 x 900 x 600 mm — 4 portas, rodapé de 100 mm.
3) Torre alta (forno/geladeira): 600 x 2200 x 600 mm — 2 portas.
4) Aéreos: 2400 x 700 x 350 mm com 4 portas + 1800 x 700 x 350 mm com 3 portas.

Tampo de granito preto absoluto sobre os balcões base. Material dos módulos: melamina Carvalho Hanover 18 mm, fundos 6 mm. Corrediças telescópicas com folga de 13 mm por lado. Gere cada módulo, valide a estrutura e prepare a lista de corte.
```

**Versión corta (si querés que la IA te pida las medidas y mostrar el flujo conversacional en el video):**
```
Quero projetar uma cozinha planejada grande em L, com balcões base, uma torre alta para forno e geladeira, e módulos aéreos. Tampo de granito preto.
```
→ La IA te pedirá dimensiones; respondé por ejemplo:
```
Balcões base 2400 e 1800 (900 de altura, 600 de profundidade), torre 600x2200x600, aéreos 2400 e 1800 (700x350).
```

---

### Checklist de captura para el video
- [ ] 3D limpio de cada preset (gira al ángulo lindo, luego el snippet)
- [ ] Cocina grande generada por IA (flujo conversacional)
- [ ] Vista "Lista de Corte" (Win+Shift+S)
- [ ] Panel Exportar (DXF/SketchUp/CNC) (Win+Shift+S)
- [ ] Colaboración: link de sala (Win+Shift+S)

Snippet de captura del render 3D (F12 → Console, cambiá el nombre):
```js
(()=>{const c=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='orbin_MI_DISEÑO.png';a.click();})()
```
