/**
 * Orbin AI — Project Memory System v1.0
 * ★ PROTECTED: Persistent project memory with versioning
 *
 * Stores: prompts, actions, optimizations, material history, versions
 * Enables: "Last changes", "Revert version", "Continue project", "Auto summary"
 */

const MEMORY_KEY = 'orbin-project-memory'
const MAX_VERSIONS = 30
const MAX_ACTIONS = 100
const MAX_PROMPTS = 50

// ─── Core Memory Structure ─────────────────────────────────────────────────

function createEmptyMemory() {
  return {
    projectId: null,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    versions: [],          // snapshots of modules state
    prompts: [],           // AI prompt history with results
    actions: [],           // user actions log
    optimizations: [],     // optimization suggestions applied
    materialsHistory: [],  // material changes over time
    metadata: {
      totalGenerations: 0,
      totalOptimizations: 0,
      totalExports: 0,
      favoriteModuleType: null,
      avgWastePercent: null,
      lastSessionDuration: 0,
    }
  }
}

// ─── Load / Save ────────────────────────────────────────────────────────────

export function loadMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    if (!raw) return createEmptyMemory()
    const mem = JSON.parse(raw)
    // Migration: ensure all fields exist
    return { ...createEmptyMemory(), ...mem }
  } catch {
    return createEmptyMemory()
  }
}

