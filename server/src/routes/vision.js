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

    const aiResult = await analyzeSpaceImage(base64Data, actualMimeType, userPrompt)

    res.json({
      success: true,
      analysis: aiResult
    })
  } catch (err) {
    console.error('[vision/analyze-space] Error:', err.message)
    res.status(500).json({ success: false, error: 'Error analizando la imagen espacial.', detail: err.message })
  }
})

module.exports = router
