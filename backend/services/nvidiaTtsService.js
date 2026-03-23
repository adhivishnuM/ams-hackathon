/**
 * NVIDIA TTS Service — Production Build
 *
 * Priority:
 * 1. NVIDIA Magpie Multilingual (REST, all languages if configured)
 * 2. Google TTS API (free, pure JS, no CLI or child process)
 */

const googleTTS = require('google-tts-api');
const cacheService = require('./cacheService');

// Voice map for NVIDIA Magpie Multilingual
const NVIDIA_VOICE_MAP = {
    en: 'Magpie-Multilingual.EN-US.Mia',
    hi: 'Magpie-Multilingual.HI-IN.Aarav',
    ta: 'Magpie-Multilingual.TA-IN.Aasha',
    te: 'Magpie-Multilingual.TE-IN.Aarav',
    mr: 'Magpie-Multilingual.MR-IN.Aarav'
};

// Google TTS language codes
const GOOGLE_LANG_MAP = {
    en: 'en',
    hi: 'hi',
    ta: 'ta',
    te: 'te',
    mr: 'mr'
};

/**
 * Clean text for TTS — strip markdown formatting.
 */
function cleanText(text) {
    return text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[-•]\s*/gm, '')
        .replace(/#{1,6}\s*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip markdown links
        .trim()
        .slice(0, 3000); // Google TTS limit
}

/**
 * NVIDIA Magpie Multilingual TTS via NVCF REST API.
 * Works for all languages — pure HTTPS, no gRPC, no Python.
 */
async function generateNvidiaAudio(text, language = 'en', voice = 'Mia') {
    const apiKey = process.env.NVIDIA_TTS_KEY;
    const functionId = process.env.NVIDIA_TTS_FUNCTION_ID;
    if (!apiKey || !functionId) return null;

    // Use the full voice name from map, or construct it
    const voiceName = NVIDIA_VOICE_MAP[language]
        || `Magpie-Multilingual.EN-US.${voice.charAt(0).toUpperCase() + voice.slice(1)}`;

    try {
        console.log(`🔊 [TTS] NVIDIA Magpie (${voiceName}) — "${text.slice(0, 40)}..."`);
        const response = await fetch(`https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/${functionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/wav'
            },
            body: JSON.stringify({
                text,
                voice_name: voiceName,
                language_code: language === 'en' ? 'en-US' :
                               language === 'hi' ? 'hi-IN' :
                               language === 'ta' ? 'ta-IN' :
                               language === 'te' ? 'te-IN' :
                               language === 'mr' ? 'mr-IN' : 'en-US',
                sample_rate_hz: 22050
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`⚠️ [TTS] NVIDIA failed (${response.status}): ${err.slice(0, 150)}`);
            return null;
        }

        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length > 1000) {
            console.log(`✅ [TTS] NVIDIA audio: ${buf.length} bytes`);
            return buf;
        }
        console.warn(`⚠️ [TTS] NVIDIA returned empty/tiny buffer (${buf.length} bytes)`);
        return null;
    } catch (err) {
        console.warn('⚠️ [TTS] NVIDIA exception:', err.message);
        return null;
    }
}

/**
 * Google TTS fallback — pure JS, no CLI, works on Render free tier.
 * Handles text > 200 chars by splitting automatically.
 */
async function generateGoogleAudio(text, language = 'en') {
    try {
        const lang = GOOGLE_LANG_MAP[language] || 'en';
        console.log(`🔊 [TTS] Google TTS fallback (${lang}) — "${text.slice(0, 40)}..."`);

        // getAllAudioBase64 handles long text by splitting
        const results = await googleTTS.getAllAudioBase64(text, {
            lang,
            slow: false,
            timeout: 15000
        });

        if (!results || results.length === 0) return null;

        // Concatenate all base64 chunks into one buffer
        const buffers = results.map(r => Buffer.from(r.base64, 'base64'));
        const combined = Buffer.concat(buffers);
        console.log(`✅ [TTS] Google audio: ${combined.length} bytes`);
        return combined;
    } catch (err) {
        console.warn('⚠️ [TTS] Google TTS failed:', err.message);
        return null;
    }
}

/**
 * Main TTS function.
 * @param {string} text
 * @param {string} language - en, hi, ta, te, mr
 * @param {boolean} forceGoogle - skip NVIDIA and use Google directly
 * @param {string} voice - NVIDIA voice name fragment (Mia, Aria, Sofia)
 */
async function generateNvidiaSpeech(text, language = 'en', forceGoogle = false, voice = 'Mia') {
    const clean = cleanText(text);
    if (!clean) return null;

    const cacheKey = cacheService.generateKey('tts', clean, language, voice, forceGoogle);
    const cached = cacheService.get(cacheKey);
    if (cached) {
        console.log('📦 [TTS] Cache hit');
        return Buffer.from(cached);
    }

    let audioBuffer = null;

    // Priority 1: NVIDIA (best quality, all languages)
    if (!forceGoogle) {
        audioBuffer = await generateNvidiaAudio(clean, language, voice);
    }

    // Priority 2: Google TTS (free, pure JS, good quality)
    if (!audioBuffer) {
        audioBuffer = await generateGoogleAudio(clean, language);
    }

    if (audioBuffer) {
        cacheService.set(cacheKey, audioBuffer, 86400); // cache 24h
    }

    return audioBuffer;
}

module.exports = { generateNvidiaSpeech };
