/**
 * Orbin AI — Renderer de ALZADO 2D detallado (jsPDF). Multi-módulo + cotas internas.
 * Proyecta las piezas reales (pieces[] con x,y,z) al plano frontal. Reemplaza el screenshot del wireframe.
 * Uso en ExportPanel: import { drawElevation, addProjectPlans } from './planRenderer.js'
 */
const VERTICAL=new Set(['lateral','divider','divisor','drawer_box','tamponado'])
const HORIZONTAL=new Set(['techo','piso','base','shelf','repisa','estante','drawer_bottom'])
const HIDDEN=new Set(['drawer_box','drawer_bottom','fondo'])
// ── Orden de profundidad (back → front) ──────────────────────────────────────
// En un alzado técnico una pieza delantera OCULTA las aristas de lo que hay
// detrás. Sin esto, la cubierta y el zócalo se dibujaban encima de los laterales
// y sus líneas se veían cruzando la carcasa.
const Z_ORDER={fondo:0,lateral:1,tamponado:1,divider:1,divisor:1,piso:2,base:2,techo:2,
  shelf:3,repisa:3,estante:3,tie_strip:3,baseboard:4,countertop:5,tampo:5,cubierta:5,
  drawer_front:6,door:6,standard_door:6}
const zOf=t=>(Z_ORDER[t]!==undefined?Z_ORDER[t]:3)
// Piezas macizas: se rellenan de blanco para ocultar lo que tapan. Puertas y
// frentes quedan en trazo abierto para no esconder el interior del mueble.
const SOLID=new Set(['lateral','tamponado','divider','divisor','piso','base','techo',
  'shelf','repisa','estante','tie_strip','baseboard','countertop','tampo','cubierta'])
function pieceBox(p){const w=p.width,h=p.height,th=p.thickness,t=p.type,nm=(p.name||'').toLowerCase()
  const side=t==='drawer_box'&&nm.includes('lateral');let dx,dy
  if(VERTICAL.has(t)&&(t!=='drawer_box'||side)){dx=th;dy=h}else if(HORIZONTAL.has(t)){dx=w;dy=th}else{dx=w;dy=h}
  return{type:t,cx:p.x,cy:p.y,dx,dy}}
function boxesOf(mod){const ps=(mod.pieces&&mod.pieces.length)?mod.pieces:[];return ps.filter(p=>typeof p.x==='number').map(pieceBox)}

/** Dibuja el alzado de UN módulo dentro del rect (ox,oy,areaW,areaH) en mm sobre el doc jsPDF. */
/** Geometría del alzado SIN dibujar. Fuente única de escala/encuadre: el plano
 *  ejecutivo la usa para el rótulo "E 1:N" y para su marco de cotas. */
export function elevationBox(mod, ox, oy, areaW, areaH){
  const cfg=mod.configuration||{}; const W=cfg.width||600,H=cfg.height||720
  const pad=20, sc=Math.min((areaW-2*pad)/W,(areaH-2*pad)/H)
  // Altura de la CARCASA = arista superior más alta de las piezas estructurales.
  // Hoy coincide con H (los laterales llegan al tope). Si el modelo incorporase una
  // cubierta apoyada encima, carcassH < H y el plano acotaría ambas por separado
  // sin tocar el dibujo: la cota se deriva del modelo, no de una suposición.
  const struct=boxesOf(mod).filter(b=>['lateral','tamponado','techo','tie_strip'].includes(b.type))
  const carcassH=struct.length?Math.max(...struct.map(b=>b.cy+b.dy/2)):H
  return { x:ox+(areaW-W*sc)/2, y:oy+(areaH-H*sc)/2, w:W*sc, h:H*sc, scale:sc, W, H, carcassH }
}

