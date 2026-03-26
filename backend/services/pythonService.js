/**
 * Python Backend Proxy Service
 * Forwards TTS, STT, and Vision requests to the Python FastAPI backend.
 */

const cacheService = require('./cacheService');

const PYTHON_BACKEND = process.env.PYTHON_API_URL || 'http://localhost:8000';

function cleanText(text) {
    return text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[-•]\s*/gm, '')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\[[A-Z_]+:[^\]]*\]/g, '')
        .trim()
        .slice(0, 3000);
}

async function generateSpeech(text, language = 'en', forceEdge = false, voice = 'mia') {
    const clean = cleanText(text);
    if (!clean) return null;

    const cacheKey = cacheService.generateKey('tts', clean, language, voice);
    const cached = cacheService.get(cacheKey);
    if (cached) {
        console.log('📦 [TTS] Cache hit');
        return Buffer.from(cached);
    }

    try {
        console.log(`🔊 [TTS] Python backend — "${clean.slice(0, 40)}..." (${language})`);
        const response = await fetch(`${PYTHON_BACKEND}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, language, voice, force_edge: forceEdge }),
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`❌ [TTS] Python backend failed (${response.status}): ${errBody.slice(0, 200)}`);
            return null;
        }

        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length > 500) {
            console.log(`✅ [TTS] Audio: ${buf.length} bytes`);
            cacheService.set(cacheKey, buf, 86400);
            return buf;
        }
        return null;
    } catch (err) {
        console.warn('⚠️ [TTS] Python backend unavailable:', err.message);
        return null;
    }
}

async function transcribeAudio(audioBytes, mimeType = 'audio/ogg', language = 'en') {
    try {
        console.log(`🎙️ [STT] Python backend — ${audioBytes.length} bytes (${mimeType}, ${language})`);
        const response = await fetch(`${PYTHON_BACKEND}/api/stt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBytes.toString('base64'), mime_type: mimeType, language }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`⚠️ [STT] Python backend failed (${response.status}): ${err.slice(0, 100)}`);
            return null;
        }

        const data = await response.json();
        if (data.transcript) {
            console.log(`✅ [STT] Transcript: "${data.transcript.slice(0, 80)}"`);
            return data.transcript.trim();
        }
        return null;
    } catch (err) {
        console.warn('⚠️ [STT] Python backend unavailable:', err.message);
        return null;
    }
}

async function analyzeImage(base64Image, language = 'en') {
    try {
        console.log(`🧠 [Vision] Python backend — analyzing image (${language})...`);
        const response = await fetch(`${PYTHON_BACKEND}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image, language }),
            signal: AbortSignal.timeout(45000)
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`⚠️ [Vision] Python backend failed (${response.status}): ${err.slice(0, 100)}`);
            return { success: false, error: `Vision service error: ${response.status}` };
        }

        const data = await response.json();
        console.log(`✅ [Vision] Analysis: ${data.analysis?.disease_name} (${data.analysis?.crop_identified})`);
        return { success: data.success, analysis: data.analysis };
    } catch (err) {
        console.warn('⚠️ [Vision] Python backend unavailable:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { generateSpeech, transcribeAudio, analyzeImage };
