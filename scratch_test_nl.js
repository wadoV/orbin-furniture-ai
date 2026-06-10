const { parseNaturalLanguage } = require('./server/src/engine/nlParser')

const prompt = 'Armario de cocina de 2.40m con 4 cajones y puertas en roble'
const result = parseNaturalLanguage(prompt)

console.log('--- TEST RUN OF ORBIN NL PARSER ---')
console.log('Prompt:', prompt)
console.log('Resulting Parameters:', JSON.stringify(result, null, 2))
