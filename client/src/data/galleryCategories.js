/**
 * Orbin AI — Categorías de la Galería (Verified Templates Catalog).
 * Fuente única de verdad compartida por ResultPanel (guardado) y
 * GalleryCatalog (filtros). Los `value` deben coincidir con la allow-list
 * del backend (server/src/routes/design.js → GALLERY_CATEGORIES).
 */

// value → etiqueta visible (UI en español)
export const GALLERY_CATEGORIES = [
  { value: 'cocina',     label: 'Cocina' },
  { value: 'aereo',      label: 'Aéreos' },
  { value: 'bano',       label: 'Baño' },
  { value: 'closet',     label: 'Closet / Ropero' },
  { value: 'cajonera',   label: 'Cajonera' },
  { value: 'escritorio', label: 'Escritorio' },
  { value: 'oficina',    label: 'Oficina' },
  { value: 'sala',       label: 'Sala / Living' },
  { value: 'dormitorio', label: 'Dormitorio' },
]

export const CATEGORY_LABELS = GALLERY_CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label
  return acc
}, {})

/**
 * Sugerencia inicial de categoría a partir del moduleType del motor.
 * Es SOLO un default editable — la categoría real la elige el usuario, porque
 * moduleType no la determina (un `standard` puede ser closet o baño).
 */
export function suggestCategory(moduleType) {
  switch (moduleType) {
    case 'aereo': return 'aereo'
    case 'base':  return 'cocina'
    default:      return '' // sin sugerencia → el usuario elige
  }
}
