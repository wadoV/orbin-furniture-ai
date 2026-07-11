/**
 * Mathematical specifications for furniture calculations
 * Single Source of Truth for Orbin AI
 */
module.exports = {
  // Calculates internal usable space
  internalSpan: (totalWidth, thickness) => totalWidth - (2 * thickness),
  
  // Drawer box calculations
  drawerBox: {
    // Net width of drawer box
    netWidth: (internalSpan) => internalSpan - 26,
    
    // Drawer side length based on rail length
    sideLength: (railLength) => railLength,
    
    // Drawer front/back headers
    headerWidth: (netWidth, drawerThickness) => netWidth - (2 * drawerThickness)
  },
  
  // Back panel calculations
  backPanels: {
    // Grooved back width
    groovedWidth: (internalSpan, grooveDepth = 8) => internalSpan + (2 * grooveDepth),
    
    // Groove position from back
    groovePosition: (thickness) => thickness + 5,
    
    // Nailed back width
    nailedWidth: (totalWidth) => totalWidth - 2
  },
  
  // Edge banding compensation
  edgeBanding: (baseSize, edgeThickness) => baseSize - edgeThickness,
  
  // Standard thickness values
  thicknessOptions: [15, 18],
  
  // Standard edge thickness values
  edgeThicknessOptions: [0.4, 1, 2]
};