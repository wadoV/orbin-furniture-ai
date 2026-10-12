/**
 * Orbin AI — Kitchen Prompt System E2E Test
 * Valida cada prompt de la demo de cocina a través del pipeline completo:
 *   parseNaturalLanguage → coerceEngineParams → generateFurniture
 *
 * Run: node --test server/tests/kitchen_prompts.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const { parseNaturalLanguage } = require(path.join(ROOT, 'engine/nlParser'));
const { coerceEngineParams }   = require(path.join(ROOT, 'ai/paramContract'));
const { generateFurniture }    = require(path.join(ROOT, 'engine/closetEngine'));

function pipeline(prompt) {
  const parsed = parseNaturalLanguage(prompt);
  const { params, specAdjustments, dropped } = coerceEngineParams(parsed.params || parsed);
  const result = generateFurniture(params);
  return { params, pieces: result.pieces || [], result };
}

// ═══════════════════════════════════════════════════════════════════════
// BASE MODULES
// ═══════════════════════════════════════════════════════════════════════

describe('Kitchen Base Modules', () => {
  it('B1: Base estándar 800mm con 2 puertas y 1 repisa', () => {
    const { params, pieces } = pipeline(
      'crea un mueble base de cocina de 800x850x580mm con 2 puertas batientes y una repisa interna'
    );
    assert.equal(params.width, 800);
    assert.equal(params.height, 850);
    assert.equal(params.depth, 580);
    assert.equal(params.moduleType, 'base');
    assert.equal(params.numDoors, 2);
    assert.equal(params.numShelves, 1);

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 2, `Expected 2 doors, got ${doors.length}`);

    const shelves = pieces.filter(p => p.type === 'repisa' || /PRAT/i.test(p.id));
    assert(shelves.length >= 1, `Expected ≥1 shelf, got ${shelves.length}`);

    assert(pieces.length >= 8, `Expected ≥8 pieces, got ${pieces.length}`);
  });

  it('B2: Fregadero/pia 1200mm', () => {
    const { params, pieces } = pipeline(
      'crea un modulo pia de cocina de 1200x850x580mm con 2 puertas batientes, sin repisa'
    );
    assert.equal(params.width, 1200);
    assert.equal(params.height, 850);
    assert.equal(params.moduleType, 'base');
    assert.equal(params.numDoors, 2);

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 2);
  });

  it('B3: Módulo horno con puerta falsa', () => {
    const { params, pieces } = pipeline(
      'crea un modulo para horno de 640x850x580mm con una puerta falsa y una repisa interna'
    );
    assert.equal(params.width, 640);
    assert.equal(params.height, 850);
    assert.equal(params.moduleType, 'base');

    const portaFalsa = pieces.find(p => p.type === 'false_door' || /PORTA.*FALSA/i.test(p.id));
    assert(portaFalsa, 'Expected false_door piece');

    const shelf = pieces.find(p => p.type === 'repisa' || /PRAT/i.test(p.id));
    assert(shelf, 'Expected shelf piece');

    const normalDoors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(normalDoors.length, 0, 'Should have no standard doors');
  });

  it('B4: Cajonera 4 gavetas cava 45°', () => {
    const { params, pieces } = pipeline(
      'crea un modulo base cajonera de 500x850x580mm con 4 gavetas con cava 45 grados'
    );
    assert.equal(params.width, 500);
    assert.equal(params.height, 850);
    assert.equal(params.moduleType, 'base');
    assert.equal(params.numDrawers, 4);
    assert.equal(params.puxadorCava45, true);

    const drawerFronts = pieces.filter(p => p.type === 'drawer_front');
    assert.equal(drawerFronts.length, 4, `Expected 4 drawer fronts, got ${drawerFronts.length}`);
  });

  it('B5: Base estrecho 300mm con 2 repisas', () => {
    const { params, pieces } = pipeline(
      'crea un modulo base de cocina de 300x850x580mm con 2 repisas internas y 1 puerta'
    );
    assert.equal(params.width, 300);
    assert.equal(params.height, 850);
    assert.equal(params.moduleType, 'base');
    assert.equal(params.numDoors, 1);
    assert.equal(params.numShelves, 2);

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 1);

    const shelves = pieces.filter(p => p.type === 'repisa' || /PRAT/i.test(p.id));
    assert(shelves.length >= 2, `Expected ≥2 shelves, got ${shelves.length}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AÉREO MODULES
// ═══════════════════════════════════════════════════════════════════════

describe('Kitchen Aéreo Modules', () => {
  it('A1: Aéreo estándar 800mm con 2 puertas', () => {
    const { params, pieces } = pipeline(
      'crea un mueble aereo de 800x700x350mm con 2 puertas batientes y 2 repisas'
    );
    assert.equal(params.width, 800);
    assert.equal(params.height, 700);
    assert.equal(params.depth, 350);
    assert.equal(params.moduleType, 'aereo');
    assert.equal(params.numDoors, 2);
    assert.equal(params.numShelves, 2);

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 2);

    const shelves = pieces.filter(p => p.type === 'repisa' || /PRAT/i.test(p.id));
    assert(shelves.length >= 2);
  });

  it('A2: Aéreo cava 45° + tamponado inferior', () => {
    const { params, pieces } = pipeline(
      'crea un mueble aereo de 800x700x350mm con 2 puertas cavas45 grados y tamponado abajo, 1 repisa'
    );
    assert.equal(params.width, 800);
    assert.equal(params.height, 700);
    assert.equal(params.moduleType, 'aereo');
    assert(params.puxadorCavaAereo === true || params.puxadorCava45 === true, 'Expected cava param');
    assert.equal(params.tamponadoInferior, true);

    const tampon = pieces.find(p => p.type === 'tampon_bottom' || /TAMPON/i.test(p.id));
    assert(tampon, 'Expected tamponado inferior piece');

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 2);
  });

  it('A3: Nicho abierto microondas', () => {
    const { params, pieces } = pipeline(
      'nicho abierto aereo de 600x400x350mm sin puertas'
    );
    assert.equal(params.width, 600);
    assert.equal(params.height, 400);
    assert.equal(params.depth, 350);
    assert.equal(params.moduleType, 'aereo');
    assert.equal(params.hasDoors, false);

    const doors = pieces.filter(p => p.type === 'standard_door' || p.type === 'door');
    assert.equal(doors.length, 0, 'Should have no doors');
  });

  it('A4: Aéreo estrecho 400mm', () => {
    const { params, pieces } = pipeline(
      'crea un mueble aereo de 400x700x350mm con 1 puerta y 2 repisas'
    );
    assert.equal(params.width, 400);
    assert.equal(params.height, 700);
    assert.equal(params.moduleType, 'aereo');
    assert.equal(params.numDoors, 1);
    assert.equal(params.numShelves, 2);
  });

  it('A5: Aéreo grande 1200mm (sobre fregadero)', () => {
    const { params, pieces } = pipeline(
      'crea un mueble aereo de 1200x700x350mm con 2 puertas batientes y 2 repisas'
    );
    assert.equal(params.width, 1200);
    assert.equal(params.height, 700);
    assert.equal(params.moduleType, 'aereo');
    assert.equal(params.numDoors, 2);
    assert.equal(params.numShelves, 2);

    const doors = pieces.filter(p => p.type === 'standard_door');
    assert.equal(doors.length, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITION VALIDATION
// ═══════════════════════════════════════════════════════════════════════

describe('Kitchen Composition: Aéreos above Base', () => {
  it('All base modules are moduleType=base', () => {
    const basePrompts = [
      'crea un mueble base de cocina de 800x850x580mm con 2 puertas batientes y una repisa interna',
      'crea un modulo pia de cocina de 1200x850x580mm con 2 puertas batientes, sin repisa',
      'crea un modulo para horno de 640x850x580mm con una puerta falsa y una repisa interna',
      'crea un modulo base cajonera de 500x850x580mm con 4 gavetas con cava 45 grados',
      'crea un modulo base de cocina de 300x850x580mm con 2 repisas internas y 1 puerta',
    ];
    for (const p of basePrompts) {
      const { params } = pipeline(p);
      assert.equal(params.moduleType, 'base', `"${p.substring(0, 40)}..." should be base`);
    }
  });

  it('All aéreo modules are moduleType=aereo', () => {
    const aereoPrompts = [
      'crea un mueble aereo de 800x700x350mm con 2 puertas batientes y 2 repisas',
      'crea un mueble aereo de 800x700x350mm con 2 puertas cavas45 grados y tamponado abajo, 1 repisa',
      'nicho abierto aereo de 600x400x350mm sin puertas',
      'crea un mueble aereo de 400x700x350mm con 1 puerta y 2 repisas',
      'crea un mueble aereo de 1200x700x350mm con 2 puertas batientes y 2 repisas',
    ];
    for (const p of aereoPrompts) {
      const { params } = pipeline(p);
      assert.equal(params.moduleType, 'aereo', `"${p.substring(0, 40)}..." should be aereo`);
    }
  });

  it('No piece exceeds MDF plate max (2750×1840mm)', () => {
    const allPrompts = [
      'crea un mueble base de cocina de 800x850x580mm con 2 puertas batientes y una repisa interna',
      'crea un modulo pia de cocina de 1200x850x580mm con 2 puertas batientes, sin repisa',
      'crea un mueble aereo de 1200x700x350mm con 2 puertas batientes y 2 repisas',
    ];
    for (const p of allPrompts) {
      const { pieces } = pipeline(p);
      for (const piece of pieces) {
        assert(piece.width <= 2750, `${piece.id} width ${piece.width} > 2750`);
        assert(piece.height <= 1840, `${piece.id} height ${piece.height} > 1840`);
      }
    }
  });
});