export function drawElevation(doc, mod, ox, oy, areaW, areaH, opts={}){
  const cfg=mod.configuration||{}; const W=cfg.width||600,H=cfg.height||720
  const boxes=boxesOf(mod).filter(b=>!HIDDEN.has(b.type))
  // escala para caber (deja 18mm de margen para cotas)
  const box=elevationBox(mod, ox, oy, areaW, areaH)
  const sc=box.scale, bx=box.x, by=box.y
  const X=x=>bx+x*sc, Y=y=>by+(H-y)*sc   // y-up → pantalla
  doc.setDrawColor(27,27,27); doc.setFillColor(255,255,255)
  // Back → front: cada pieza maciza se rellena y tapa las aristas de atrás.
  const ordered=[...boxes].sort((a,b)=>zOf(a.type)-zOf(b.type))
  for(const b of ordered){
    const x0=b.cx-b.dx/2,y0=b.cy-b.dy/2, px=X(x0),py=Y(y0+b.dy),pw=b.dx*sc,ph=b.dy*sc
    // Puertas y frentes SOBREPUESTOS: solapan los laterales ~17mm por lado (correcto
    // en carpintería). Si se dibujan en trazo abierto, sus aristas cruzan los laterales
    // y el interior se transparenta ⇒ maraña de líneas. Van opacos: están delante.
    if(b.type==='drawer_front'){doc.setLineWidth(0.3);doc.rect(px,py,pw,ph,'FD');doc.setLineWidth(0.5);doc.line(X(b.cx-90),Y(b.cy),X(b.cx+90),Y(b.cy))}
    else if(b.type==='door'||b.type==='standard_door'){doc.setLineWidth(0.3);doc.rect(px,py,pw,ph,'FD');doc.circle(X(b.cx+b.dx/2-60),Y(b.cy),0.8,'F')}
    else if(b.type==='baseboard'){doc.setLineWidth(0.25);doc.rect(px,py,pw,ph,'FD')}
    else if(SOLID.has(b.type)){doc.setLineWidth(0.35);doc.rect(px,py,pw,ph,'FD')}
    else{doc.setLineWidth(0.35);doc.rect(px,py,pw,ph)}
  }
  // ── cotas ──
  doc.setDrawColor(90,90,90);doc.setTextColor(60,60,60);doc.setFontSize(7);doc.setLineWidth(0.18)
  const dimH=(x1,x2,y,txt)=>{doc.line(X(x1),Y(y),X(x2),Y(y));doc.text(String(txt),(X(x1)+X(x2))/2,Y(y)-1.2,{align:'center'})}
  const dimV=(y1,y2,x,txt)=>{doc.line(X(x),Y(y1),X(x),Y(y2));doc.text(String(txt),X(x)-1.5,(Y(y1)+Y(y2))/2,{align:'center',angle:90})}
  // Cotas generales: opcionales. El plano ejecutivo las dibuja él mismo con su
  // propio estilo; dibujarlas aquí también producía "600 / 600 mm" duplicado.
  if(opts.overallDims!==false){
    dimH(0,W,H+ (12/sc), W)        // ancho total arriba
    dimV(0,H,-(12/sc), H)          // alto total izquierda
  }
  // cotas internas (derecha): niveles Y de horizontales y frentes
  if(opts.internalDims!==false){
    const lv=new Set([0,H])
    for(const b of boxes){if(['piso','techo','base','shelf','repisa','estante','baseboard'].includes(b.type))lv.add(Math.round(b.cy));if(b.type==='drawer_front'){lv.add(Math.round(b.cy-b.dy/2));lv.add(Math.round(b.cy+b.dy/2))}}
    const ys=[...lv].sort((a,b)=>a-b); const cxr=W+((opts.internalDimOffset||12)/sc)
    for(let i=0;i<ys.length-1;i++){const d=ys[i+1]-ys[i];if(d>40)dimV(ys[i],ys[i+1],cxr,d)}
  }
  // título (traducible: lo aporta el llamador según el idioma activo)
  if(opts.showTitle!==false){
    const label=opts.title||'Alzado frontal'
    doc.setTextColor(27,27,27);doc.setFontSize(8);doc.setFont('helvetica','bold')
    doc.text(`${mod.id||'MOD'} · ${W}×${H}×${cfg.depth||''} mm · ${label}`, ox+2, oy+areaH-1)
    doc.setFont('helvetica','normal')
  }
  // FUENTE ÚNICA de la geometría dibujada. El llamador DEBE usar esta caja para
  // acotar: si recalcula la suya (como hacía el plano ejecutivo con imgW*0.85),
  // el marco de cotas no coincide con el dibujo → líneas cruzando el mueble y la
  // cota del rodapié fuera del zócalo.
  return box
}

/** Añade al doc una página por módulo con su alzado. Devuelve nº de módulos dibujados. */
export function addProjectPlans(doc, modules, opts={}){
  const A4W=297,A4H=210,M=12; let n=0
  modules.forEach((mod,i)=>{ if(i>0)doc.addPage(); doc.rect(M,M,A4W-2*M,A4H-2*M); drawElevation(doc,mod,M+4,M+4,A4W-2*M-8,A4H-2*M-8); n++ })
  return n
}
export default { drawElevation, addProjectPlans }
