# Orbin AI — Sistema de Prompts: Cocina Modular (Demo Workshop)

> **Propósito**: Prompts listos para demostrar la generación paramétrica de cocinas
> completas con módulos base + aéreo a través del chat IA de Orbin.
>
> Cada prompt fue validado E2E contra el pipeline `NLP → paramContract → closetEngine`
> (86/86 checks PASS, 52/52 tests unitarios PASS — 2026-10-13).
>
> **Regla de posicionamiento**: Los módulos aéreos se instalan a 1400mm del piso
> (mountHeight default). Los módulos base van al suelo. El visor 3D los posiciona
> automáticamente por `moduleType`.

---

## 🔧 MÓDULOS BASE (suelo → 850mm)

### B1 — Base estándar con puertas (bajo mesada clásico)
```
crea un mueble base de cocina de 800x850x580mm con 2 puertas batientes y una repisa interna
```
**Genera**: 11 piezas — 2 laterales, piso, fondo, 2 rodapiés, 2 travesaños, 1 repisa, 2 puertas.

### B2 — Módulo fregadero/pia (1200mm)
```
crea un modulo pia de cocina de 1200x850x580mm con 2 puertas batientes, sin repisa
```
**Genera**: 12 piezas — estructura completa con 2 puertas anchas para acceso a plomería.

### B3 — Módulo horno con puerta falsa
```
crea un modulo para horno de 640x850x580mm con una puerta falsa y una repisa interna
```
**Genera**: 11 piezas — puerta falsa sobrepuesta (PORTA-FALSA), travesaño soporte horno, repisa.

### B4 — Cajonera 4 gavetas con cava 45°
```
crea un modulo base cajonera de 500x850x580mm con 4 gavetas con cava 45 grados
```
**Genera**: 24 piezas — 4 frentes cava, 4 cajas de gaveta (lateral+estructural+fondo cada una), sin separadores (cajonera pura).

### B5 — Base estrecho (especiero/botellero)
```
crea un modulo base de cocina de 300x850x580mm con 2 repisas internas y 1 puerta
```
**Genera**: 11 piezas — módulo angosto con 1 puerta y 2 repisas.

---

## 🔝 MÓDULOS AÉREOS (pared, mountHeight: 1400mm)

### A1 — Aéreo estándar con puertas
```
crea un mueble aereo de 800x700x350mm con 2 puertas batientes y 2 repisas
```
**Genera**: 9 piezas — 2 laterales, techo, piso, fondo, 2 repisas, 2 puertas.

### A2 — Aéreo cava 45° + tamponado inferior
```
crea un mueble aereo de 800x700x350mm con 2 puertas cavas45 grados y tamponado abajo, 1 repisa
```
**Genera**: 9 piezas — puertas con extensión cava (726mm > 700mm), tamponado inferior (TAMPON-INF).

### A3 — Nicho abierto (microondas)
```
nicho abierto aereo de 600x400x350mm sin puertas
```
**Genera**: 5 piezas — caja abierta sin puertas (2 laterales, piso, techo, fondo W×H completo), ideal para microondas.

### A4 — Aéreo estrecho 1 puerta
```
crea un mueble aereo de 400x700x350mm con 1 puerta y 2 repisas
```
**Genera**: 8 piezas — módulo angosto con 1 puerta batiente.

### A5 — Aéreo grande (sobre fregadero)
```
crea un mueble aereo de 1200x700x350mm con 2 puertas batientes y 2 repisas
```
**Genera**: 9 piezas — módulo ancho que cubre el espacio sobre el fregadero.

---

## 🏗️ COMPOSICIONES COMPLETAS PARA DEMO

### Cocina Lineal Completa (4 base + 4 aéreo)
Ejecutar en este orden para armar una cocina lineal de ~3.3m:

**Paso 1 — Línea base (de izquierda a derecha):**
```
1. crea un modulo base de cocina de 300x850x580mm con 2 repisas internas y 1 puerta
2. crea un modulo para horno de 640x850x580mm con una puerta falsa y una repisa interna
3. crea un modulo pia de cocina de 1200x850x580mm con 2 puertas batientes, sin repisa
4. crea un modulo base cajonera de 500x850x580mm con 4 gavetas con cava 45 grados
```
↳ Ancho total base: 300 + 640 + 1200 + 500 = **2640mm**

**Paso 2 — Línea aérea (encima de cada base):**
```
5. crea un mueble aereo de 400x700x350mm con 1 puerta y 2 repisas
6. nicho abierto aereo de 600x400x350mm sin puertas
7. crea un mueble aereo de 1200x700x350mm con 2 puertas batientes y 2 repisas
8. crea un mueble aereo de 800x700x350mm con 2 puertas cavas45 grados y tamponado abajo, 1 repisa
```
↳ Ancho total aéreo: 400 + 600 + 1200 + 800 = **3000mm**

### Cocina Compacta (3 base + 3 aéreo)
Para espacios pequeños (~2m):

**Base:**
```
1. crea un mueble base de cocina de 800x850x580mm con 2 puertas batientes y una repisa interna
2. crea un modulo pia de cocina de 800x850x580mm con 2 puertas batientes, sin repisa
3. crea un modulo base cajonera de 500x850x580mm con 4 gavetas con cava 45 grados
```

**Aéreo:**
```
4. crea un mueble aereo de 800x700x350mm con 2 puertas batientes y 2 repisas
5. crea un mueble aereo de 800x700x350mm con 2 puertas batientes y 2 repisas
6. crea un mueble aereo de 800x700x350mm con 2 puertas cavas45 grados y tamponado abajo, 1 repisa
```

---

## 📐 Reglas de Composición Visual

| Parámetro         | Base          | Aéreo           |
|-------------------|---------------|-----------------|
| `moduleType`      | `base`        | `aereo`         |
| `mountHeight`     | 0 (suelo)     | 1400mm (pared)  |
| Alto estándar     | 850mm         | 700mm           |
| Profundidad       | 580mm         | 350mm           |
| Rodapié           | sí (100mm)    | no              |
| Contratapa        | sí            | sí              |
| Gap libre         | —             | 550mm (mesada)  |

**Esquema de elevación:**
```
          ┌─────────────────────────────────────────┐  2100mm
          │     AÉREOS (700mm alto × 350mm fondo)    │
          │     mountHeight: 1400mm                  │
          └─────────────────────────────────────────┘  1400mm
                                                       ← backsplash
          ┌─────────────────────────────────────────┐   850mm
          │     BASE (850mm alto × 580mm fondo)      │
          │     Mesada arriba                        │
          └─────────────────────────────────────────┘     0mm
          ═══════════════════════════════════════════  PISO
```

---

## 💡 Tips para la Demo

1. **Orden importa**: Primero todos los base, luego todos los aéreos. El visor los apila.
2. **Variaciones rápidas**: Cambiar `800` por `600` o `1000` en cualquier prompt — el motor recalcula todo.
3. **Agregar features**: Sumar `con cava 45 grados` o `y tamponado abajo` a cualquier prompt.
4. **Medidas en cm**: Puedes decir `80cm` en vez de `800mm` — el parser normaliza automáticamente.
5. **Español/Portugués**: Los prompts funcionan en ambos idiomas (`mueble aereo` = `armário aéreo`).
