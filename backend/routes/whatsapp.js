/**
 * WhatsApp API Route
 * Provides endpoints that the WhatsApp bridge calls for AI processing.
 * These mirror the Python backend's /api/whatsapp/* endpoints.
 */
const express = require('express');
const router = express.Router();
const { getAgriAdvice } = require('../services/openRouterService');
const { analyzeImage, generateSpeech, transcribeAudio } = require('../services/pythonService');

// POST /api/whatsapp/chat
router.post('/chat', async (req, res) => {
    const { text, language = 'en' } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });

    try {
        const result = await getAgriAdvice(text, null, null, null, language, []);
        const reply = result?.text || 'I could not process your request. Please try again.';
        return res.json({ success: true, reply });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/whatsapp/image
router.post('/image', async (req, res) => {
    const { image, language = 'en' } = req.body;
    if (!image) return res.status(400).json({ success: false, error: 'image is required' });

    try {
        const visionResult = await analyzeImage(image, language);
        if (!visionResult.success) {
            return res.json({ success: false, reply: '⚠️ Image analysis failed.' });
        }

        const analysis = visionResult.analysis;
        const replyLines = [
            `🌿 *AgroTalk Plant Analysis*`,
            ``,
            `*Crop:* ${analysis.crop_identified || 'Plant'}`,
            `*Condition:* ${analysis.disease_name || 'Unknown'}`,
            `*Severity:* ${analysis.severity || 'N/A'}`,
            `*Confidence:* ${analysis.confidence || 'N/A'}%`,
            ``,
            analysis.description ? `*Details:* ${analysis.description}` : '',
            analysis.symptoms?.length ? `\n*Symptoms:*\n${analysis.symptoms.slice(0, 3).map(s => `• ${s}`).join('\n')}` : '',
            analysis.treatment_steps?.length ? `\n*Treatment:*\n${analysis.treatment_steps.slice(0, 3).map(s => `• ${s}`).join('\n')}` : '',
        ].filter(Boolean).join('\n');

        // Generate TTS voice note
        let audio_b64 = null;
        try {
            const spokenText = `Plant analysis complete. Crop: ${analysis.crop_identified}. Condition: ${analysis.disease_name}. ${(analysis.description || '').slice(0, 200)}`;
            const audioBuffer = await generateSpeech(spokenText, language, true); // force edge for WhatsApp MP3
            if (audioBuffer) audio_b64 = audioBuffer.toString('base64');
        } catch (ttsErr) {
            console.warn('⚠️ [WhatsApp Image] TTS failed:', ttsErr.message);
        }

        return res.json({ success: true, reply: replyLines, audio_b64 });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/whatsapp/audio
router.post('/audio', async (req, res) => {
    const { audio, mime_type = 'audio/ogg', language = 'en' } = req.body;
    if (!audio) return res.status(400).json({ success: false, error: 'audio is required' });

    try {
        const audioBytes = Buffer.from(audio, 'base64');
        const transcript = await transcribeAudio(audioBytes, mime_type, language);

        if (!transcript) {
            return res.json({ success: false, error: 'Transcription failed' });
        }

        // Get AI reply
        const result = await getAgriAdvice(transcript, null, null, null, language, []);
        const text_reply = result?.text || 'I could not process your audio. Please try again.';

        // Generate TTS reply
        let audio_reply_b64 = null;
        try {
            const audioBuffer = await generateSpeech(text_reply, language, true);
            if (audioBuffer) audio_reply_b64 = audioBuffer.toString('base64');
        } catch (ttsErr) {
            console.warn('⚠️ [WhatsApp Audio] TTS failed:', ttsErr.message);
        }

        return res.json({ success: true, transcript, text_reply, audio_reply_b64 });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
