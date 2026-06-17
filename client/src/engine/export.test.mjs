import assert from 'node:assert';
import test from 'node:test';
import { exportDesign } from './exportAdapters.js';

const mockModules = [
  {
    id: 'MOD-01',
    configuration: {
      width: 600,
      height: 720,
      depth: 580,
      thickness: 18,
      backThickness: 6,
      shelfCount: 2,
      drawerCount: 1,
      drawerHeight: 150,
      doorCount: 1
    },
    pieces: []
  }
];

test('Export DXF format', async () => {
  const result = await exportDesign('dxf', mockModules);
  assert.ok(result.blob, 'dxf blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.includes('TABLES'), 'dxf missing TABLES section');
  assert.ok(text.includes('$ACADVER'), 'dxf missing $ACADVER');
  assert.ok(text.includes('SECTION'), 'dxf missing SECTION');
});

test('Export DAE/SKP format', async () => {
  const result = await exportDesign('dae', mockModules);
  assert.ok(result.blob, 'dae blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.includes('<node'), 'dae missing <node tag');
  assert.ok(text.includes('<COLLADA'), 'dae missing <COLLADA tag');
});

test('Export OBJ format', async () => {
  const result = await exportDesign('obj', mockModules);
  assert.ok(result.blob, 'obj blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.includes('v '), 'obj missing vertices (v )');
  assert.ok(text.includes('f '), 'obj missing faces (f )');
});

test('Export GLTF format', async () => {
  const result = await exportDesign('gltf', mockModules);
  assert.ok(result.blob, 'gltf blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.includes('asset'), 'gltf missing asset field');
  assert.ok(text.includes('scenes'), 'gltf missing scenes field');
});

test('Export CNC format', async () => {
  const result = await exportDesign('cnc', mockModules);
  assert.ok(result.blob, 'cnc blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.includes('G21'), 'cnc missing G21 metric mode');
  assert.ok(text.includes('G90'), 'cnc missing G90 absolute mode');
});

test('Export CSV format', async () => {
  const result = await exportDesign('csv', mockModules);
  assert.ok(result.blob, 'csv blob is not defined');
  const text = await result.blob.text();
  assert.ok(text.length > 0, 'csv content is empty');
});
