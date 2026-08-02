/**
 * Orbin AI — Advanced Export Adapter Architecture v2.0
 * ★ PROTECTED: exportadores con CAPAS POR MÓDULO (DXF layers, OBJ groups, DAE nodes).
 * Geometría real derivada de pieces[] (posiciones del motor) con fallback a configuration.
 * Formatos: DXF (AutoCAD), DAE/COLLADA + OBJ + GLTF (SketchUp/Blender/3D), CNC (G-code), CSV.
 */
import { generateFactoryCutlist } from './CutlistGenerator.js'
import { AEREO_MOUNT } from './domainConstants.js'

const SHEET_WIDTH=2440, SHEET_HEIGHT=1830, SAW_KERF=4, EDGE_MARGIN=10

// ── Mapeo tipo→caja-mundo (dx,dy,dz centrados en x,y,z) ──
const VERTICAL=new Set(['lateral','divider','divisor','drawer_box','tamponado'])
const HORIZONTAL=new Set(['techo','piso','base','shelf','repisa','estante','drawer_bottom'])
const HIDDEN_ELEV=new Set(['drawer_box','drawer_bottom','fondo'])

function pieceToBox(p){
  const w=p.width,h=p.height,th=p.thickness,t=p.type
  const nm=(p.name||'').toLowerCase()
  const isDrawerSide=t==='drawer_box'&&nm.includes('lateral')
  let dx,dy,dz
  if(VERTICAL.has(t)&&(t!=='drawer_box'||isDrawerSide)){dx=th;dy=h;dz=w}
  else if(HORIZONTAL.has(t)){dx=w;dy=th;dz=h}
  else{dx=w;dy=h;dz=th}
  return {name:p.name,type:t,cx:p.x,cy:p.y,cz:p.z,dx,dy,dz,thickness:th}
}
// Cajas-mundo de un módulo: usa pieces[] si existen; si no, deriva de configuration
function moduleBoxes(mod, fallbackPieces){
  const pieces=(mod.pieces&&mod.pieces.length)?mod.pieces:(mod.piezas||null)
  if(pieces) return pieces.filter(p=>typeof p.x==='number').map(pieceToBox)
  // fallback: piezas planas sin posición → colócalas como cortes (sin geometría de ensamble)
  return (fallbackPieces||[]).map((p,i)=>({name:p.name,type:p.type,cx:(p.w||p.width||100)/2,cy:(p.h||p.height||100)/2,cz:(p.t||p.thickness||18)/2,dx:p.w||p.width||100,dy:p.h||p.height||100,dz:p.t||p.thickness||18,thickness:p.t||18}))
}
const safeId=(s,i)=>String(s||`MOD-${i+1}`).replace(/[^A-Za-z0-9_-]/g,'_')

// ── Cabecera de metadatos común a TODOS los formatos ──────────────────────────
// ★ 2026-07-26 (auditoría CAD): los exportadores emitían archivos sin procedencia.
//   Un DXF/OBJ que llega al taller sin proyecto, fecha ni unidades no es trazable:
//   nadie sabe de qué presupuesto salió ni si los números son mm o cm. Estos campos
//   son ADITIVOS (comentarios/metadata), no tocan geometría.
function exportMeta(modules,options={}){
  return {
    generator:'Orbin AI',
    project: options.projectName||options.project||'Orbin Project',
    client: options.clientName||options.client||'',
    company: options.companyName||options.company||'',
    date: new Date().toISOString(),
    units:'mm',
    modules: modules?modules.length:0
  }
}

