# Prompt de continuación — Planos Orbin: Vista de Conjunto + pulido del faldón

> Pegá el bloque de abajo en una sesión nueva de Cowork (con la carpeta `Orbin` conectada). Le da todo el contexto para retomar sin repetir trabajo.

---

```
ROL: Ingeniero senior de Orbin AI (diseño paramétrico de muebles). Retomamos el trabajo sobre los PLANOS TÉCNICOS. Objetivo de esta sesión: (1) revisar la VISTA DE CONJUNTO y (2) seguir puliendo el detalle del FALDÓN (modesty panel del escritorio) en el Plano Ejecutivo y el Plano de Montaje.

## Arquitectura de planos (ya unificada — NO reintroducir duplicación)
Hay 3 salidas y un modelo compartido:
- MODELO ÚNICO (SSOT de la geometría del alzado): client/src/engine/elevationModel.js → `pieceRectsMM(module)` proyecta las pieces[] REALES del motor a rects en mm (y-up, 0=piso), con un `style` por pieza (solid/open/door/drawer_front/baseboard/apron). `elevationBox()` da escala/encuadre. AMBOS planos consumen esto: un fix acá corrige los dos.
- Plano Ejecutivo (PDF, jsPDF): client/src/engine/planRenderer.js → `drawElevation()` (adaptador jsPDF del modelo). Lo arma page-a-page client/src/components/ExportPanel.jsx → `drawExecutivePage()`.
- Plano de Montaje (SVG→PDF): client/src/engine/planGenerator.js → `generateModulePlanSVG()` (por módulo) y `generateConjuntoPlanSVG()` (todos juntos). `buildAlzadoUnified(module,box,P,D)` usa `buildAlzadoFromPieces` (proyección SSOT) si hay pieces, si no cae al paramétrico.
- Motor que genera las pieces: server/src/engine/closetEngine.js → `generateDeskFurniture` (faldón = pieza type 'tie_strip', name 'Faldon Trasero'). Altura del faldón: server/src/ai/furnitureMathSpecs.js → `desk.apronHeight` (hoy ~110mm = min(140,max(90,latH*0.15))). Visor 3D: client/src/components/Viewer3D.jsx (rama isDeskViz).

## Estado actual del FALDÓN (lo ya resuelto — punto de partida)
- El faldón es una pieza TRASERA. En elevationModel se marca con `isApron()` y recibe `style:'apron'`.
- Se dibuja con convención de PIEZA OCULTA: relleno muy claro + contorno en LÍNEA DISCONTINUA (en jsPDF `setLineDashPattern`, en SVG stroke-dasharray). Así el vano de piernas se lee ABIERTO.
- Clamp HORIZONTAL activo: el faldón nunca pisa los laterales/costados que lo flanquean (se ajusta al vano real). NO hay clamp de altura (el dibujo es FIEL a la pieza real; el tamaño se controla solo en el motor).
- apronCX en el motor corregido (centro real del vano, ya no corrido ½T).

## Qué falta / a pulir en esta sesión
1. VISTA DE CONJUNTO (`generateConjuntoPlanSVG`): revisar layout con varios muebles — que respete espacios (sin overflow, alineado al piso, etiquetas por módulo) y que cada mueble use el alzado unificado (incl. escritorio con faldón correcto). Verificar que el faldón se vea bien también en el conjunto.
2. FALDÓN fino en ambos planos: evaluar si la línea discontinua se lee bien a escala pequeña; si conviene una etiqueta ("faldón/modesty"); coherencia ejecutivo vs montaje; y comportamiento con pedestalSide left/right y sin pedestal.

## Cómo VERIFICAR visualmente (OBLIGATORIO, con tus propios ojos)
Tenés cairosvg, pdftoppm y PIL instalados. En bash el repo está en /sessions/<TU_SESION>/mnt/Orbin ; los file tools (Read/Edit) usan la ruta Windows del proyecto Orbin. Para RASTERIZAR un SVG de prueba y mirarlo:

  cd <repo>/client && node -e "
  const { generateProject } = require('../server/src/engine/closetEngine');
  const es=require('esbuild');const fs=require('fs');
  const out=es.buildSync({entryPoints:['src/engine/planGenerator.js'],bundle:true,write:false,format:'cjs'});
  const m={exports:{}};new Function('module','exports','require',out.outputFiles[0].text)(m,m.exports,require);
  const co={empresa:'Test',material:'MDF 18mm',desenhista:'Dev'};
  const mods=['desk','base','aereo','standard'].map(mt=>{const d=generateProject({moduleType:mt,width:mt==='aereo'?800:1200,height:mt==='desk'?750:(mt==='base'?900:(mt==='aereo'?700:2000)),depth:mt==='aereo'?350:600,numDrawers:mt==='desk'?3:0,hasDoors:mt!=='desk',numDoors:2});return {id:d.id,configuration:d.configuration,pieces:d.pieces,specAdjustments:d.specAdjustments};});
  fs.writeFileSync('<repo>/_plan_review/conjunto.svg', m.exports.generateConjuntoPlanSVG(mods,{theme:'print',lang:'ES',company:co}));
  fs.writeFileSync('<repo>/_plan_review/desk.svg', m.exports.generateModulePlanSVG(mods[0],{theme:'print',lang:'ES',company:co}));
  "
  cd <repo>/_plan_review && python3 -c "import cairosvg; [cairosvg.svg2png(url=f+'.svg',write_to=f+'.png',output_width=1200) for f in ['conjunto','desk']]"

Luego usá Read sobre los PNG en Orbin/_plan_review/ para MIRARLOS. Iterá hasta que se vea profesional. (La carpeta _plan_review es temporal de trabajo — se puede borrar.)

## Restricciones DURAS
- ADITIVO / no destructivo. No romper closet/base/aéreo ni la unificación de renderers.
- FIDELIDAD: el dibujo debe coincidir con la lista de cortes. Nunca falsear medidas en el render; si hay que cambiar tamaños, se hace en el motor.
- Tests del motor en verde: cd <repo>/server && node --test src/engine/*.test.js (deben dar 109 pass, 0 fail).
- Verificar que elevationModel.js, planGenerator.js, planRenderer.js, ExportPanel.jsx y Viewer3D.jsx COMPILAN con esbuild transform.
- Los cambios de MOTOR requieren reiniciar backend + regenerar el módulo para verse en la app; los de CLIENTE (render de planos) se ven con F5. Los planos proyectan las pieces GUARDADAS del módulo: si un PDF sale con datos viejos, hay que regenerar el módulo.

## Memoria del proyecto
Leé la memoria "Orbin rediseño planos" (rondas 1–10) para el detalle de todo lo hecho: unificación, peso JPEG, tiradores al centro, lista de cortes en panel lateral, idioma, faldón (posición, tamaño, estilo trasero).

Empezá generando y MIRANDO la Vista de Conjunto y el escritorio, y proponé mejoras concretas antes de tocar código.
```
