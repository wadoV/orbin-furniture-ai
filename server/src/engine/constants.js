/**
 * Orbin AI — Material & Hardware Constants
 * Source: rules/parametric_constraints.md
 */

const MATERIAL = {
  THICKNESS_STANDARD: 18,
  THICKNESS_THIN: 15,
  THICKNESS_BACK: 6,
  PLATE_WIDTH: 2750,
  PLATE_HEIGHT: 1840,
  SAW_KERF: 4,
  NESTING_MARGIN: 10,
}

const EDGE_BANDING = {
  THIN_PVC: 0.45,
  THICK_PVC: 2.0,
  ABS: 2.0,
}

const HARDWARE = {
  DRAWER_SLIDE_PER_SIDE: 13,
  DRAWER_SLIDE_TOTAL: 26,
  BACK_GROOVE_DEPTH: 6,
  BACK_GROOVE_FROM_EDGE: 20,
  SHELF_CLEARANCE_PER_SIDE: 1,
  SHELF_FRONT_SETBACK: 5,
  DRAWER_FRONT_GAP_PERIMETER: 2,
  DOOR_GAP_W_TOTAL: 5,
  DOOR_GAP_H: 4,
}

const STRUCTURAL_LIMITS = {
  MAX_SHELF_SPAN: 900,
  MAX_MODULE_HEIGHT: 2600,
  BASEBOARD_MIN_HEIGHT: 60,
  BASEBOARD_MAX_HEIGHT: 150,
  BASEBOARD_SETBACK_MIN: 30,
  BASEBOARD_SETBACK_MAX: 50,
  DRAWER_TOP_CLEARANCE: 16,
  DRAWER_BACK_CLEARANCE: 50,
}

// AEREO: Wall-mounted cabinet constraints (ABNT ergonomic guidelines). All values in mm.
// NEW in Orbin v4.7
const AEREO = {
  KITCHEN_MOUNT_HEIGHT: 1450,
  KITCHEN_MIN_CLEARANCE_ABOVE_COUNTER: 450,
  BATHROOM_MOUNT_HEIGHT: 1000,
  LIVING_MOUNT_HEIGHT: 1200,
  BEDROOM_HEADBOARD_HEIGHT: 800,
  MIN_MOUNT_HEIGHT: 400,
  MAX_MOUNT_HEIGHT: 2400,
  KITCHEN_HEIGHT_MIN: 300,
  KITCHEN_HEIGHT_MAX: 800,
  KITCHEN_DEPTH_STANDARD: 320,
  KITCHEN_DEPTH_MIN: 250,
  KITCHEN_DEPTH_MAX: 400,
  BATHROOM_DEPTH_MAX: 180,
  LIVING_DEPTH_STANDARD: 300,
  LIVING_DEPTH_MAX: 450,
  WALL_PLUG_MIN: 2,
  WALL_PLUG_SPACING_MIN: 400,
  WALL_PLUG_RATED_LOAD_KG: 40,
  WALL_PLUG_DRYWALL_LOAD_KG: 15,
  HIDDEN_RAIL_WEIGHT_THRESHOLD_KG: 15,
  BACK_PANEL_REQUIRED: true,
  PLUG_SPACING_PER_MM: 600,
}

const DEFAULTS = {
  type: 'closet',
  width: 2400,
  height: 2400,
  depth: 600,
  thickness: 18,
  backThickness: 6,
  numShelves: 2,
  numDrawers: 0,
  drawerHeight: 180,
  hasDoors: false,
  doorType: 'none',
  edgeBandingType: 'thin',
  baseboard: true,
  baseboardHeight: 100,
  numDividers: 0,
  materialBody: 'oak_light',
  materialFront: 'oak_light',
  handleType: 'standard',
  hasCountertop: false,
  countertopMaterial: 'none',
  hasLED: false,
  mountHeight: 1400,
}

module.exports = { MATERIAL, EDGE_BANDING, HARDWARE, STRUCTURAL_LIMITS, DEFAULTS, AEREO }
