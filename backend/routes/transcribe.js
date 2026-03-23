/**
 * Voice Transcription Route
 */
const express = require('express');
const multer = require('multer');
const inferenceService = require('../services/inferenceService');
const { generateNvidiaSpeech } = require('../services/nvidiaTtsService');
const { transcribeAudio } = require('../services/nvidiaSttService');
const { saveChatItem } = require('../services/storageService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadFields = upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'image', maxCount: 1 }]);

router.post('/', uploadFields, async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`\n📥 [${requestId}] Transcribe request`);

    try {
        let transcript = null;

        if (req.body.text) {
            transcript = req.body.text;
        } else if (req.files?.audio) {
            const audioFile = req.files.audio[0];
            transcript = await transcribeAudio(audioFile.buffer, audioFile.mimetype, req.body.language || 'en');
            if (!transcript) return res.status(503).json({ success: false, error: 'Transcription failed' });
        } else {
            return res.status(400).json({ success: false, error: 'No input provided' });
        }

        const { language, weatherData, conversationHistory: historyJson } = req.body;
        let weatherContext;
        try { if (weatherData) weatherContext = JSON.parse(weatherData); } catch { }
        let conversationHistory = [];
        try { if (historyJson) conversationHistory = JSON.parse(historyJson); } catch { }

        const advisory = await inferenceService.inferAdviceFromText(transcript, language, weatherContext, conversationHistory);

        let audioBase64 = null;
        if (req.body.useTts === 'true') {
            const audioBuffer = await generateNvidiaSpeech(
                advisory.recommendation,
                language,
                false,
                req.body.voice || 'Mia'
            );
            if (audioBuffer) audioBase64 = audioBuffer.toString('base64');
        }

        // Save to Firestore (or local fallback) — non-blocking
        saveChatItem({
            id: requestId,
            conversationId: req.body.conversationId,
            query: transcript,
            response: advisory.recommendation,
            timestamp: new Date().toISOString(),
            type: req.body.text ? 'text' : 'voice',
            weatherContext
        }).catch(e => console.error('Failed to save chat:', e));

        return res.json({ success: true, transcript, advisory, audio: audioBase64 });

    } catch (error) {
        console.error(`❌ [${requestId}] Error:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