// ── Mapa tipo→abreviatura y color ACI (para capas/subcapas por pieza) ──
const TYPE_ABBR={lateral:'LAT',divider:'DIV',divisor:'DIV',shelf:'EST',repisa:'EST',estante:'EST',techo:'TAM',piso:'BASE',base:'BASE',drawer_front:'FFR',drawer_box:'CGV',drawer_bottom:'FUN',fondo:'FND',door:'PTA',tamponado:'TMP',countertop:'TMP',baseboard:'ZOC',feet:'PATA',structural:'EST'}
const TYPE_ACI={lateral:5,divider:4,divisor:4,shelf:3,repisa:3,estante:3,techo:2,piso:2,base:2,drawer_front:1,drawer_box:6,drawer_bottom:8,fondo:8,door:1,tamponado:4,countertop:30,baseboard:9,feet:250,structural:3}
const abbrOf=(t)=>TYPE_ABBR[t]||'PZA'
const aciOf=(t)=>TYPE_ACI[t]||7
// Capa por pieza: M{n}-{TIPO}-{k}. Prefijo de módulo → AutoCAD agrupa (subcapas por filtro).
function pieceLayer(modIdx,box,counters){const key=`M${modIdx+1}-${abbrOf(box.type)}`;const n=(counters[key]=(counters[key]||0)+1);return `${key}-${n}`}

class ExportAdapter{
  constructor(name,extension,mimeType){this.name=name;this.extension=extension;this.mimeType=mimeType}
  async export(){throw new Error(`${this.name}.export() not implemented`)}
  validate(modules){
    if(!modules||modules.length===0)return{valid:false,errors:['No modules to export']}
    return{valid:true,errors:[]}
  }
  extractPieces(modules){ // compat: lista plana de cortes desde configuration
    const pieces=[]
    modules.forEach((mod)=>{
      const cfg=mod.configuration
      if(cfg){
        const W=cfg.width||600,H=cfg.height||720,D=cfg.depth||580,T=cfg.thickness||18,BT=cfg.backThickness||6
        pieces.push({moduleId:mod.id,name:'Left Panel',w:D,h:H,t:T,type:'structural',material:cfg.material||'MDP'})
        pieces.push({moduleId:mod.id,name:'Right Panel',w:D,h:H,t:T,type:'structural',material:cfg.material||'MDP'})
        pieces.push({moduleId:mod.id,name:'Top Panel',w:W-2*T,h:D,t:T,type:'structural',material:cfg.material||'MDP'})
        pieces.push({moduleId:mod.id,name:'Bottom Panel',w:W-2*T,h:D,t:T,type:'structural',material:cfg.material||'MDP'})
        pieces.push({moduleId:mod.id,name:'Back Panel',w:W,h:H,t:BT,type:'structural',material:'HDF'})
        const shelves=cfg.numShelves||cfg.shelfCount||cfg.divisions||0
        for(let s=0;s<shelves;s++)pieces.push({moduleId:mod.id,name:`Shelf ${s+1}`,w:W-2*T,h:D-20,t:T,type:'shelf',material:cfg.material||'MDP'})
        const drawers=cfg.numDrawers||cfg.drawerCount||0
        for(let d=0;d<drawers;d++)pieces.push({moduleId:mod.id,name:`Drawer Front ${d+1}`,w:W-2*T-6,h:cfg.drawerHeight||150,t:T,type:'drawer_front',material:cfg.material||'MDP'})
        const doors=cfg.numDoors||cfg.doorCount||0
        for(let dr=0;dr<doors;dr++)pieces.push({moduleId:mod.id,name:`Door ${dr+1}`,w:(W-2*T)/Math.max(doors,1),h:H-(cfg.baseboardHeight||100),t:T,type:'door',material:cfg.material||'MDP'})
      }else{
        (mod.pieces||mod.piezas||[]).forEach(p=>pieces.push({moduleId:mod.id,name:p.name||p.type||'Unknown',w:p.width||100,h:p.height||100,t:p.thickness||18,type:p.type||'structural',material:p.material||'MDP'}))
      }
    })
    return pieces
  }
}

/**
 * ★ 2026-07-26 (auditoría CAD) — LAYOUT DE ENSAMBLE para exportadores 3D.
 * Los pieces[] del motor son LOCALES al módulo (Viewer3D los coloca moviendo el
 * Group, no las piezas). Los exportadores 3D no aplicaban ningún offset: los N
 * módulos de un proyecto salían SUPERPUESTOS en el mismo origen — en Blender o
 * SketchUp el cliente veía los muebles atravesándose entre sí. El DXF sí offseteaba.
 * Devuelve el origen de cada módulo respetando su posición guardada si existe;
 * si no, los alinea al piso, contiguos, midiendo el ancho REAL de la geometría.
 */
