# Orbin AI — QA Checklist (Pre Soft-Launch)

Ejecutar en los **3 idiomas** (ES / PT / EN — cambiar con el selector del Header) y en **desktop + móvil**.
Marca: ✅ pasa · ⚠️ pasa con detalle · ❌ falla (abrir issue).

> Build sano antes de testear: `cd client && npm run build` debe terminar limpio.

## 1. Autenticación + OTP
- [ ] Registro con email real → llega un **código de 6 dígitos** (no un link) desde Supabase.
- [ ] Ingresar el código en `/verify` → entra a `/app` con sesión activa.
- [ ] Código incorrecto → muestra error, no entra.
- [ ] Botón **Reenviar** → llega un nuevo código.
- [ ] Recargar `/app` estando logueado → sigue logueado (sesión persistida).
- [ ] Logout → vuelve a deslogueado y `/app` redirige a login.
- [ ] Login con contraseña de cuenta ya verificada → entra directo.
- [ ] Sin sesión, abrir `/app` directo → redirige a login (no se cuela con localStorage).

## 2. Generación por parámetros
- [ ] Crear módulo con ancho/alto/profundidad → render 3D correcto + lista de corte + costo.
- [ ] Plan Free: límite de **3 módulos** se respeta (aviso al intentar el 4º).
- [ ] Editar dimensiones con sliders/inputs → 3D y costo se actualizan; **Ctrl+Z** deshace en pasos coherentes (no carácter a carácter).

## 3. Generación por lenguaje natural (chat)
- [ ] "armário aéreo 1,2m com 2 portas" → módulo **aéreo**, 1200mm, 2 puertas.
- [ ] "armario base 2m con 3 cajones" → módulo **base**, 2000mm, 3 cajones.
- [ ] "base cabinet 900mm 2 doors" (EN) → **base**, 900mm.
- [ ] "guarda-roupa 2,40m com 3 gavetas" → **standard**, 2400mm, 3 gavetas.
- [ ] Mueble más ancho que la placa (>2700mm) → **auto-split** en N módulos, todos VALIDADOS.

## 4. Visor 3D
- [ ] Rotar módulo seleccionado con el botón **Rotar 90° (Mueble L)** → gira en la esquina, no atraviesa la pared (0→90→180→270).
- [ ] Vista **explosionada** y modo **alambre** funcionan.
- [ ] Arrastrar módulo + **snap** magnético entre módulos.
- [ ] **AR** ("Ver en mi espacio") abre el visor de modelo.
- [ ] Modo presentación (cinemático) gira la cámara y se puede salir.

## 5. Gavetas / cómoda
- [ ] Cómoda pura (solo gavetas, sin estantes ni puertas) con 3 gavetas → **llenan el interior**, sin hueco abierto arriba.
- [ ] Mixto (gavetas + puertas) → gavetas abajo, espacio para puertas arriba.

## 6. Exportación
- [ ] **Plano PDF**: alzado con cotas + etiquetas por pieza (CUBIERTA/LATERAL/BASE/ZÓCALO/GAVETA/PUERTA) + leyenda de montaje.
- [ ] Lista de corte **CSV / BOM**.
- [ ] **DXF** y **G-code/CNC** (plan Industrial) descargan.
- [ ] Etiquetas térmicas 60×40mm.
- [ ] El botón **Exportar** aparece bajo "Chat con IA" en la grilla de pestañas.
- [ ] Restricciones por plan: Free sin export; Pro PDF/CSV; Industrial CNC/BOM.

## 7. i18n / idioma
- [ ] Cambiar ES→PT→EN actualiza la UI; persiste al recargar (`orbin_lang`).
- [ ] No aparecen claves crudas (texto en MAYÚSCULAS con guiones bajos) en ninguna pantalla.

## 8. Feedback beta
- [ ] Botón flotante de **feedback** visible en `/app`.
- [ ] Enviar feedback → confirma "gracias" y crea una fila en la tabla `beta_feedback` de Supabase.
  - Requisito: haber corrido la migración `server/supabase/migrations/005_create_beta_feedback.sql`.

## 9. Robustez
- [ ] Servidor caído → banner offline + parser local de respaldo sigue generando.
- [ ] Recargar a media edición no pierde el proyecto (memoria/versiones).
- [ ] Sin errores en la consola del navegador en el flujo principal.

---
**Salida esperada:** todos los ítems ✅ o con issue abierto antes de invitar a los primeros marceneros a la beta.
