# QA INDUSTRIAL AGENT — Orbin AI

**Dominio:** `server/src/engine/` — `closetEngine.js`, `validator.js`, `nlParser.js`, nesting, despiece.
**Modo:** EJECUCIÓN. El criterio de verdad no es el test: es **la pieza que sale de la sierra**.

---

## 1. Por qué este agente existe aparte del backend

Un bug de backend devuelve un 500 y el usuario reintenta. Un bug de motor devuelve un
**JSON válido, un plano prolijo y un presupuesto creíble** — y recién se descubre cuando el
tablero ya está cortado. El error no es recuperable: es material perdido y un cliente perdido.

Por eso acá la regla es: **el silencio es el enemigo**. Un default aplicado sin declararse es
peor que un error, porque un error se ve.

---

## 2. Restricciones duras (de `rules/parametric_constraints.md` y `CLAUDE.md`)

| Restricción | Valor | Si se viola |
|---|---|---|
| Chapa MDF/MDP máx. | **2750 × 1840 mm** | La pieza no entra en la sierra. Fallo fatal. |
| Espesor estructura | 18 mm | Cálculo de encastres inválido |
| Espesor fondos | 6 mm | Ranura equivocada |
| **Holgura de gaveta** | **13 mm por lado · 26 mm total** | La corredera telescópica no entra o queda floja |
| Vano máx. sin apoyo | 900 mm (estante MDF 18 mm) | Flexión visible en meses |
| Salida | JSON listo para nesting | Rompe la cadena de producción |

**Sobre los 13/26 mm:** son el ancho de la corredera telescópica, no una preferencia estética.
`anchoGaveta = anchoVanoInterno − 26`. Cualquier refactor que toque esta resta necesita un
test que la fije en milímetros, no un comentario.

---

## 3. Invariantes verificadas por candados

| Invariante | Candado |
|---|---|
| Ninguna pieza excede 2750×1840 | `manufacturing.test.js` |
| El nesting no coloca piezas fuera de la chapa | `cutlist.test.js` |
| El aéreo no lleva patas ni zócalo | `aereo.test.js` |
| El motor no altera el pedido en silencio | `engine.test.js` (transparencia) |
| Plano · CSV · etiqueta térmica nombran igual la pieza | `pieceNamesI18n.test.js` |
| Todo texto user-facing tiene código i18n | `i18nContract.test.js` |
| Altura de instalación del aéreo usa `null`, no `0` | `mountHeight.test.js` |
| Tira de privacidad sobre gavetas | `drawerPrivacy.test.js` |
| Paridad parser online ↔ offline | `parserMirror.test.js` |

---

## 4. Reglas de trabajo que ya costaron caro

1. **El motor NUNCA traduce.** Los nombres de pieza son identificadores: nesting, BOM, hash,
   tests golden. Traducir en el motor rompe la correspondencia.
2. **NUNCA borrar `message` de un `specAdjustment`.** 17 archivos lo leen y es el fallback.
   Se le **agrega** `params`; no se lo reemplaza.
3. **El fallback esconde la falta de traducción.** Devolver el español es correcto (un aviso
   vacío es peligroso), pero vuelve INVISIBLE que falte la plantilla. Por eso la cobertura se
   verifica con un test estático, no mirando la pantalla.
4. **Coherencia de taller.** Plano, CSV y etiqueta térmica se pegan a la misma pieza física.
   Si no la nombran igual, el operario no puede emparejarlos.
5. **Un test que no puede ejecutarse debe FALLAR, no saltarse.** Para cargar código del cliente
   desde tests del server usar `clientBundle.helper.js`; nunca `try/catch` + `return`
   (dos candados reportaron "pass" sin correr durante horas).

---

## 5. Deuda abierta — parser offline (detectada 2026-08-02)

`parseNaturalLanguage("placard 2000 x 2200")` **no interpreta el formato dimensional desnudo**:
cae a los defaults (2400×2400) **sin emitir ningún `specAdjustment`**. El usuario pide 2,00 m
y recibe 2,40 m sin aviso.

Sólo se dispara con la IA caída — que es exactamente cuando nadie está mirando. Documentado en
`providerDeadline.test.js`, sección "deuda conocida".

Dos salidas, ambas requieren decisión de producto:
- **(a)** enseñarle al parser el patrón `<n> x <n>` (ancho × alto)
- **(b)** emitir un `specAdjustment` de baja confianza cuando se aplican defaults habiendo
  números sin interpretar en el texto

**(b) es más barato y más honesto. (a) sin (b) sólo mueve el silencio de lugar:** el día que
aparezca un formato no contemplado, vuelve el mismo fallo mudo.

---

## 6. Checklist antes de aceptar un cambio de motor

- [ ] Ninguna pieza excede 2750×1840 en los presets Y en los extremos del rango
- [ ] Holgura de gaveta = 26 mm totales, verificada en milímetros
- [ ] Todo default aplicado aparece en `specAdjustments` con su `code`
- [ ] Códigos nuevos traducidos ES/PT/EN (o `i18nContract.test.js` falla)
- [ ] Nombres de pieza idénticos en plano, CSV y etiqueta
- [ ] Suma del BOM = suma del despiece (sin piezas huérfanas)
- [ ] Vanos > 900 mm advertidos por el validador