function moduleOrigins(modules, boxesOf){
  let cursor=0
  return modules.map((mod,i)=>{
    const cfg=mod.configuration||{}
    const boxes=boxesOf(mod,i)
    let minX=Infinity,maxX=-Infinity
    for(const b of boxes){minX=Math.min(minX,b.cx-b.dx/2);maxX=Math.max(maxX,b.cx+b.dx/2)}
    if(!isFinite(minX)){minX=0;maxX=cfg.width||600}
    const w=maxX-minX
    // Aéreo: la altura de instalación es parte de la geometría de ensamble.
    const mountY=cfg.moduleType==='aereo'?(cfg.mountHeight??AEREO_MOUNT.DEFAULT):0
    const p=mod.position||mod.pos
    let o
    if(p&&typeof p.x==='number'){o={x:p.x-minX,y:typeof p.y==='number'?p.y:mountY,z:typeof p.z==='number'?p.z:0}}
    else{o={x:cursor-minX,y:mountY,z:0};cursor+=w}
    return {...o,width:w,boxes}
  })
}

// 8 vértices / 6 quads de una caja
function boxVerts(b){const x0=b.cx-b.dx/2,x1=b.cx+b.dx/2,y0=b.cy-b.dy/2,y1=b.cy+b.dy/2,z0=b.cz-b.dz/2,z1=b.cz+b.dz/2;return [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]}
const QUADS=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]]

