const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { generateSpeech } = require('../services/openRouterService');

/**
 * POST /api/chat/tts
 * Generate TTS for a given text
 */
router.post('/tts', async (req, res) => {
    try {
        const { text, language = 'en' } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, error: 'Text is required' });
        }

        const audioBuffer = await generateSpeech(text, language);
        if (audioBuffer) {
            return res.json({
                success: true,
                audio: audioBuffer.toString('base64')
            });
        }
        res.status(500).json({ success: false, error: 'Failed to generate speech' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/chat
 * Get chat history
 */
router.get('/', (req, res) => {
    try {
        const history = storageService.getChatHistory();
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/chat
 * Clear chat history
 */
router.delete('/', (req, res) => {
    try {
        storageService.clearChatHistory();
        res.json({
            success: true,
            message: 'Chat history cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
