import { ARAUCO_CATALOG } from './arauco.js'
import { DURATEX_CATALOG } from './duratex.js'

export const CATALOGS = [
  ARAUCO_CATALOG,
  DURATEX_CATALOG
]

export const ALL_BOARDS = CATALOGS.flatMap(cat =>
  cat.boards.map(b => ({
    ...b,
    manufacturer: cat.manufacturer,
    displayName: `${cat.manufacturer} - ${b.name} (${b.finish})`
  }))
)

export function getBoardById(id) {
  return ALL_BOARDS.find(b => b.id === id)
}