// ── OBJ (grupos por módulo) ──
class OBJAdapter extends ExportAdapter{
  constructor(){super('OBJ (3D)','.obj','text/plain')}
  async export(modules,options={}){
    const meta=exportMeta(modules,options)
    let obj='# Orbin AI — OBJ (un objeto por PIEZA, editable por separado)\n'
    obj+=`# project: ${meta.project}\n# company: ${meta.company||meta.generator}\n# client: ${meta.client}\n# date: ${meta.date}\n# units: ${meta.units} (1 unit = 1 mm)\n# modules: ${meta.modules}\n`
    let vb=0
    const origins=moduleOrigins(modules,(mod,i)=>moduleBoxes(mod,this.extractPieces([mod])))
    modules.forEach((mod,i)=>{const id=safeId(mod.id,i);let pn=0
      // OBJ no tiene transforms de nodo: el offset del módulo se hornea en los
      // vértices. La agrupación por `o`/`g` mantiene el despiece editable igual.
      const o=origins[i]
      for(const b of o.boxes){pn++
        obj+=`\no ${id}__${safeId(b.name,0).slice(0,28)}_${pn}\ng ${id}\n`
        for(const v of boxVerts(b))obj+=`v ${v[0]+o.x} ${v[1]+o.y} ${v[2]+o.z}\n`
        for(const f of QUADS)obj+=`f ${f.map(k=>k+1+vb).join(' ')}\n`;vb+=8}})
    return{blob:new Blob([obj],{type:this.mimeType}),filename:`orbin-3d-${Date.now()}.obj`,metadata:{format:'OBJ',modules:modules.length}}
  }
}
// ── COLLADA .dae (nodo por módulo = grupo en SketchUp) ──
class DAEAdapter extends ExportAdapter{
  constructor(){super('SketchUp (COLLADA)','.dae','model/vnd.collada+xml')}
  async export(modules,options={}){
    const meta=exportMeta(modules,options)
    const geos=[],nodes=[]
    const origins=moduleOrigins(modules,(mod,i)=>moduleBoxes(mod,this.extractPieces([mod])))
    modules.forEach((mod,i)=>{const modId=safeId(mod.id,i);const children=[];let pn=0
      for(const b of origins[i].boxes){pn++
        const pid=`${modId}_p${pn}_${safeId(b.name,0).slice(0,24)}`
        const verts=[];boxVerts(b).forEach(v=>verts.push(v[0],v[1],v[2]))
        const faces=[];for(const f of QUADS){faces.push(f[0],f[1],f[2],f[0],f[2],f[3])}
        geos.push(`<geometry id="geo_${pid}" name="${pid}"><mesh><source id="pos_${pid}"><float_array id="posA_${pid}" count="${verts.length}">${verts.join(' ')}</float_array><technique_common><accessor source="#posA_${pid}" count="${verts.length/3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="vtx_${pid}"><input semantic="POSITION" source="#pos_${pid}"/></vertices><triangles count="${faces.length/3}"><input semantic="VERTEX" source="#vtx_${pid}" offset="0"/><p>${faces.join(' ')}</p></triangles></mesh></geometry>`)
        children.push(`<node id="${pid}" name="${(b.name||pid).replace(/[<>&\"]/g,'_')}"><instance_geometry url="#geo_${pid}"/></node>`)}
      // <translate> a nivel de nodo: mismo criterio que glTF — el módulo se coloca
      // en el ensamble, las piezas conservan sus coordenadas locales.
      const o=origins[i]
      nodes.push(`<node id="${modId}" name="${modId}"><translate sid="location">${o.x} ${o.y} ${o.z}</translate>${children.join('')}</node>`)})
    // ★ 2026-07-26: <contributor>/<created> añadidos — SketchUp los muestra en
    //   Model Info y sin ellos el archivo llega al cliente sin procedencia.
    const esc=(s)=>String(s||'').replace(/[<>&"]/g,'_')
    const assetXml=`<asset><contributor><author>${esc(meta.client)}</author><authoring_tool>${esc(meta.generator)}</authoring_tool><comments>${esc(meta.project)} · ${esc(meta.company)}</comments></contributor><created>${meta.date}</created><modified>${meta.date}</modified><up_axis>Y_UP</up_axis><unit name="millimeter" meter="0.001"/></asset>`
    const dae=`<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">${assetXml}<library_geometries>${geos.join('')}</library_geometries><library_visual_scenes><visual_scene id="Scene" name="${esc(meta.project)||'Orbin'}">${nodes.join('')}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>`
    return{blob:new Blob([dae],{type:this.mimeType}),filename:`orbin-sketchup-${Date.now()}.dae`,metadata:{format:'COLLADA 1.4.1',modules:modules.length,pieces:geos.length,...meta}}
  }
}
// ── GLTF real (geometría) ──
class GLTFAdapter extends ExportAdapter{
  constructor(){super('GLTF (3D)','.gltf','model/gltf+json')}
  async export(modules,options={}){
    // ★ 2026-07-26 (auditoría CAD) — DE-FLATTENING:
    //   Antes TODOS los módulos y TODAS las piezas se fundían en una sola mesh, un
    //   solo nodo, sin nombres: el archivo llegaba a Blender/SketchUp como un bloque
    //   monolítico imposible de despiezar, mover o medir por pieza. OBJ y DAE ya
    //   exportaban por pieza; glTF era la excepción y rompía el pipeline.
    //   Ahora: nodo por MÓDULO → nodos hijos por PIEZA → una mesh nombrada por pieza,
    //   con coordenadas relativas del motor preservadas (mismas cajas que OBJ/DAE).
    const meta=exportMeta(modules,options)
    const pos=[],idx=[]              // buffers compartidos (una sola descarga base64)
    const meshes=[],accessors=[],nodes=[],sceneNodes=[]
    const origins=moduleOrigins(modules,(mod,i)=>moduleBoxes(mod,this.extractPieces([mod])))
    modules.forEach((mod,i)=>{
      const modId=safeId(mod.id,i);const children=[];let pn=0
      for(const b of origins[i].boxes){pn++
        const vStart=pos.length/3, iStart=idx.length
        const verts=boxVerts(b);verts.forEach(v=>pos.push(v[0],v[1],v[2]))
        // Índices LOCALES (0..7): cada accessor de POSITION apunta al bloque de
        // su pieza vía byteOffset, así el índice no depende del orden global.
        for(const f of QUADS){idx.push(f[0],f[1],f[2],f[0],f[2],f[3])}
        let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9]
        for(const v of verts)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k])}
        const aIdx=accessors.length
        accessors.push({bufferView:0,byteOffset:iStart*4,componentType:5125,count:idx.length-iStart,type:'SCALAR'})
        accessors.push({bufferView:1,byteOffset:vStart*12,componentType:5126,count:verts.length,type:'VEC3',min:mn,max:mx})
        const pieceName=`${modId}__${safeId(b.name,0).slice(0,28)}_${pn}`
        const meshIdx=meshes.length
        meshes.push({name:pieceName,primitives:[{attributes:{POSITION:aIdx+1},indices:aIdx,mode:4}]})
        const nodeIdx=nodes.length
        nodes.push({name:pieceName,mesh:meshIdx,extras:{type:b.type,thickness:b.thickness,moduleId:modId}})
        children.push(nodeIdx)}
      const modNodeIdx=nodes.length
      // translation a nivel NODO: coloca el módulo en el ensamble sin tocar la
      // geometría de las piezas (que sigue siendo local y reutilizable).
      const o=origins[i]
      nodes.push({name:modId,translation:[o.x,o.y,o.z],children,extras:{moduleId:modId,widthMM:o.width}})
      sceneNodes.push(modNodeIdx)})
    const posBuf=new Float32Array(pos),idxBuf=new Uint32Array(idx)
    const toB64=(u8)=>{if(typeof Buffer!=='undefined')return Buffer.from(u8.buffer,u8.byteOffset,u8.byteLength).toString('base64');let str='';for(let i=0;i<u8.length;i++)str+=String.fromCharCode(u8[i]);return btoa(str)}
    const idxBytes=new Uint8Array(idxBuf.buffer),posBytes=new Uint8Array(posBuf.buffer)
    // El bufferView de POSITION arranca tras los índices: byteOffset debe ser múltiplo
    // de 4 (Float32). Uint32 * n siempre lo es, pero lo dejamos explícito por guarda.
    const posViewOffset=Math.ceil(idxBytes.length/4)*4
    const merged=new Uint8Array(posViewOffset+posBytes.length);merged.set(idxBytes,0);merged.set(posBytes,posViewOffset)
    const gltf={
      // ★ METADATA: glTF asume METROS. Orbin emite MILÍMETROS. Sin declararlo, el
      //   importador de Blender/Unreal escala x1000. Se documenta en asset.extras y
      //   se deja la conversión al consumidor (cambiar la escala aquí rompería el
      //   visor AR y los consumidores actuales — decisión de producto, no de export).
      asset:{version:'2.0',generator:`${meta.generator} v2`,extras:{...meta,unitScaleToMeters:0.001}},
      scene:0,scenes:[{name:meta.project,nodes:sceneNodes}],nodes,meshes,
      buffers:[{byteLength:merged.length,uri:'data:application/octet-stream;base64,'+toB64(merged)}],
      bufferViews:[{buffer:0,byteOffset:0,byteLength:idxBytes.length,target:34963},{buffer:0,byteOffset:posViewOffset,byteLength:posBytes.length,target:34962}],
      accessors}
    return{blob:new Blob([JSON.stringify(gltf)],{type:this.mimeType}),filename:`orbin-3d-${Date.now()}.gltf`,metadata:{format:'glTF 2.0',vertices:pos.length/3,meshes:meshes.length,modules:modules.length,...meta}}
  }
}
// ── DXF: HEADER + TABLES (1 LAYER por módulo), alzado frontal por módulo en su capa ──
class DXFAdapter extends ExportAdapter{
  constructor(){super('DXF (AutoCAD)','.dxf','application/dxf')}
  async export(modules,options={}){
    // Cada PIEZA visible en su propia capa: M{n}-{TIPO}-{k}. El prefijo de módulo
    // (M1*) y de tipo (M1-LAT*) agrupan como subcapas en el Layer Manager de AutoCAD,
    // permitiendo aislar/congelar/editar cualquier pieza por separado. Color por tipo.
    //
    // ★ 2026-07-26 (auditoría CAD) — CONTRATO DE 3 CAPAS LÓGICAS:
    //   1. GEOMETRÍA  → M{n}-{TIPO}-{k}   (una capa por pieza, color por tipo)
    //   2. COTAS      → M{n}-COTAS        (SOLO líneas y textos de dimensión)
    //   3. CAJETÍN    → ORBIN-TITULO      (rótulo/identificación, capa única)
    //   Antes el rótulo del módulo se escribía DENTRO de la capa de cotas: al
    //   congelar cotas para acotar a mano desaparecía también la identificación
    //   de la pieza. Ahora las tres familias se aíslan por separado.
    const counters={}, pieceLayers=[], modLayers=[]
    const meta=exportMeta(modules,options)
    let entities='', xOff=0
    const ext={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity}
    const track=(x,y)=>{if(x<ext.minX)ext.minX=x;if(x>ext.maxX)ext.maxX=x;if(y<ext.minY)ext.minY=y;if(y>ext.maxY)ext.maxY=y}
    modules.forEach((mod,i)=>{const cfg=mod.configuration||{}
      const cotasLayer=`M${i+1}-COTAS`; modLayers.push({name:cotasLayer,aci:8})
      const boxes=moduleBoxes(mod,this.extractPieces([mod])).filter(b=>!HIDDEN_ELEV.has(b.type))
      // ★ GUARDA DE SOLAPE: el avance en X se calculaba con cfg.width (dato de UI),
      //   pero la geometría viene de pieces[] (dato del motor). Si divergen — tampos,
      //   tamponados o laterales que sobresalen — los módulos se pisaban en el DXF.
      //   Ahora el ancho ocupado se mide sobre la geometría REALMENTE dibujada.
      let mMinX=Infinity,mMaxX=-Infinity,mMinY=Infinity,mMaxY=-Infinity
      for(const b of boxes){mMinX=Math.min(mMinX,b.cx-b.dx/2);mMaxX=Math.max(mMaxX,b.cx+b.dx/2);mMinY=Math.min(mMinY,b.cy-b.dy/2);mMaxY=Math.max(mMaxY,b.cy+b.dy/2)}
      if(!isFinite(mMinX)){mMinX=0;mMaxX=cfg.width||600;mMinY=0;mMaxY=cfg.height||720}
      const ox=xOff-mMinX   // normaliza el módulo al origen de su franja
      // ── 1. GEOMETRÍA ──
      for(const b of boxes){
        const ln=pieceLayer(i,b,counters); pieceLayers.push({name:ln,aci:aciOf(b.type)})
        const x0=ox+b.cx-b.dx/2,x1=ox+b.cx+b.dx/2,y0=b.cy-b.dy/2,y1=b.cy+b.dy/2
        entities+=L(ln,x0,y0,x1,y0)+L(ln,x1,y0,x1,y1)+L(ln,x1,y1,x0,y1)+L(ln,x0,y1,x0,y0)
        track(x0,y0);track(x1,y1)}
      // ── 2. COTAS (líneas de cota reales, no solo etiqueta de texto) ──
      const gx0=ox+mMinX,gx1=ox+mMaxX,W=mMaxX-mMinX,H=mMaxY-mMinY
      const dy=mMinY-90, tick=25
      entities+=L(cotasLayer,gx0,dy,gx1,dy)+L(cotasLayer,gx0,dy-tick,gx0,dy+tick)+L(cotasLayer,gx1,dy-tick,gx1,dy+tick)
      entities+=TXT(cotasLayer,(gx0+gx1)/2-40,dy+12,String(Math.round(W)),40)
      const dxv=gx0-90
      entities+=L(cotasLayer,dxv,mMinY,dxv,mMaxY)+L(cotasLayer,dxv-tick,mMinY,dxv+tick,mMinY)+L(cotasLayer,dxv-tick,mMaxY,dxv+tick,mMaxY)
      entities+=TXT(cotasLayer,dxv-70,(mMinY+mMaxY)/2,String(Math.round(H)),40)
      track(dxv-70,dy-tick)
      // ── 3. CAJETÍN / rótulo ──
      entities+=TXT(TITLE_LAYER,gx0,mMaxY+60,`${safeId(mod.id,i)}  ${Math.round(W)}x${Math.round(H)}x${cfg.depth||''} mm`,50)
      track(gx1,mMaxY+110)
      xOff+=W+300})
    if(!isFinite(ext.minX)){ext.minX=0;ext.minY=0;ext.maxX=0;ext.maxY=0}
    // Bloque de cajetín del proyecto (procedencia) — capa propia, esquina inferior izq.
    entities+=TXT(TITLE_LAYER,ext.minX,ext.minY-260,`${meta.project} · ${meta.company||meta.generator} · ${meta.date.slice(0,10)} · ${meta.units}`,45)
    ext.minY-=300
    const allLayers=[...modLayers,{name:TITLE_LAYER,aci:7},...pieceLayers]
    // ★ $EXTMIN/$EXTMAX: sin ellos AutoCAD/LibreCAD abren el archivo con ZOOM
    //   EXTENTS indefinido y el operario ve una hoja vacía hasta que hace zoom a mano.
    let dxf='0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n'
    dxf+=`9\n$EXTMIN\n10\n${ext.minX}\n20\n${ext.minY}\n30\n0\n9\n$EXTMAX\n10\n${ext.maxX}\n20\n${ext.maxY}\n30\n0\n`
    dxf+='9\n$LTSCALE\n40\n1\n9\n$DIMSCALE\n40\n1\n0\nENDSEC\n'
    dxf+='0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n'+(allLayers.length+1)+'\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n'
    allLayers.forEach(l=>dxf+=`0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.aci}\n6\nCONTINUOUS\n`)
    dxf+='0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n'+entities+'0\nENDSEC\n0\nEOF\n'
    return{blob:new Blob([dxf],{type:this.mimeType}),filename:`orbin-cad-${Date.now()}.dxf`,metadata:{format:'DXF R12',layers:allLayers.length,pieces:pieceLayers.length,titleLayer:TITLE_LAYER,dimLayers:modLayers.length,...meta}}
  }
}
const TITLE_LAYER='ORBIN-TITULO'   // capa única de cajetín/rótulo (ver contrato de 3 capas)
const L=(l,x1,y1,x2,y2)=>`0\nLINE\n8\n${l}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`
const TXT=(l,x,y,t,h)=>`0\nTEXT\n8\n${l}\n10\n${x}\n20\n${y}\n30\n0\n40\n${h}\n1\n${t}\n`

