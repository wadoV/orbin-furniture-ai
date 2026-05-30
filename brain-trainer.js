/**
 * Orbin Brain Trainer — Adversarial QA Agent
 * Simulates a hostile QA tester against the Orbin IA parametric engine.
 * Runs directly against localhost:3003/api/v1/stress-test
 *
 * Usage: node brain-trainer.js
 */

const http = require('http')
const fs   = require('fs')

const SERVER = 'localhost'
const PORT   = 3003
const ENDPOINT = '/api/v1/stress-test'

// ─── Color output ─────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', white: '\x1b[37m',
}
const pass    = (s) => `${C.green}${C.bold}${s}${C.reset}`
const fail    = (s) => `${C.red}${C.bold}${s}${C.reset}`
const warn    = (s) => `${C.yellow}${s}${C.reset}`
const info    = (s) => `${C.cyan}${s}${C.reset}`
const section = (s) => `\n${C.magenta}${C.bold}${'═'.repeat(60)}${C.reset}\n${C.bold}${s}${C.reset}`

// ─── Adversarial test cases ───────────────────────────────────────────────────
const TESTS = [
  // ── Group 1: Extreme dimensions ──────────────────────────────────────────
  {
    id: 'BT01', group: 'Extreme Narrow',
    description: 'Closet 100mm ancho — imposible alojar 2 laterales de 18mm',
    params: { width: 100, height: 2400, depth: 600, thickness: 18 },
    bypass: true, expected: ['ENGINE_CRASH', 'STRUCTURAL_FAIL', 'ENGINE_FAIL'],
  },
  {
    id: 'BT02', group: 'Extreme Wide',
    description: 'Closet 8000mm ancho — excede cualquier chapa disponible',
    params: { width: 8000, height: 2400, depth: 600, thickness: 18, numShelves: 3 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'WARNINGS'],
  },
  {
    id: 'BT03', group: 'Extreme Tall',
    description: 'Closet 5000mm alto — excede doble altura de planta',
    params: { width: 800, height: 5000, depth: 600, thickness: 18 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'WARNINGS'],
  },
  {
    id: 'BT04', group: 'Nano Dimensions',
    description: 'Closet 50x50x50mm — dimensiones de juguete',
    params: { width: 50, height: 50, depth: 50, thickness: 18 },
    bypass: true, expected: ['ENGINE_CRASH', 'ENGINE_FAIL', 'STRUCTURAL_FAIL'],
  },

  // ── Group 2: Thickness stress ─────────────────────────────────────────────
  {
    id: 'BT05', group: 'Thickness = Width/2',
    description: 'Espesor exactamente la mitad del ancho — division por cero potencial',
    params: { width: 400, height: 2000, depth: 600, thickness: 200 },
    bypass: true, expected: ['ENGINE_CRASH', 'ENGINE_FAIL', 'STRUCTURAL_FAIL'],
  },
  {
    id: 'BT06', group: 'Thickness > Width/2',
    description: 'Espesor mayor que mitad del ancho — anchura interna negativa garantizada',
    params: { width: 300, height: 2000, depth: 600, thickness: 200 },
    bypass: true, expected: ['ENGINE_CRASH', 'ENGINE_FAIL'],
  },
  {
    id: 'BT07', group: 'Zero Thickness',
    description: 'Espesor 0mm — division por cero en calculos internos',
    params: { width: 800, height: 2400, depth: 600, thickness: 0 },
    bypass: true, expected: ['ENGINE_CRASH', 'ENGINE_FAIL', 'STRUCTURAL_FAIL'],
  },
  {
    id: 'BT08', group: 'Negative Thickness',
    description: 'Espesor negativo — geometria imposible',
    params: { width: 800, height: 2400, depth: 600, thickness: -18 },
    bypass: true, expected: ['ENGINE_CRASH', 'ENGINE_FAIL', 'STRUCTURAL_FAIL'],
  },
  {
    id: 'BT09', group: 'Very Thick Board',
    description: 'Espesor 100mm — tablero de concreto, no MDF',
    params: { width: 800, height: 2400, depth: 600, thickness: 100 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'WARNINGS', 'PASS'],
  },

  // ── Group 3: Drawer stress ────────────────────────────────────────────────
  {
    id: 'BT10', group: 'Max Drawers Narrow',
    description: '20 cajones en closet de 400mm ancho',
    params: { width: 400, height: 2400, depth: 600, numDrawers: 20, drawerHeight: 100 },
    bypass: false, expected: ['STRUCTURAL_FAIL', 'ENGINE_CRASH'],
  },
  {
    id: 'BT11', group: 'Drawer Taller Than Cabinet',
    description: 'Cajon de 3000mm en closet de 2400mm — imposible fisicamente',
    params: { width: 800, height: 2400, depth: 600, numDrawers: 1, drawerHeight: 3000 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'ENGINE_CRASH'],
  },
  {
    id: 'BT12', group: 'Min Drawer Height',
    description: 'Cajon de 5mm — por debajo del minimo (80mm)',
    params: { width: 800, height: 2400, depth: 600, numDrawers: 1, drawerHeight: 5 },
    bypass: false, expected: ['STRUCTURAL_FAIL'],
  },
  {
    id: 'BT13', group: 'Zero Drawer Height',
    description: 'Cajon de 0mm — imposible',
    params: { width: 800, height: 2400, depth: 600, numDrawers: 1, drawerHeight: 0 },
    bypass: true, expected: ['ENGINE_CRASH', 'STRUCTURAL_FAIL'],
  },

  // ── Group 4: Baseboard stress ─────────────────────────────────────────────
  {
    id: 'BT14', group: 'Baseboard Overflow',
    description: 'Rodapie 2500mm en closet de 2400mm alto — imposible',
    params: { width: 800, height: 2400, depth: 600, baseboard: true, baseboardHeight: 2500 },
    bypass: true, expected: ['ENGINE_CRASH', 'STRUCTURAL_FAIL', 'ENGINE_FAIL'],
  },
  {
    id: 'BT15', group: 'Baseboard Equal Height',
    description: 'Rodapie exactamente igual a la altura total',
    params: { width: 800, height: 2400, depth: 600, baseboard: true, baseboardHeight: 2400 },
    bypass: true, expected: ['ENGINE_CRASH', 'STRUCTURAL_FAIL', 'ENGINE_FAIL'],
  },
  {
    id: 'BT16', group: 'Min Baseboard',
    description: 'Rodapie de 59mm — justo debajo del minimo (60mm)',
    params: { width: 800, height: 2400, depth: 600, baseboard: true, baseboardHeight: 59 },
    bypass: false, expected: ['STRUCTURAL_FAIL'],
  },

  // ── Group 5: Combinatorial stress ────────────────────────────────────────
  {
    id: 'BT17', group: 'Drawers + Shelves Overflow',
    description: '10 cajones + 10 estantes en closet de 800mm — todo lleno',
    params: { width: 800, height: 2400, depth: 600, numDrawers: 10, drawerHeight: 150, numShelves: 10 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'WARNINGS'],
  },
  {
    id: 'BT18', group: 'Max Dividers Narrow',
    description: '50 divisores en closet de 1000mm — compartimentos de ~18mm',
    params: { width: 1000, height: 2400, depth: 600, numDividers: 50 },
    bypass: true, expected: ['STRUCTURAL_FAIL', 'WARNINGS', 'PASS'],
    note: 'Bug #4: El validator puede aceptar esto sin detectar compartimentos <150mm',
  },
  {
    id: 'BT19', group: 'Standard 2400x2400x600',
    description: 'Caso base VALIDADO — debe pasar siempre (regression test)',
    params: { width: 2400, height: 2400, depth: 600, thickness: 18, numShelves: 3 },
    bypass: false, expected: ['PASS', 'WARNINGS'],
    regression: true,
  },
  {
    id: 'BT20', group: 'Float Precision',
    description: 'Dimensiones flotantes — precisión numerica del motor',
    params: { width: 2400.5, height: 2399.9, depth: 600.1, thickness: 18.0 },
    bypass: false, expected: ['PASS', 'WARNINGS'],
  },
]

