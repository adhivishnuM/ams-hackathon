/**
 * Voice Transcription Route (Enhanced)
 *
 * POST /transcribe
 * Accepts multipart form data with audio/text and conversation history.
 * Returns transcript, advisory, and optionally natural TTS audio.
 */

const express = require('express');
const multer = require('multer');
const transcriptionService = require('../services/transcriptionService');
const inferenceService = require('../services/inferenceService');
const { generateSpeech } = require('../services/openRouterService');
const { generateNvidiaSpeech } = require('../services/nvidiaTtsService');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

const uploadFields = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

router.post('/', uploadFields, async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`\n📥 [${requestId}] Received request`);

    try {
        let transcript = null;

        // 1. Check for Text Input (from Offline STT or Text Chat)
        if (req.body.text) {
            transcript = req.body.text;
            console.log(`📝 Received Text: "${transcript.slice(0, 50)}..."`);
        }
        // 2. Check for Audio File
        else if (req.files && req.files.audio) {
            const audioFile = req.files.audio[0];
            console.log(`🎤 Processing Audio: ${audioFile.originalname}`);
            try {
                const result = await transcriptionService.transcribe(audioFile.buffer, audioFile.mimetype);
                transcript = result.transcript;
            } catch (err) {
                console.error('❌ Transcription failed:', err);
                return res.status(503).json({ success: false, error: 'Transcription failed' });
            }
        }
        else {
            return res.status(400).json({ success: false, error: 'No input provided (text or audio)' });
        }

        // 3. Process Context
        const { language, weatherData, conversationHistory: historyJson } = req.body;

        let weatherContext;
        if (weatherData) {
            try { weatherContext = JSON.parse(weatherData); } catch (e) { }
        }

        // Parse conversation history for context-aware responses
        let conversationHistory = [];
        if (historyJson) {
            try {
                conversationHistory = JSON.parse(historyJson);
                console.log(`📜 Received ${conversationHistory.length} history items for context`);
            } catch (e) {
                console.log('⚠️ Failed to parse conversation history');
            }
        }

        console.log(`🌾 Inferring advice for: "${transcript}"`);

        // 4. Get Advisory (Local -> AI) with conversation history
        const advisory = await inferenceService.inferAdviceFromText(
            transcript,
            language,
            weatherContext,
            conversationHistory
        );

        // 5. Generate Natural TTS Audio (if OpenAI key is available)
        let audioBase64 = null;
        const useTts = req.body.useTts === 'true';
        const forceEdge = req.body.forceEdge === 'true';

        if (useTts) {
            let audioBuffer = null;

            // 1. Try NVIDIA TTS (New)
            if (process.env.NVIDIA_API_KEY) {
                console.log('🔊 Attempting NVIDIA TTS...');
                audioBuffer = await generateNvidiaSpeech(advisory.recommendation, language, forceEdge);
            }

            // 2. Fallback to existing TTS service (Python/Edge-TTS)
            if (!audioBuffer) {
                console.log('🔊 Using default TTS service...');
                audioBuffer = await generateSpeech(advisory.recommendation, language);
            }
            if (audioBuffer) {
                audioBase64 = audioBuffer.toString('base64');
            }
        }

        console.log(`✅ [${requestId}] Success`);

        // Save to Chat History
        try {
            const { saveChatItem } = require('../services/storageService');
            saveChatItem({
                id: requestId,
                conversationId: req.body.conversationId, // Grouping ID
                query: transcript,
                response: advisory.recommendation,
                timestamp: new Date().toISOString(),
                type: req.body.text ? 'text' : 'voice',
                weatherContext
            });
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }

        return res.json({
            success: true,
            transcript,
            advisory,
            audio: audioBase64 // Base64 MP3 audio (or null if TTS disabled/failed)
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Error:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