// ── CNC (preservado) ──
class CNCAdapter extends ExportAdapter{
  constructor(){super('CNC','.cnc','text/plain')}
  async export(modules,options={}){
    const pieces=this.extractPieces(modules);const feed=options.feedRate||6000,safeZ=options.safeZ||5,cut=options.cutDepth||-20
    const meta=exportMeta(modules,options)
    let g=`; Orbin CNC\n; project: ${meta.project}\n; company: ${meta.company||meta.generator}\n; date: ${meta.date}\n; units: mm (G21) · sheet: ${SHEET_WIDTH}x${SHEET_HEIGHT} · kerf: ${SAW_KERF}\nG21\nG90\n`;let x=EDGE_MARGIN,y=EDGE_MARGIN,rowH=0,sheet=1
    pieces.forEach((p,i)=>{const w=p.w+SAW_KERF,h=p.h+SAW_KERF;if(x+w>SHEET_WIDTH-EDGE_MARGIN){x=EDGE_MARGIN;y+=rowH+SAW_KERF;rowH=0}if(y+h>SHEET_HEIGHT-EDGE_MARGIN){sheet++;x=EDGE_MARGIN;y=EDGE_MARGIN;rowH=0;g+=`\n; SHEET ${sheet}\n`}
      g+=`\n; ${p.name} (${p.w}x${p.h})\nG0 Z${safeZ}\nG0 X${x} Y${y}\nG1 Z${cut} F${feed/2}\nG1 X${x+p.w} Y${y} F${feed}\nG1 X${x+p.w} Y${y+p.h}\nG1 X${x} Y${y+p.h}\nG1 X${x} Y${y}\nG0 Z${safeZ}\n`;x+=w;rowH=Math.max(rowH,h)})
    g+='\nG0 Z10\nM5\nM30\n';return{blob:new Blob([g],{type:this.mimeType}),filename:`orbin-cnc-${Date.now()}.cnc`,metadata:{pieceCount:pieces.length,sheetCount:sheet,format:'G-code'}}
  }
}
class CSVAdapter extends ExportAdapter{
  constructor(){super('Factory CSV','.csv','text/csv')}
  async export(modules,options={}){return generateFactoryCutlist(this.extractPieces(modules),options)}
}

