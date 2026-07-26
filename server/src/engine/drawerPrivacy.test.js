/**
 * Orbin AI — Travesaño de cierre + auto-fit de gavetas (ADITIVO 2026-07-23).
 * Regla: travesaño de cierre estándar 50mm PEGADO al tampo (ampliable vía
 * drawerRailHeight), y las gavetas del pedestal se auto-ajustan para llenar el
 * resto sin hueco. drawerPrivacyPanel:false lo desactiva.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')

const rail  = (d) => d.pieces.find(p => /travesa/i.test(p.name || ''))
const fronts = (d) => d.pieces.filter(p => p.type === 'drawer_front')

describe('Travesaño de cierre + auto-fit (desk)', () => {
  it('default: travesaño de 50mm pegado al tampo', () => {
    const d = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3 })
    const r = rail(d)
    const tampoY = 750 - 18 // latH = H - T (cara inferior del tampo)
    assert.ok(r, 'debe existir el travesaño')
    assert.equal(r.height, 50, 'estándar 50mm')
    assert.ok(Math.abs((r.y + r.height / 2) - tampoY) < 1, 'pegado al tampo')
    assert.ok(d.specAdjustments.some(a => a.code === 'DRAWER_PRIVACY_PANEL'))
  })

  it('gavetas se auto-ajustan para llenar el pedestal (todas iguales, sin hueco grande)', () => {
    const d = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3 })
    const f = fronts(d)
    assert.equal(f.length, 3)
    const h0 = f[0].height
    assert.ok(f.every(x => Math.abs(x.height - h0) < 1), 'gavetas de igual alto')
    assert.ok(h0 > 150, 'las gavetas se estiraron (no quedaron chicas con hueco)')
  })

  it('travesaño ampliable: drawerRailHeight 100 → 100mm y gavetas más chicas', () => {
    const d50  = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3 })
    const d100 = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3, drawerRailHeight: 100 })
    assert.equal(rail(d100).height, 100)
    assert.ok(fronts(d100)[0].height < fronts(d50)[0].height, 'gavetas se achican con travesaño mayor')
  })

  it('nunca menor a 50mm aunque pidan menos', () => {
    const d = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3, drawerRailHeight: 20 })
    assert.equal(rail(d).height, 50)
  })

  it('drawerPrivacyPanel:false → sin travesaño', () => {
    const d = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3, drawerPrivacyPanel: false })
    assert.equal(rail(d), undefined)
    assert.ok(!d.specAdjustments.some(a => a.code === 'DRAWER_PRIVACY_PANEL'))
  })

  it('no afecta otros tipos (closet)', () => {
    const d = generateProject({ moduleType: 'standard', width: 900, height: 2000, depth: 580, numDrawers: 2 })
    assert.equal(d.success, true)
    assert.equal(rail(d), undefined)
  })
})

describe('Validación del escritorio (Galería)', () => {
  it('desk con gavetas + travesaño NO da falso RECHAZADO (era el bug que bloqueaba la Galería)', () => {
    const d = generateProject({ moduleType: 'desk', width: 1400, height: 750, depth: 600, numDrawers: 3 })
    const v = validateDesign(d)
    assert.equal(v.status, 'VALIDADO', 'el escritorio auto-fit debe validar: ' + JSON.stringify(v.errors))
  })

  it('el guard de pila vertical sigue activo para armarios (no se rompió)', () => {
    // Se valida el design DIRECTAMENTE (el motor auto-ajusta y no llegaría acá).
    // Closet con 20 cajones de 200mm → la pila excede la altura → RECHAZADO.
    const fake = {
      configuration: {
        moduleType: 'standard', width: 800, height: 2000, depth: 580,
        thickness: 18, backThickness: 6, numDrawers: 20, drawerHeight: 200,
        numShelves: 0, numDividers: 0, baseboard: true, baseboardHeight: 100,
      },
      pieces: [{ name: 'Lateral', type: 'lateral', width: 580, height: 1964, x: 0, y: 982 }],
      nesting: [],
    }
    const v = validateDesign(fake)
    assert.equal(v.status, 'RECHAZADO', 'la regla de pila debe seguir rechazando armarios imposibles')
  })
})
