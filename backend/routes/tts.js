const express = require('express');
const { generateNvidiaSpeech } = require('../services/nvidiaTtsService');
const router = express.Router();

/**
 * POST /tts
 * Accepts { text, language }
 * Returns audio/mpeg stream
 */
router.post('/', async (req, res) => {
    const { text, language, forceEdge } = req.body;

    if (!text) {
        return res.status(400).json({ success: false, error: 'Text is required' });
    }

    try {
        const audioBuffer = await generateNvidiaSpeech(text, language || 'en', forceEdge || false);

        if (!audioBuffer) {
            return res.status(500).json({ success: false, error: 'TTS generation failed' });
        }

        const isWav = audioBuffer.slice(0, 4).toString() === 'RIFF';
        const contentType = isWav ? 'audio/wav' : 'audio/mpeg';

        res.set({
            'Content-Type': contentType,
            'Content-Length': audioBuffer.length
        });

        res.send(audioBuffer);
    } catch (error) {
        console.error('❌ TTS Route Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
