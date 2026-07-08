#!/usr/bin/env node
/**
 * Orbin — Verificador de integridad (BLINDAJE).
 * Falla (exit 1) si detecta: bytes nulos (corrupción del mount), errores de sintaxis,
 * o un router de /routes sin `module.exports` (el bug que dejó billing en 404).
 * Correr en CI y en pre-commit. NO modifica nada; solo verifica.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.argv[2] || process.cwd();
let errors = [];

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

// 1) Bytes nulos en cualquier fuente (corrupción)
const srcFiles = walk(path.join(ROOT, 'server', 'src'), ['.js'])
  .concat(walk(path.join(ROOT, 'client', 'src'), ['.js', '.jsx', '.css']));
for (const f of srcFiles) {
  const buf = fs.readFileSync(f);
  if (buf.includes(0)) errors.push(`NULL BYTES (corrupción): ${path.relative(ROOT, f)}`);
}

// 2) Sintaxis válida en todo el servidor
for (const f of walk(path.join(ROOT, 'server', 'src'), ['.js'])) {
  try { execSync(`node --check "${f}"`, { stdio: 'pipe' }); }
  catch (e) { errors.push(`SINTAXIS: ${path.relative(ROOT, f)} → ${String(e.stderr || e).split('\n')[0]}`); }
}

// 3) Cada router montado debe exportar (evita el bug de billing: router vacío → 404)
const routesDir = path.join(ROOT, 'server', 'src', 'routes');
for (const f of walk(routesDir, ['.js'])) {
  const txt = fs.readFileSync(f, 'utf8');
  if (!/module\.exports\s*=/.test(txt) && !/export\s+default/.test(txt))
    errors.push(`ROUTER SIN EXPORT (se montaría vacío → 404): ${path.relative(ROOT, f)}`);
}

if (errors.length) {
  console.error('\n❌ BLINDAJE FALLÓ — ' + errors.length + ' problema(s):');
  errors.forEach(e => console.error('   • ' + e));
  console.error('\nNo commitear/desplegar hasta resolver.\n');
  process.exit(1);
}
console.log('✅ BLINDAJE OK — sin nulls, sintaxis válida, todos los routers exportan.');
