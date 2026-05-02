# 🪵 Orbin Furniture AI

**Automatización de diseño paramétrico de muebles asistida por IA.**

> **Estado actual (2026-05-02): ✅ Estable — v2.1 operativa**

## 🎯 Visión
Eliminar la dependencia de diseñadores externos en la marcenaria tradicional, automatizando el 80% del diseño estándar y generando listas de corte instantáneas.

## 🏗️ Arquitectura del Sistema

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend | React 18 + Vite + Tailwind | ✅ Activo — puerto 5173 |
| Backend | Node.js + Express | ✅ Activo — puerto 3001 |
| Motor Paramétrico | `server/src/engine/` | ✅ v2 con holguras independientes |
| Validación | `closetEngine + validator` | ✅ Reglas estructurales activas |
| Database | Supabase | ⚙️ Opcional (fallback a memoria) |
| AI Layer | Claude (NL) + Ollama (validación) | ⚙️ Opcional (regex fallback) |
| Visualización 3D | Three.js | ✅ Viewer con selección y highlight |

## 🚀 Arranque Rápido

```bash
# Windows — doble clic en:
start.bat

# Manual
cd server && npm install && npm run dev   # API en :3001
cd client && npm install && npm run dev   # UI en :5173
```

## 🧠 Features Activas (v2.2)

1. **Natural Language Input:** "Closet de 2.40m con 3 cajones y maletero".
2. **Generación de JSON Maestro:** Desglose de piezas, medidas y componentes.
3. **Lista de Corte:** Cálculo automático basado en espesores (15/18/25mm).
4. **Validación Estructural:** Reglas de carpintería aplicadas por código.
5. **Motor de Nesting:** Estimación de chapas y eficiencia de material.
6. **Visor 3D:** Three.js con selección de piezas, vista explotada, wireframe y highlight por color.
7. **Modo Órbita/Navegación:** Botón `Move` en toolbar 3D — desactiva selección para rotar libremente sin interferencias.
8. **Laterales Internos (Divisorias):** Campo `Laterales Internos` en el panel de parámetros. Genera divisorias verticales con altura paramétrica (`H - 2×Espesor`), distribuidas uniformemente. Las prateleiras se dividen automáticamente por sección.
9. **Highlight de Selección:** Piezas cambian a verde neón al ser seleccionadas; módulo activo pulsa en dorado.
10. **Historial Undo/Redo:** Pila de 20 estados con Ctrl+Z / Ctrl+Y.
11. **Borrado por teclado:** Tecla `Delete` elimina el módulo seleccionado del array global.
12. **Módulos múltiples:** Composición de closets multimodulares en una sesión.
13. **Exportación:** PDF, CSV, imagen 3D y JSON maestro.
14. **Multilenguaje:** PT / ES / EN con selector dinámico.

## 🔧 Motor Paramétrico — Holguras de Manufactura

Las holguras de frentes de gaveta y puertas son **independientes** y están definidas en `server/src/engine/constants.js`:

| Pieza | Constante | Valor | Motivo |
|-------|-----------|-------|--------|
| Frente Gaveta (altura) | `HARDWARE.DRAWER_FRONT_GAP_H` | 3mm | Recorrido de correderas + reveal |
| Puerta (ancho total) | `HARDWARE.DOOR_GAP_W_TOTAL` | 5mm | Solape 2.5mm por lado (bisagras) |
| Puerta (alto) | `HARDWARE.DOOR_GAP_H` | 4mm | Copa de bisagra superior/inferior |

## ⌨️ Atajos de Teclado

| Atajo / Control | Acción |
|----------------|--------|
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Rehacer |
| `Delete` | Eliminar módulo seleccionado |
| Botón `Move` (toolbar 3D) | Activar/desactivar Modo Órbita — rota sin seleccionar |
| Click en pieza 3D | Seleccionar pieza (highlight verde neón) |
| `Shift+Click` | Selección múltiple de piezas |
| Click+Drag en 3D | Box selection (rectángulo de selección) |

## 🤖 Orbin AI Persona
- **Saludo:** "Hola, soy Orbin. ¿Qué vamos a crear hoy?"
- **Especialidad:** Consultoría técnica en diseño paramétrico y manufactura.
- **Identidad:** Agente experto, amigable y preciso.

## 🧭 Roadmap

- ✅ **Fase 1:** Motor paramétrico básico y lista de corte.
- ✅ **Fase 2:** Integración NL con prompts de texto.
- ✅ **Fase 3:** Visualización 3D (Three.js).
- ✅ **Fase 4:** Nesting y BOM de ferragens.
- 🔜 **Fase 5:** Presupuestos automáticos + integración Supabase.
- 🔜 **Fase 6:** App móvil / exportación a CNC.

---
*Desarrollado por Eduardo Ventura — Orbin AI Agent v2.2 — 2026-05-02*