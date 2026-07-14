const express = require('express')
const router = express.Router()
const { analyzeSpaceImage } = require('../ai/geminiClient')

// ─── POST /api/vision/analyze-space ──────────────────────────────────────────

router.post('/analyze-space', async (req, res) => {
  try {
    const { imageBase64, mimeType, userPrompt } = req.body

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 es requerido.' })
    }

    // El imageBase64 suele venir como "data:image/jpeg;base64,/9j/4AAQSk..."
    // Debemos extraer solo la data
    let base64Data = imageBase64
    let actualMimeType = mimeType || 'image/jpeg'

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,')
      actualMimeType = parts[0].replace('data:', '')
      base64Data = parts[1]
    }

    let aiResult
    try {
      aiResult = await analyzeSpaceImage(base64Data, actualMimeType, userPrompt)
    } catch (err) {
      console.error('[vision/analyze-space] Gemini Vision failed, using offline fallback. Error:', err.message || err)
      // Clean fallback configuration (1200x2000x600 wardrobe with 2 default modules)
      aiResult = {
        width: 1200,
        height: 2000,
        depth: 600,
        hasCountertop: false,
        modules: [
          { width: 600, numShelves: 3, numDrawers: 0, numDividers: 0 },
          { width: 600, numShelves: 0, numDrawers: 3, numDividers: 0 }
        ],
        obstacles: ['Fallback: Gemini Vision is currently offline. Using default B2B layout.'],
        source: 'vision-fallback'
      }
    }

    res.json({
      success: true,
      analysis: aiResult
    })
  } catch (err) {
    console.error('[vision/analyze-space] Critical Route Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos analizar la imagen. Intentá de nuevo.' })
  }
})

module.exports = router
