const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { generateNvidiaSpeech } = require('../services/nvidiaTtsService');

/**
 * POST /chat/tts — Generate TTS for text
 */
router.post('/tts', async (req, res) => {
    try {
        const { text, language = 'en' } = req.body;
        if (!text) return res.status(400).json({ success: false, error: 'Text is required' });

        const audioBuffer = await generateNvidiaSpeech(text, language);
        if (audioBuffer) {
            return res.json({ success: true, audio: audioBuffer.toString('base64') });
        }
        res.status(500).json({ success: false, error: 'Failed to generate speech' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /chat — Get shared chat history (Firestore or local)
 */
router.get('/', async (req, res) => {
    try {
        const history = await storageService.getChatHistory();
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /chat — Clear all chat history
 */
router.delete('/', async (req, res) => {
    try {
        await storageService.clearChatHistory();
        res.json({ success: true, message: 'Chat history cleared' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
