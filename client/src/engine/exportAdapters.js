/**
 * Orbin AI — Advanced Export Adapter Architecture v2.0
 * ★ PROTECTED: exportadores con CAPAS POR MÓDULO (DXF layers, OBJ groups, DAE nodes).
 * Geometría real derivada de pieces[] (posiciones del motor) con fallback a configuration.
 * Formatos: DXF (AutoCAD), DAE/COLLADA + OBJ + GLTF (SketchUp/Blender/3D), CNC (G-code), CSV.
 */
import { generateFactoryCutlist } from './CutlistGenerator.js'

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

// 8 vértices / 6 quads de una caja
function boxVerts(b){const x0=b.cx-b.dx/2,x1=b.cx+b.dx/2,y0=b.cy-b.dy/2,y1=b.cy+b.dy/2,z0=b.cz-b.dz/2,z1=b.cz+b.dz/2;return [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]}
const QUADS=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]]

// ── OBJ (grupos por módulo) ──
class OBJAdapter extends ExportAdapter{
  constructor(){super('OBJ (3D)','.obj','text/plain')}
  async export(modules){
    let obj='# Orbin AI — OBJ (un objeto por PIEZA, editable por separado)\n',vb=0
    modules.forEach((mod,i)=>{const id=safeId(mod.id,i);let pn=0
      for(const b of moduleBoxes(mod,this.extractPieces([mod]))){pn++
        obj+=`\no ${id}__${safeId(b.name,0).slice(0,28)}_${pn}\ng ${id}\n`
        for(const v of boxVerts(b))obj+=`v ${v[0]} ${v[1]} ${v[2]}\n`
        for(const f of QUADS)obj+=`f ${f.map(k=>k+1+vb).join(' ')}\n`;vb+=8}})
    return{blob:new Blob([obj],{type:this.mimeType}),filename:`orbin-3d-${Date.now()}.obj`,metadata:{format:'OBJ',modules:modules.length}}
  }
}
// ── COLLADA .dae (nodo por módulo = grupo en SketchUp) ──
class DAEAdapter extends ExportAdapter{
  constructor(){super('SketchUp (COLLADA)','.dae','model/vnd.collada+xml')}
  async export(modules){
    const geos=[],nodes=[]
    modules.forEach((mod,i)=>{const modId=safeId(mod.id,i);const children=[];let pn=0
      for(const b of moduleBoxes(mod,this.extractPieces([mod]))){pn++
        const pid=`${modId}_p${pn}_${safeId(b.name,0).slice(0,24)}`
        const verts=[];boxVerts(b).forEach(v=>verts.push(v[0],v[1],v[2]))
        const faces=[];for(const f of QUADS){faces.push(f[0],f[1],f[2],f[0],f[2],f[3])}
        geos.push(`<geometry id="geo_${pid}" name="${pid}"><mesh><source id="pos_${pid}"><float_array id="posA_${pid}" count="${verts.length}">${verts.join(' ')}</float_array><technique_common><accessor source="#posA_${pid}" count="${verts.length/3}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="vtx_${pid}"><input semantic="POSITION" source="#pos_${pid}"/></vertices><triangles count="${faces.length/3}"><input semantic="VERTEX" source="#vtx_${pid}" offset="0"/><p>${faces.join(' ')}</p></triangles></mesh></geometry>`)
        children.push(`<node id="${pid}" name="${(b.name||pid).replace(/[<>&\"]/g,'_')}"><instance_geometry url="#geo_${pid}"/></node>`)}
      nodes.push(`<node id="${modId}" name="${modId}">${children.join('')}</node>`)})
    const dae=`<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><up_axis>Y_UP</up_axis><unit name="millimeter" meter="0.001"/></asset><library_geometries>${geos.join('')}</library_geometries><library_visual_scenes><visual_scene id="Scene" name="Orbin">${nodes.join('')}</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>`
    return{blob:new Blob([dae],{type:this.mimeType}),filename:`orbin-sketchup-${Date.now()}.dae`,metadata:{format:'COLLADA 1.4.1',modules:modules.length,pieces:geos.length}}
  }
}
// ── GLTF real (geometría) ──
class GLTFAdapter extends ExportAdapter{
  constructor(){super('GLTF (3D)','.gltf','model/gltf+json')}
  async export(modules){
    const pos=[],idx=[];let vb=0
    modules.forEach((mod)=>{for(const b of moduleBoxes(mod,this.extractPieces([mod]))){boxVerts(b).forEach(v=>pos.push(v[0],v[1],v[2]));for(const f of QUADS){idx.push(f[0]+vb,f[1]+vb,f[2]+vb,f[0]+vb,f[2]+vb,f[3]+vb)}vb+=8}})
    const posBuf=new Float32Array(pos),idxBuf=new Uint32Array(idx)
    const toB64=(u8)=>{if(typeof Buffer!=='undefined')return Buffer.from(u8.buffer,u8.byteOffset,u8.byteLength).toString('base64');let str='';for(let i=0;i<u8.length;i++)str+=String.fromCharCode(u8[i]);return btoa(str)}
    const idxBytes=new Uint8Array(idxBuf.buffer),posBytes=new Uint8Array(posBuf.buffer)
    const merged=new Uint8Array(idxBytes.length+posBytes.length);merged.set(idxBytes,0);merged.set(posBytes,idxBytes.length)
    let min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];for(let i=0;i<pos.length;i+=3){for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i+k]);max[k]=Math.max(max[k],pos[i+k])}}
    const gltf={asset:{version:'2.0',generator:'Orbin AI v2'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:1},indices:0,mode:4}]}],
      buffers:[{byteLength:merged.length,uri:'data:application/octet-stream;base64,'+toB64(merged)}],
      bufferViews:[{buffer:0,byteOffset:0,byteLength:idxBytes.length,target:34963},{buffer:0,byteOffset:idxBytes.length,byteLength:posBytes.length,target:34962}],
      accessors:[{bufferView:0,componentType:5125,count:idx.length,type:'SCALAR'},{bufferView:1,componentType:5126,count:pos.length/3,type:'VEC3',min,max}]}
    return{blob:new Blob([JSON.stringify(gltf)],{type:this.mimeType}),filename:`orbin-3d-${Date.now()}.gltf`,metadata:{format:'glTF 2.0',vertices:pos.length/3}}
  }
}
// ── DXF: HEADER + TABLES (1 LAYER por módulo), alzado frontal por módulo en su capa ──
class DXFAdapter extends ExportAdapter{
  constructor(){super('DXF (AutoCAD)','.dxf','application/dxf')}
  async export(modules){
    // Cada PIEZA visible en su propia capa: M{n}-{TIPO}-{k}. El prefijo de módulo
    // (M1*) y de tipo (M1-LAT*) agrupan como subcapas en el Layer Manager de AutoCAD,
    // permitiendo aislar/congelar/editar cualquier pieza por separado. Color por tipo.
    const counters={}, pieceLayers=[], modLayers=[]
    let entities='', xOff=0
    modules.forEach((mod,i)=>{const cfg=mod.configuration||{}
      const cotasLayer=`M${i+1}-COTAS`; modLayers.push({name:cotasLayer,aci:8})
      for(const b of moduleBoxes(mod,this.extractPieces([mod])).filter(b=>!HIDDEN_ELEV.has(b.type))){
        const ln=pieceLayer(i,b,counters); pieceLayers.push({name:ln,aci:aciOf(b.type)})
        const x0=xOff+b.cx-b.dx/2,x1=xOff+b.cx+b.dx/2,y0=b.cy-b.dy/2,y1=b.cy+b.dy/2
        entities+=L(ln,x0,y0,x1,y0)+L(ln,x1,y0,x1,y1)+L(ln,x1,y1,x0,y1)+L(ln,x0,y1,x0,y0)}
      entities+=TXT(cotasLayer,xOff+(cfg.width||600)/2,-120,`${safeId(mod.id,i)} ${cfg.width||''}x${cfg.height||''}x${cfg.depth||''}`,50)
      xOff+=(cfg.width||600)+300})
    const allLayers=[...modLayers,...pieceLayers]
    let dxf='0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n'
    dxf+='0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n'+(allLayers.length+1)+'\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n'
    allLayers.forEach(l=>dxf+=`0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.aci}\n6\nCONTINUOUS\n`)
    dxf+='0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n'+entities+'0\nENDSEC\n0\nEOF\n'
    return{blob:new Blob([dxf],{type:this.mimeType}),filename:`orbin-cad-${Date.now()}.dxf`,metadata:{format:'DXF R12',layers:allLayers.length,pieces:pieceLayers.length}}
  }
}
const L=(l,x1,y1,x2,y2)=>`0\nLINE\n8\n${l}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`
const TXT=(l,x,y,t,h)=>`0\nTEXT\n8\n${l}\n10\n${x}\n20\n${y}\n30\n0\n40\n${h}\n1\n${t}\n`

// ── CNC (preservado) ──
class CNCAdapter extends ExportAdapter{
  constructor(){super('CNC','.cnc','text/plain')}
  async export(modules,options={}){
    const pieces=this.extractPieces(modules);const feed=options.feedRate||6000,safeZ=options.safeZ||5,cut=options.cutDepth||-20
    let g=`; Orbin CNC\nG21\nG90\n`;let x=EDGE_MARGIN,y=EDGE_MARGIN,rowH=0,sheet=1
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