// ─── HTTP request helper ──────────────────────────────────────────────────────
function postRequest(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options = {
      hostname: SERVER,
      port: PORT,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end',  () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { resolve({ status: res.statusCode, body: data, parseError: true }) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('TIMEOUT')) })
    req.write(payload)
    req.end()
  })
}

// ─── Run all tests ────────────────────────────────────────────────────────────
async function runBrainTrainer() {
  console.log(section('ORBIN BRAIN TRAINER — ADVERSARIAL QA AGENT'))
  console.log(info(`Target: http://${SERVER}:${PORT}${ENDPOINT}`))
  console.log(info(`Tests: ${TESTS.length} | Date: ${new Date().toISOString()}\n`))

  const results = []
  let crashCount = 0, failCount = 0, warnCount = 0, passCount = 0, bugs = []

  for (const test of TESTS) {
    process.stdout.write(`[${test.id}] ${test.description.padEnd(60)} `)

    let result
    try {
      result = await postRequest({
        testId:           test.id,
        description:      test.description,
        bypassRangeGuards: test.bypass,
        params:           test.params,
      })
    } catch (err) {
      console.log(fail(`NETWORK_ERROR: ${err.message}`))
      results.push({ ...test, qaResult: 'NETWORK_ERROR', error: err.message })
      continue
    }

    const r        = result.body
    const qaResult = r.result || (result.status >= 400 ? 'RANGE_BLOCKED' : 'UNKNOWN')
    const dur      = r.durationMs || '?'

    // Classify result
    let label
    if (['ENGINE_CRASH', 'CRITICAL_CRASH', 'NETWORK_ERROR'].includes(qaResult)) {
      label = fail(qaResult); crashCount++
    } else if (qaResult === 'STRUCTURAL_FAIL') {
      label = fail(qaResult); failCount++
    } else if (qaResult === 'WARNINGS') {
      label = warn(qaResult); warnCount++
    } else if (qaResult === 'PASS') {
      label = pass(qaResult); passCount++
    } else {
      label = warn(qaResult)
    }

    console.log(`${label} ${info(`(${dur}ms)`)}`)

    // Check if result was expected
    const unexpected = !test.expected.includes(qaResult)
    if (unexpected) {
      const bugMsg = `[${test.id}] Unexpected result: ${qaResult} (expected: ${test.expected.join('/')})`
      bugs.push(bugMsg)
      console.log(`  ${fail('>>> UNEXPECTED:')} expected ${test.expected.join(' or ')}, got ${qaResult}`)
    }

    // Print key findings
    if (r.validation) {
      if (r.validation.errors?.length)   console.log(`  ${fail('ERRORS:')} ${r.validation.errors.slice(0,2).join(' | ')}`)
      if (r.validation.warnings?.length) console.log(`  ${warn('WARNS:')} ${r.validation.warnings.slice(0,2).join(' | ')}`)
    }
    if (r.engineError) console.log(`  ${fail('ENGINE:')} ${r.engineError.substring(0, 120)}`)
    if (test.note)     console.log(`  ${warn('NOTE:')} ${test.note}`)

    results.push({ ...test, qaResult, httpStatus: result.status, durationMs: dur,
      errors: r.validation?.errors || [], warnings: r.validation?.warnings || [],
      engineError: r.engineError || null, unexpected,
    })

    await new Promise(r => setTimeout(r, 200)) // small pause between tests
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(section('RESULTS SUMMARY'))
  console.log(`  ${pass('PASS')}            : ${passCount}`)
  console.log(`  ${warn('WARNINGS')}        : ${warnCount}`)
  console.log(`  ${fail('STRUCTURAL_FAIL')} : ${failCount}`)
  console.log(`  ${fail('ENGINE_CRASH')}    : ${crashCount}`)
  console.log(`  Total tests      : ${TESTS.length}`)

  if (bugs.length > 0) {
    console.log(section('UNEXPECTED RESULTS (potential bugs)'))
    bugs.forEach(b => console.log(`  ${fail('!')} ${b}`))
  } else {
    console.log(`\n${pass('All results within expected ranges. No new bugs detected.')}`)
  }

  // ─── Regression check ───────────────────────────────────────────────────────
  const regressionTest = results.find(r => r.regression)
  if (regressionTest) {
    const ok = ['PASS', 'WARNINGS'].includes(regressionTest.qaResult)
    console.log(`\n${info('Regression BT19 (2400x2400x600):')} ${ok ? pass('OK') : fail('REGRESSION DETECTED!')}`)
  }

  // ─── Save report ────────────────────────────────────────────────────────────
  const reportPath = `C:\\Users\\Azomarg\\Documents\\Claude_projects\\Orbin\\BRAIN_TRAINER_REPORT_${Date.now()}.json`
  const report = {
    runDate: new Date().toISOString(),
    summary: { pass: passCount, warnings: warnCount, structuralFail: failCount, engineCrash: crashCount, total: TESTS.length },
    unexpectedResults: bugs,
    results,
  }

  try {
    fs.writeFileSync(reportPath.replace('C:\\', '/mnt/c/').replace(/\\/g, '/'), JSON.stringify(report, null, 2))
  } catch {
    // Write using the actual path if running on Windows
    try { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)) } catch {}
  }

  console.log(section('DONE'))
  console.log(info(`Report saved: BRAIN_TRAINER_REPORT_*.json`))
  console.log(info('Check the CMD window showing the Orbin server for incoming POST logs.\n'))
}

runBrainTrainer().catch(err => {
  console.error(fail(`\nFATAL: ${err.message}`))
  process.exit(1)
})