// nesting (preservado, idéntico)
export function nestPieces(pieces,options={}){
  const sheetW=options.sheetWidth||SHEET_WIDTH,sheetH=options.sheetHeight||SHEET_HEIGHT,kerf=options.kerf||SAW_KERF,margin=options.margin||EDGE_MARGIN
  const usableW=sheetW-2*margin,usableH=sheetH-2*margin,sorted=[...pieces].sort((a,b)=>b.h-a.h),sheets=[]
  let cur={id:1,rows:[{y:0,h:0,x:0}],placements:[]};sheets.push(cur)
  sorted.forEach(p=>{const pw=p.w+kerf,ph=p.h+kerf;let placed=false
    for(const r of cur.rows){if(r.x+pw<=usableW&&r.h>=ph){cur.placements.push({...p,sheetId:cur.id,x:margin+r.x,y:margin+r.y});r.x+=pw;placed=true;break}}
    if(!placed){const last=cur.rows[cur.rows.length-1],ny=last.y+last.h+kerf;if(ny+ph<=usableH){cur.rows.push({y:ny,h:ph,x:pw});cur.placements.push({...p,sheetId:cur.id,x:margin,y:margin+ny});placed=true}}
    if(!placed){cur={id:sheets.length+1,rows:[{y:0,h:ph,x:pw}],placements:[{...p,sheetId:sheets.length+1,x:margin,y:margin}]};sheets.push(cur)}})
  const tA=sheets.length*sheetW*sheetH,pA=pieces.reduce((s,p)=>s+p.w*p.h,0),waste=((tA-pA)/tA*100).toFixed(1)
  return{sheets,stats:{sheetCount:sheets.length,totalPieces:pieces.length,wastePercent:parseFloat(waste),utilization:(100-parseFloat(waste)).toFixed(1)}}
}

const adapters={dxf:new DXFAdapter(),dae:new DAEAdapter(),obj:new OBJAdapter(),gltf:new GLTFAdapter(),cnc:new CNCAdapter(),csv:new CSVAdapter()}
const ALIAS={skp:'dae'} // SketchUp → COLLADA

export async function exportDesign(format,modules,options={}){
  const key=ALIAS[format]||format;const adapter=adapters[key]
  if(!adapter)throw new Error(`Unknown export format: ${format}. Available: ${Object.keys(adapters).concat(Object.keys(ALIAS)).join(', ')}`)
  const v=adapter.validate(modules);if(!v.valid)throw new Error(`Export validation failed: ${v.errors.join('; ')}`)
  return adapter.export(modules,options)
}
export function getExportFormats(){return Object.entries(adapters).map(([id,a])=>({id,name:a.name,extension:a.extension,mimeType:a.mimeType})).concat([{id:'skp',name:'SketchUp',extension:'.dae',mimeType:'model/vnd.collada+xml'}])}
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)}
export {ExportAdapter,DXFAdapter,DAEAdapter,OBJAdapter,GLTFAdapter,CNCAdapter,CSVAdapter}
export default exportDesign