export function saveMemory(memory) {
  try {
    memory.lastModified = new Date().toISOString()
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch { /* quota exceeded */ }
}

export function clearMemory() {
  try { localStorage.removeItem(MEMORY_KEY) } catch {}
}

// ─── Version Management ─────────────────────────────────────────────────────

export function saveVersion(memory, modules, label = '') {
  const version = {
    id: `VER-${Date.now()}`,
    timestamp: new Date().toISOString(),
    label: label || `Version ${memory.versions.length + 1}`,
    moduleCount: modules.length,
    snapshot: JSON.parse(JSON.stringify(modules)), // deep clone
    summary: generateVersionSummary(modules),
  }
  memory.versions = [version, ...memory.versions].slice(0, MAX_VERSIONS)
  memory.metadata.totalGenerations++
  saveMemory(memory)
  return version
}

export function revertToVersion(memory, versionId) {
  const version = memory.versions.find(v => v.id === versionId)
  if (!version) return null

  // Log the revert as an action
  logAction(memory, 'revert', {
    fromVersion: memory.versions[0]?.id,
    toVersion: versionId,
    label: version.label,
  })

  return version.snapshot
}

export function getVersionHistory(memory) {
  return memory.versions.map(v => ({
    id: v.id,
    timestamp: v.timestamp,
    label: v.label,
    moduleCount: v.moduleCount,
    summary: v.summary,
    age: getTimeAgo(v.timestamp),
  }))
}

// ─── Prompt Memory ──────────────────────────────────────────────────────────

export function logPrompt(memory, prompt, response, source = 'unknown', designGenerated = false) {
  const entry = {
    id: `PRM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    prompt,
    responsePreview: (response || '').substring(0, 200),
    source,
    designGenerated,
    tokens: estimateTokens(prompt + (response || '')),
  }
  memory.prompts = [entry, ...memory.prompts].slice(0, MAX_PROMPTS)
  saveMemory(memory)
  return entry
}

export function getPromptHistory(memory) {
  return memory.prompts.map(p => ({
    ...p,
    age: getTimeAgo(p.timestamp),
  }))
}

// ─── Action Log ─────────────────────────────────────────────────────────────

export function logAction(memory, type, details = {}) {
  const action = {
    id: `ACT-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type, // 'generate', 'optimize', 'delete', 'revert', 'export', 'material_change', 'config_change'
    details,
  }
  memory.actions = [action, ...memory.actions].slice(0, MAX_ACTIONS)
  saveMemory(memory)
  return action
}

export function getRecentActions(memory, count = 10) {
  return memory.actions.slice(0, count).map(a => ({
    ...a,
    age: getTimeAgo(a.timestamp),
    description: describeAction(a),
  }))
}

// ─── Optimization Tracking ──────────────────────────────────────────────────

export function logOptimization(memory, before, after, suggestions) {
  const entry = {
    id: `OPT-${Date.now()}`,
    timestamp: new Date().toISOString(),
    wasteBefore: before.wastePercent,
    wasteAfter: after.wastePercent,
    piecesBefore: before.pieceCount,
    piecesAfter: after.pieceCount,
    suggestions: suggestions || [],
    improvement: before.wastePercent - after.wastePercent,
  }
  memory.optimizations = [entry, ...memory.optimizations].slice(0, 20)
  memory.metadata.totalOptimizations++
  saveMemory(memory)
  return entry
}

// ─── Material History ───────────────────────────────────────────────────────

export function logMaterialChange(memory, moduleId, oldMaterial, newMaterial) {
  const entry = {
    timestamp: new Date().toISOString(),
    moduleId,
    from: oldMaterial,
    to: newMaterial,
  }
  memory.materialsHistory = [entry, ...memory.materialsHistory].slice(0, 30)
  saveMemory(memory)
}

// ─── Export Tracking ────────────────────────────────────────────────────────

export function logExport(memory, format, moduleId) {
  logAction(memory, 'export', { format, moduleId })
  memory.metadata.totalExports++
  saveMemory(memory)
}

// ─── Auto Summary ───────────────────────────────────────────────────────────

export function generateProjectSummary(memory, modules) {
  const pieces = modules.flatMap(m => m.pieces || [])
  const totalPieces = pieces.reduce((s, p) => s + (p.quantity || 1), 0)
  const totalArea = pieces.reduce((s, p) => s + (p.width * p.height) / 1e6, 0)
  const types = [...new Set(modules.map(m => m.type || m.configuration?.moduleType))]
  const thicknesses = [...new Set(pieces.map(p => p.thickness))]
  const sheetArea = 2.44 * 1.83
  const sheets = Math.ceil(totalArea / sheetArea)
  const waste = sheets > 0 ? Math.round((1 - totalArea / (sheets * sheetArea)) * 100) : 0

  return {
    moduleCount: modules.length,
    totalPieces,
    totalAreaM2: Math.round(totalArea * 100) / 100,
    sheetsNeeded: sheets,
    wastePercent: waste,
    moduleTypes: types,
    thicknesses,
    versionsCount: memory.versions.length,
    promptsUsed: memory.prompts.length,
    optimizationsRun: memory.metadata.totalOptimizations,
    exportsCount: memory.metadata.totalExports,
    projectAge: getTimeAgo(memory.createdAt),
    lastModified: getTimeAgo(memory.lastModified),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateVersionSummary(modules) {
  if (!modules || modules.length === 0) return 'Empty project'
  const pieces = modules.flatMap(m => m.pieces || [])
  const types = [...new Set(modules.map(m => m.type || m.configuration?.moduleType || 'standard'))]
  return `${modules.length} module(s) — ${pieces.length} pieces — ${types.join(', ')}`
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4)
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown'
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function describeAction(action) {
  const t = action.type
  const d = action.details || {}
  switch (t) {
    case 'generate':    return `Generated ${d.moduleType || 'module'} (${d.width || '?'}×${d.height || '?'}mm)`
    case 'optimize':    return `Optimization run — waste ${d.wasteBefore || '?'}% → ${d.wasteAfter || '?'}%`
    case 'delete':      return `Deleted module ${d.moduleId || ''}`
    case 'revert':      return `Reverted to ${d.label || d.toVersion || 'previous version'}`
    case 'export':      return `Exported ${d.format || 'file'}`
    case 'material_change': return `Material changed: ${d.from || '?'} → ${d.to || '?'}`
    case 'config_change':   return `Config updated: ${d.field || '?'}`
    default:            return t
  }
}

// ─── React Hook ─────────────────────────────────────────────────────────────

export function useProjectMemory() {
  // Lazy init — loads once per session
  let memory = loadMemory()

  return {
    memory,
    saveVersion: (modules, label) => { memory = loadMemory(); return saveVersion(memory, modules, label) },
    revertToVersion: (id) => { memory = loadMemory(); return revertToVersion(memory, id) },
    getVersionHistory: () => { memory = loadMemory(); return getVersionHistory(memory) },
    logPrompt: (prompt, response, source, designGenerated) => { memory = loadMemory(); return logPrompt(memory, prompt, response, source, designGenerated) },
    logAction: (type, details) => { memory = loadMemory(); return logAction(memory, type, details) },
    logExport: (format, moduleId) => { memory = loadMemory(); return logExport(memory, format, moduleId) },
    logMaterialChange: (moduleId, oldMat, newMat) => { memory = loadMemory(); return logMaterialChange(memory, moduleId, oldMat, newMat) },
    getRecentActions: (count) => { memory = loadMemory(); return getRecentActions(memory, count) },
    getSummary: (modules) => { memory = loadMemory(); return generateProjectSummary(memory, modules) },
    clearMemory,
  }
}
