const { validateDesign } = require('./validator')
const { generateProject } = require('./closetEngine')

console.log("--- TEST: DRAWER TOP COVERING RULE ---\n")

// 1. Adversarial configuration: Drawers requested, but topShelf missing or false
const adversarialConfig = {
  width: 600,
  height: 2000,
  depth: 600,
  thickness: 18,
  numDrawers: 3,
  numShelves: 0,
  topShelf: false // Adversarial: explicitly false
}

console.log("Adversarial Input Configuration:", JSON.stringify(adversarialConfig, null, 2))

// 2. Wrap it for the validator
const designMock = {
  configuration: { ...adversarialConfig },
  pieces: [{ width: 500, height: 100, name: 'dummy' }] // dummy piece just to pass base piece validations
}

// 3. Run validation
const validationResult = validateDesign(designMock)
console.log("\nValidation Result Warnings:", validationResult.warnings)
console.log("Patched Config topShelf value:", designMock.configuration.topShelf)

// 4. Run through the engine with the patched config
if (designMock.configuration.topShelf === true) {
  const engineResult = generateProject(designMock.configuration)
  const topCoverPiece = engineResult.pieces.find(p => p.name.includes('Repisa Separadora'))
  if (topCoverPiece) {
    console.log("\nSUCCESS: closetEngine generated the top covering board!")
    console.log("Generated Piece:", topCoverPiece)
  } else {
    console.log("\nFAILURE: closetEngine did not generate the top covering board.")
  }
} else {
  console.log("\nFAILURE: Validator did not patch topShelf to true.")
}
