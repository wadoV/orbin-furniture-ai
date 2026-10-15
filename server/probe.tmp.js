const { generateFurniture } = require('./src/engine/closetEngine.js')
const cfg = { moduleType:'standard', width:900, height:2400, depth:600, thickness:18, backThickness:6, numShelves:0, numDrawers:4, numDividers:0, hasDoors:true, numDoors:2, doorType:'hinged', baseboard:true, baseboardHeight:100, drawerLayout:'vertical', drawerHeight:180 }
const r = generateFurniture(cfg)
const ps = r.pieces || r.cutList || []
console.log(Object.keys(r))
for (const p of ps) console.log(p.name, '|', p.width, 'x', p.height, 'x', p.depth ?? '', '|', p.length ?? '', p.position ? JSON.stringify(p.position) : '')
