# Plan de pendientes — sesión 2026-10-18/19

Regla de trabajo: **todo cambio es aditivo** (columna, archivo nuevo, función nueva o parámetro con default que conserva el comportamiento actual). Lo que sea borrar o sobrescribir requiere aprobación explícita y queda marcado como **[Requiere aprobación]**.

## Estado

| # | Pendiente | Estado | Tipo de cambio | Siguiente paso |
|---|---|---|---|---|
| 1 | Estado de publicación (`draft`/`validated`/`approved`) | **Hecho** (migración 013 + `status` en lectura y guardado) | Aditivo | Ninguno hasta tener flujo `draft` |
| 2 | Auditoría de galería (solo lectura) | **Hecho** (`server/scripts/gallery_audit.js`, 9/9 coherentes) | Archivo nuevo | Ejecutar antes de cada aprobación |
| 3 | Compuerta automática que marca `validated` | Pendiente | Archivo nuevo | Reutilizar `verdict()` del auditor; escribir solo con `--apply` |
| 4 | Flujo `draft` → generador escribe borradores | Pendiente | Parámetro nuevo en `save-viable` (default = comportamiento actual) | Depende de 3 |
| 5 | Filtro público por `status = 'approved'` | Pendiente | Solo después de 4 y de tu revisión visual | No antes: vaciaría la galería |
| 6 | Permisos del corrector (DeepSeek en OpenCode) | Pendiente | Configuración externa | Verificar en OpenCode si soporta permisos por ruta; si no, control por Git |
| 7 | Duplicado `0a3ad9f3-aad0-41f4-8ca8-6d151e03eda8` | **Hecho** (borrado; params idénticos a `0712a448`; galería 8/8 validated) | Borrado aprobado | — |
| 8 | Respaldos `*.bak_*` (5 archivos) | **Hecho** (borrados; sin imports en el código) | Borrado aprobado | — |
| 9 | "Mueble Base QA Test CASE A" | **Mantenido** (pasa el auditor; técnicamente correcto) | Sin cambio | Revisar si quieres quitarlo por criterio de producto |
| 10 | Regla 250 mm en puertas abatibles con gavetas | **Decidido: aviso** (ya implementado) | Sin cambio | — |
| 11 | Eje de apertura de la puerta elevable en lista de cortes / plano | Pendiente | Aditivo (nota en lista de cortes) | Agregar campo de nota, sin cambiar piezas |
| 12 | Límites de pistón (8 kg, 900 mm por hoja, 200–900 mm) | **Sin verificar** | Dato externo | Pedir ficha técnica al proveedor del pistón; hoy son [Suponiendo] |
| 13 | Build del cliente (vite) no verificado tras cambios de `viableStore`/`GalleryCatalog`/`InputPanel` | Pendiente | Verificación | Ejecutar `vite build` y tests de cliente |
| 14 | Commit | **No hecho** | — | Solo si dices "commitea" |
| 15 | Variables de Railway, push a origin, limpieza de archivos sueltos (`_arrancar_*`, `backup_pre_ai_fix.patch`, archivos de ollama) | Pendiente | Revisión | Triage separado; no tocar en esta ronda |

## Orden propuesto
1. (Hecho) Migración 013 y auditoría.
2. Verificar build del cliente (13). Solo lectura salvo `dist/`.
3. Compuerta (3) y parámetro `draft` en `save-viable` (4), con default que mantiene el guardado actual. Pruebas nuevas, sin cambiar las existentes.
4. Eje de apertura en la lista de cortes (11), como campo nuevo.
5. Verificar permisos de OpenCode (6) antes de conectar DeepSeek.
6. Tus decisiones: 7, 8, 9, 10. Solo entonces se aplican.
7. Ficha del pistón (12) cuando la tengas; luego ajustar `LIFT_DOOR` si difiere.
8. Filtro público (5) solo tras revisión visual y con datos `draft` reales.

## Criterio de cierre
- Pruebas motor/IA y rutas en verde.
- `gallery_audit.js` sin discrepancias.
- Ningún borrado sin tu aprobación explícita.
