/**
 * Orbin AI — Material & Hardware Constants
 * Source: rules/parametric_constraints.md
 */

const MATERIAL = {
  /** Default structural panel thickness (mm) */
  THICKNESS_STANDARD: 18,
  THICKNESS_THIN: 15,
  /** Back panel (fundo) thickness (mm) */
  THICKNESS_BACK: 6,
  /** Max plate dimensions (MDF/MDP, Brazil/Latam standard) */
  PLATE_WIDTH: 2750,
  PLATE_HEIGHT: 1840,
  /** Saw kerf — material lost per cut (mm) */
  SAW_KERF: 4,
  /** Nesting perimeter margin (mm) */
  NESTING_MARGIN: 10,
}

const EDGE_BANDING = {
  /** Thin PVC — no significant deduction needed */
  THIN_PVC: 0.45,
  /** Thick PVC / ABS — deduct from final cut dimension */
  THICK_PVC: 2.0,
  ABS: 2.0,
}

const HARDWARE = {
  /** Telescopic slide clearance per side (mm) */
  DRAWER_SLIDE_PER_SIDE: 13,
  /** Total width reduction for drawer box (both sides) */
  DRAWER_SLIDE_TOTAL: 26,
  /** Back groove: depth and distance from rear edge */
  BACK_GROOVE_DEPTH: 6,
  BACK_GROOVE_FROM_EDGE: 20,
  /** Shelf side clearance (mm per side) */
  SHELF_CLEARANCE_PER_SIDE: 1,
  /** Shelf front setback from edge (mm) */
  SHELF_FRONT_SETBACK: 5,

  /**
   * Drawer FRONT gaps — 2mm perimetral (each side: top, bottom, left, right).
   * Total reduction: 4mm width + 4mm height. Independent from door gaps.
   */
  DRAWER_FRONT_GAP_PERIMETER: 2,

  /**
   * Door gaps — independent from drawer front gaps.
   * Width: 2.5mm overlay clearance per side (5mm total) for hinge overlay.
   * Height: 4mm for hinge cup depth at top/bottom (bisagra copa 35mm).
   */
  DOOR_GAP_W_TOTAL: 5,
  DOOR_GAP_H: 4,
}

const STRUCTURAL_LIMITS = {
  /** Max shelf span without central support (mm) */
  MAX_SHELF_SPAN: 900,
  /** Max module height for on-site assembly (mm) */
  MAX_MODULE_HEIGHT: 2600,
  /** Baseboard constraints (mm) */
  BASEBOARD_MIN_HEIGHT: 60,
  BASEBOARD_MAX_HEIGHT: 150,
  BASEBOARD_SETBACK_MIN: 30,
  BASEBOARD_SETBACK_MAX: 50,
  /** Drawer clearance above box in opening (mm) */
  DRAWER_TOP_CLEARANCE: 16,
  /** Drawer depth setback from cabinet back (mm) */
  DRAWER_BACK_CLEARANCE: 50,
}

const DEFAULTS = {
  type: 'closet', // closet | kitchen_low | kitchen_high | kitchen_island
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
  numDividers: 0,         // Internal vertical dividers (Lateral Interno)
  // New Styles
  materialBody: 'oak_light',
  materialFront: 'oak_light',
  handleType: 'standard', // standard | gola | push
  hasCountertop: false,
  countertopMaterial: 'none',
  hasLED: false
}

module.exports = { MATERIAL, EDGE_BANDING, HARDWARE, STRUCTURAL_LIMITS, DEFAULTS }
