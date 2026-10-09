/**
 * Orbin AI — Módulo base del piloto industrial (snapshot del motor).
 *
 * Salida REAL de server/src/engine/closetEngine.generateProject() para
 * 800 × 2100 × 550 mm, 2 gavetas + 3 estantes, MDF 18 / fondo 6 — generada el
 * 2026-10-09. Se embebe para que el visor 3D y el despiece rendericen al instante
 * aunque el backend (:3003) no responda. Reglas verificadas en este snapshot:
 *   · Vano interior 764 → caja de cajón 738 (−26 = 13 mm/lado corredera telescópica)
 *   · Frente de gaveta 760 × 176 (−2 mm/lado de holgura perimetral)
 *   · Ninguna pieza excede la placa 2750 × 1840
 * `_demoSnapshot: true` → App.jsx lo re-hidrata contra el motor vivo si el
 * servidor está arriba (así nunca queda desfasado de cambios futuros del motor).
 */
const DEMO_BASE_MODULE = {
 "success": true,
 "specAdjustments": [],
 "hasSpecAdjustments": false,
 "drawerBox": {
  "depth": 500,
  "height": 140,
  "outerWidth": 738,
  "wallThickness": 18
 },
 "id": "mod-base-demo",
 "type": "standard",
 "version": "4.5.0-LEGACY_RESTORATION",
 "units": "mm",
 "dimensions": {
  "external": {
   "width": 800,
   "height": 2100,
   "depth": 550
  },
  "internal": {
   "width": 764,
   "height": 2020,
   "depth": 544
  }
 },
 "configuration": {
  "moduleType": "standard",
  "width": 800,
  "height": 2100,
  "depth": 550,
  "thickness": 18,
  "backThickness": 6,
  "numShelves": 3,
  "numDrawers": 2,
  "drawerHeight": 180,
  "numDividers": 0,
  "drawerLayout": "vertical",
  "hasDoors": false,
  "numDoors": 2,
  "doorType": "hinged",
  "edgeBandingType": "thin",
  "baseboard": true,
  "baseboardHeight": 80,
  "baseType": "recessed",
  "legHeight": 100,
  "topStyle": null,
  "doorStyle": null,
  "tamponado": "none",
  "hasCountertop": true,
  "handleType": "standard",
  "hasHangingRod": false,
  "doorFinish": null,
  "hasLed": false,
  "countertopMaterial": null,
  "pedestalWidth": 400,
  "nicheHeight": 0,
  "drawerColumns": null,
  "drawerPrivacyPanel": true,
  "drawerRailHeight": 50,
  "mountHeight": null,
  "materialBody": "oak_light",
  "materialFront": "white",
  "specAdjustments": [],
  "tamponadoThickness": 18,
  "panelVista": "ninguno",
  "fijacion": "minifix"
 },
 "pieces": [
  {
   "id": "LAT-L-001",
   "name": "Lateral Izquierdo",
   "type": "lateral",
   "width": 550,
   "height": 2100,
   "thickness": 18,
   "quantity": 1,
   "x": 9,
   "y": 1050,
   "z": 275,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "LAT-R-002",
   "name": "Lateral Derecho",
   "type": "lateral",
   "width": 550,
   "height": 2100,
   "thickness": 18,
   "quantity": 1,
   "x": 791,
   "y": 1050,
   "z": 275,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "TAMPO-003",
   "name": "Techo",
   "type": "techo",
   "width": 764,
   "height": 550,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 2091,
   "z": 275,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "BASE-004",
   "name": "Base Inferior",
   "type": "piso",
   "width": 764,
   "height": 550,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 89,
   "z": 275,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "FUNDO-005",
   "name": "Fondo",
   "type": "fondo",
   "width": 764,
   "height": 1984,
   "thickness": 6,
   "quantity": 1,
   "x": 400,
   "y": 1090,
   "z": 547,
   "grainDirection": "none",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "RODAPIE-FRONTAL-006",
   "name": "Zócalo Frontal",
   "type": "baseboard",
   "width": 764,
   "height": 80,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 40,
   "z": 441,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   },
   "notes": "Recuo 100mm (estándar marcenaria BR)",
   "frontType": null
  },
  {
   "id": "RODAPIE-TRASERO-007",
   "name": "Zócalo Trasero",
   "type": "baseboard",
   "width": 764,
   "height": 80,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 40,
   "z": 109,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   },
   "notes": "Recuo 100mm (estándar marcenaria BR)",
   "frontType": null
  },
  {
   "id": "GAV-FF-008",
   "name": "Frente Gaveta 1",
   "type": "drawer_front",
   "width": 760,
   "height": 176,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 188,
   "z": 541,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "all": true
   },
   "notes": "Holgura 2mm/lado",
   "frontType": "drawer_front",
   "drawerGroupId": "DRW-1"
  },
  {
   "id": "GAV-LAT-009",
   "name": "Lateral Cajón 1",
   "type": "drawer_box",
   "width": 500,
   "height": 140,
   "thickness": 18,
   "quantity": 2,
   "x": 400,
   "y": 188,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-1"
  },
  {
   "id": "GAV-EST-010",
   "name": "Frente/Trasera Cajón 1",
   "type": "drawer_box",
   "width": 702,
   "height": 140,
   "thickness": 18,
   "quantity": 2,
   "x": 400,
   "y": 188,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-1"
  },
  {
   "id": "GAV-FUNDO-011",
   "name": "Fondo Cajón 1",
   "type": "drawer_bottom",
   "width": 738,
   "height": 500,
   "thickness": 6,
   "quantity": 1,
   "x": 400,
   "y": 121,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "none": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-1"
  },
  {
   "id": "GAV-FF-012",
   "name": "Frente Gaveta 2",
   "type": "drawer_front",
   "width": 760,
   "height": 176,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 368,
   "z": 541,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "all": true
   },
   "notes": "Holgura 2mm/lado",
   "frontType": "drawer_front",
   "drawerGroupId": "DRW-2"
  },
  {
   "id": "GAV-LAT-013",
   "name": "Lateral Cajón 2",
   "type": "drawer_box",
   "width": 500,
   "height": 140,
   "thickness": 18,
   "quantity": 2,
   "x": 400,
   "y": 368,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-2"
  },
  {
   "id": "GAV-EST-014",
   "name": "Frente/Trasera Cajón 2",
   "type": "drawer_box",
   "width": 702,
   "height": 140,
   "thickness": 18,
   "quantity": 2,
   "x": 400,
   "y": 368,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-2"
  },
  {
   "id": "GAV-FUNDO-015",
   "name": "Fondo Cajón 2",
   "type": "drawer_bottom",
   "width": 738,
   "height": 500,
   "thickness": 6,
   "quantity": 1,
   "x": 400,
   "y": 301,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "none": true
   },
   "notes": "",
   "frontType": null,
   "drawerGroupId": "DRW-2"
  },
  {
   "id": "SEP-016",
   "name": "Repisa Separadora (encima gavetas)",
   "type": "shelf",
   "width": 762,
   "height": 544,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 467,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "Separador estructural gavetas/estantes",
   "frontType": null
  },
  {
   "id": "PRAT-017",
   "name": "Estante 1",
   "type": "repisa",
   "width": 762,
   "height": 544,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 879,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "PRAT-018",
   "name": "Estante 2",
   "type": "repisa",
   "width": 762,
   "height": 544,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 1263,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  },
  {
   "id": "PRAT-019",
   "name": "Estante 3",
   "type": "repisa",
   "width": 762,
   "height": 544,
   "thickness": 18,
   "quantity": 1,
   "x": 400,
   "y": 1647,
   "z": 278,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   },
   "notes": "",
   "frontType": null
  }
 ],
 "cutList": [
  {
   "id": "LAT-L-001",
   "name": "Lateral Izquierdo",
   "type": "lateral",
   "nominalWidth": 550,
   "nominalHeight": 2100,
   "cutWidth": 550,
   "cutHeight": 2099,
   "thickness": 18,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "LAT-R-002",
   "name": "Lateral Derecho",
   "type": "lateral",
   "nominalWidth": 550,
   "nominalHeight": 2100,
   "cutWidth": 550,
   "cutHeight": 2099,
   "thickness": 18,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "TAMPO-003",
   "name": "Techo",
   "type": "techo",
   "nominalWidth": 764,
   "nominalHeight": 550,
   "cutWidth": 764,
   "cutHeight": 549,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "BASE-004",
   "name": "Base Inferior",
   "type": "piso",
   "nominalWidth": 764,
   "nominalHeight": 550,
   "cutWidth": 764,
   "cutHeight": 549,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "FUNDO-005",
   "name": "Fondo",
   "type": "fondo",
   "nominalWidth": 764,
   "nominalHeight": 1984,
   "cutWidth": 764,
   "cutHeight": 1983,
   "thickness": 6,
   "grainDirection": "none",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "RODAPIE-FRONTAL-006",
   "name": "Zócalo Frontal",
   "type": "baseboard",
   "nominalWidth": 764,
   "nominalHeight": 80,
   "cutWidth": 764,
   "cutHeight": 79,
   "thickness": 18,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "RODAPIE-TRASERO-007",
   "name": "Zócalo Trasero",
   "type": "baseboard",
   "nominalWidth": 764,
   "nominalHeight": 80,
   "cutWidth": 764,
   "cutHeight": 79,
   "thickness": 18,
   "grainDirection": "vertical",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-FF-008",
   "name": "Frente Gaveta 1",
   "type": "drawer_front",
   "nominalWidth": 760,
   "nominalHeight": 176,
   "cutWidth": 758,
   "cutHeight": 174,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "all": true
   }
  },
  {
   "id": "GAV-LAT-009-1",
   "name": "Lateral Cajón 1 (1/2)",
   "type": "drawer_box",
   "nominalWidth": 500,
   "nominalHeight": 140,
   "cutWidth": 500,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-LAT-009-2",
   "name": "Lateral Cajón 1 (2/2)",
   "type": "drawer_box",
   "nominalWidth": 500,
   "nominalHeight": 140,
   "cutWidth": 500,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-EST-010-1",
   "name": "Frente/Trasera Cajón 1 (1/2)",
   "type": "drawer_box",
   "nominalWidth": 702,
   "nominalHeight": 140,
   "cutWidth": 702,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-EST-010-2",
   "name": "Frente/Trasera Cajón 1 (2/2)",
   "type": "drawer_box",
   "nominalWidth": 702,
   "nominalHeight": 140,
   "cutWidth": 702,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-FUNDO-011",
   "name": "Fondo Cajón 1",
   "type": "drawer_bottom",
   "nominalWidth": 738,
   "nominalHeight": 500,
   "cutWidth": 738,
   "cutHeight": 500,
   "thickness": 6,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "none": true
   }
  },
  {
   "id": "GAV-FF-012",
   "name": "Frente Gaveta 2",
   "type": "drawer_front",
   "nominalWidth": 760,
   "nominalHeight": 176,
   "cutWidth": 758,
   "cutHeight": 174,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "all": true
   }
  },
  {
   "id": "GAV-LAT-013-1",
   "name": "Lateral Cajón 2 (1/2)",
   "type": "drawer_box",
   "nominalWidth": 500,
   "nominalHeight": 140,
   "cutWidth": 500,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-LAT-013-2",
   "name": "Lateral Cajón 2 (2/2)",
   "type": "drawer_box",
   "nominalWidth": 500,
   "nominalHeight": 140,
   "cutWidth": 500,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-EST-014-1",
   "name": "Frente/Trasera Cajón 2 (1/2)",
   "type": "drawer_box",
   "nominalWidth": 702,
   "nominalHeight": 140,
   "cutWidth": 702,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-EST-014-2",
   "name": "Frente/Trasera Cajón 2 (2/2)",
   "type": "drawer_box",
   "nominalWidth": 702,
   "nominalHeight": 140,
   "cutWidth": 702,
   "cutHeight": 139,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "GAV-FUNDO-015",
   "name": "Fondo Cajón 2",
   "type": "drawer_bottom",
   "nominalWidth": 738,
   "nominalHeight": 500,
   "cutWidth": 738,
   "cutHeight": 500,
   "thickness": 6,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "none": true
   }
  },
  {
   "id": "SEP-016",
   "name": "Repisa Separadora (encima gavetas)",
   "type": "shelf",
   "nominalWidth": 762,
   "nominalHeight": 544,
   "cutWidth": 762,
   "cutHeight": 543,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "PRAT-017",
   "name": "Estante 1",
   "type": "repisa",
   "nominalWidth": 762,
   "nominalHeight": 544,
   "cutWidth": 762,
   "cutHeight": 543,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "PRAT-018",
   "name": "Estante 2",
   "type": "repisa",
   "nominalWidth": 762,
   "nominalHeight": 544,
   "cutWidth": 762,
   "cutHeight": 543,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  },
  {
   "id": "PRAT-019",
   "name": "Estante 3",
   "type": "repisa",
   "nominalWidth": 762,
   "nominalHeight": 544,
   "cutWidth": 762,
   "cutHeight": 543,
   "thickness": 18,
   "grainDirection": "horizontal",
   "edgeBanding": {
    "front": true
   }
  }
 ],
 "nesting": [
  {
   "thickness": 6,
   "plateCount": 1,
   "plates": [
    {
     "id": 1,
     "usedArea": 2253012,
     "pieces": [
      {
       "w": 764,
       "h": 1983,
       "id": "FUNDO-005",
       "type": "fondo",
       "grainDirection": "none",
       "long": 1983,
       "short": 764,
       "rotated": true,
       "posX": 0,
       "posY": 0
      },
      {
       "w": 738,
       "h": 500,
       "id": "GAV-FUNDO-011",
       "type": "drawer_bottom",
       "grainDirection": "horizontal",
       "long": 738,
       "short": 500,
       "rotated": false,
       "posX": 0,
       "posY": 767.2
      },
      {
       "w": 738,
       "h": 500,
       "id": "GAV-FUNDO-015",
       "type": "drawer_bottom",
       "grainDirection": "horizontal",
       "long": 738,
       "short": 500,
       "rotated": false,
       "posX": 741.2,
       "posY": 767.2
      }
     ],
     "efficiency": 0.4886167859466493
    }
   ],
   "placedPieces": 3,
   "oversizedPieces": [],
   "splitPieces": [],
   "grainRotatedCount": 1,
   "totalPieceArea": 2253012,
   "totalPlateArea": 4611000,
   "overallEfficiency": 0.49
  },
  {
   "thickness": 18,
   "plateCount": 2,
   "plates": [
    {
     "id": 1,
     "usedArea": 3561538,
     "pieces": [
      {
       "w": 550,
       "h": 2099,
       "id": "LAT-L-001",
       "type": "lateral",
       "grainDirection": "vertical",
       "long": 2099,
       "short": 550,
       "rotated": true,
       "posX": 0,
       "posY": 0
      },
      {
       "w": 550,
       "h": 2099,
       "id": "LAT-R-002",
       "type": "lateral",
       "grainDirection": "vertical",
       "long": 2099,
       "short": 550,
       "rotated": true,
       "posX": 0,
       "posY": 553.2
      },
      {
       "w": 764,
       "h": 549,
       "id": "TAMPO-003",
       "type": "techo",
       "grainDirection": "horizontal",
       "long": 764,
       "short": 549,
       "rotated": false,
       "posX": 0,
       "posY": 1106.4
      },
      {
       "w": 764,
       "h": 549,
       "id": "BASE-004",
       "type": "piso",
       "grainDirection": "horizontal",
       "long": 764,
       "short": 549,
       "rotated": false,
       "posX": 767.2,
       "posY": 1106.4
      },
      {
       "w": 762,
       "h": 543,
       "id": "SEP-016",
       "type": "shelf",
       "grainDirection": "horizontal",
       "long": 762,
       "short": 543,
       "rotated": false,
       "posX": 1534.4,
       "posY": 1106.4
      }
     ],
     "efficiency": 0.7724003469963132
    },
    {
     "id": 2,
     "usedArea": 2294106,
     "pieces": [
      {
       "w": 762,
       "h": 543,
       "id": "PRAT-017",
       "type": "repisa",
       "grainDirection": "horizontal",
       "long": 762,
       "short": 543,
       "rotated": false,
       "posX": 0,
       "posY": 0
      },
      {
       "w": 762,
       "h": 543,
       "id": "PRAT-018",
       "type": "repisa",
       "grainDirection": "horizontal",
       "long": 762,
       "short": 543,
       "rotated": false,
       "posX": 765.2,
       "posY": 0
      },
      {
       "w": 762,
       "h": 543,
       "id": "PRAT-019",
       "type": "repisa",
       "grainDirection": "horizontal",
       "long": 762,
       "short": 543,
       "rotated": false,
       "posX": 1530.4,
       "posY": 0
      },
      {
       "w": 758,
       "h": 174,
       "id": "GAV-FF-008",
       "type": "drawer_front",
       "grainDirection": "horizontal",
       "long": 758,
       "short": 174,
       "rotated": false,
       "posX": 0,
       "posY": 546.2
      },
      {
       "w": 758,
       "h": 174,
       "id": "GAV-FF-012",
       "type": "drawer_front",
       "grainDirection": "horizontal",
       "long": 758,
       "short": 174,
       "rotated": false,
       "posX": 761.2,
       "posY": 546.2
      },
      {
       "w": 702,
       "h": 139,
       "id": "GAV-EST-010-1",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 702,
       "short": 139,
       "rotated": false,
       "posX": 1522.4,
       "posY": 546.2
      },
      {
       "w": 702,
       "h": 139,
       "id": "GAV-EST-010-2",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 702,
       "short": 139,
       "rotated": false,
       "posX": 0,
       "posY": 723.4000000000001
      },
      {
       "w": 702,
       "h": 139,
       "id": "GAV-EST-014-1",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 702,
       "short": 139,
       "rotated": false,
       "posX": 705.2,
       "posY": 723.4000000000001
      },
      {
       "w": 702,
       "h": 139,
       "id": "GAV-EST-014-2",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 702,
       "short": 139,
       "rotated": false,
       "posX": 1410.4,
       "posY": 723.4000000000001
      },
      {
       "w": 500,
       "h": 139,
       "id": "GAV-LAT-009-1",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 500,
       "short": 139,
       "rotated": false,
       "posX": 2115.6000000000004,
       "posY": 723.4000000000001
      },
      {
       "w": 500,
       "h": 139,
       "id": "GAV-LAT-009-2",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 500,
       "short": 139,
       "rotated": false,
       "posX": 0,
       "posY": 865.6000000000001
      },
      {
       "w": 500,
       "h": 139,
       "id": "GAV-LAT-013-1",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 500,
       "short": 139,
       "rotated": false,
       "posX": 503.2,
       "posY": 865.6000000000001
      },
      {
       "w": 500,
       "h": 139,
       "id": "GAV-LAT-013-2",
       "type": "drawer_box",
       "grainDirection": "horizontal",
       "long": 500,
       "short": 139,
       "rotated": false,
       "posX": 1006.4,
       "posY": 865.6000000000001
      },
      {
       "w": 764,
       "h": 79,
       "id": "RODAPIE-FRONTAL-006",
       "type": "baseboard",
       "grainDirection": "vertical",
       "long": 764,
       "short": 79,
       "rotated": false,
       "posX": 1509.6,
       "posY": 865.6000000000001
      },
      {
       "w": 764,
       "h": 79,
       "id": "RODAPIE-TRASERO-007",
       "type": "baseboard",
       "grainDirection": "vertical",
       "long": 764,
       "short": 79,
       "rotated": false,
       "posX": 0,
       "posY": 1007.8000000000002
      }
     ],
     "efficiency": 0.49752895250487966
    }
   ],
   "placedPieces": 20,
   "oversizedPieces": [],
   "splitPieces": [],
   "grainRotatedCount": 2,
   "totalPieceArea": 5855644,
   "totalPlateArea": 9222000,
   "overallEfficiency": 0.63
  }
 ],
 "hardware": [
  {
   "type": "Corredica Telescopica",
   "description": "Par de corredicas 500mm",
   "quantity": 4,
   "unit": "par"
  },
  {
   "type": "Minifix",
   "description": "Excentrico 15mm + perno",
   "quantity": 20,
   "unit": "un"
  },
  {
   "type": "Pino para Prateleira",
   "description": "Pino metalico o5mm",
   "quantity": 12,
   "unit": "un"
  },
  {
   "type": "Parafuso Confirmat",
   "description": "Confirmat o7x50mm fixacao estrutural",
   "quantity": 24,
   "unit": "un"
  }
 ],
 "_demoSnapshot": true
}

export default DEMO_BASE_MODULE
