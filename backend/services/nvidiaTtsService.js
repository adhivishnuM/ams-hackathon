/**
 * NVIDIA TTS Service (Node.js Native)
 * Uses NVIDIA Magpie Multilingual via gRPC-REST for English.
 * Uses edge-tts Node.js wrapper for Indian languages.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE_VOICE_MAP = {
    en: 'en-US-ChristopherNeural',
    hi: 'hi-IN-MadhurNeural',
    ta: 'ta-IN-ValluvarNeural',
    te: 'te-IN-MohanNeural',
    mr: 'mr-IN-ManoharNeural'
};

const cacheService = require('./cacheService');

/**
 * Clean text for TTS output.
 */
function cleanText(text) {
    return text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[-•]\s*/gm, '')
        .replace(/#{1,6}\s*/g, '')
        .trim()
        .slice(0, 4000);
}

/**
 * Generate audio via edge-tts CLI (npm package must be installed globally or as npx).
 */
function generateEdgeAudio(text, language = 'en') {
    return new Promise((resolve) => {
        const voice = EDGE_VOICE_MAP[language] || EDGE_VOICE_MAP.en;
        const tmpFile = path.join(os.tmpdir(), `agrotalk_tts_${Date.now()}.mp3`);
        console.log(`🎤 [TTS] Edge TTS (${voice}) for: "${text.slice(0, 40)}..."`);

        // Try npx edge-tts first, fall back to installed binary
        execFile('npx', ['-y', 'edge-tts', '--voice', voice, '--text', text, '--write-media', tmpFile],
            { timeout: 30000 },
            (err) => {
                if (err) {
                    console.warn('⚠️ [TTS] edge-tts via npx failed:', err.message);
                    resolve(null);
                    return;
                }
                try {
                    const buf = fs.readFileSync(tmpFile);
                    fs.unlinkSync(tmpFile);
                    console.log(`✅ [TTS] Edge audio: ${buf.length} bytes`);
                    resolve(buf);
                } catch (readErr) {
                    console.warn('⚠️ [TTS] Could not read edge-tts output:', readErr.message);
                    resolve(null);
                }
            }
        );
    });
}

/**
 * Generate audio via NVIDIA Magpie Multilingual (REST/NVCF).
 * Only called for English (all Indian languages use Edge TTS).
 */
async function generateNvidiaAudio(text, voice = 'mia') {
    const apiKey = process.env.NVIDIA_TTS_KEY;
    const functionId = process.env.NVIDIA_TTS_FUNCTION_ID;
    if (!apiKey || !functionId) return null;

    try {
        const voiceName = `Magpie-Multilingual.EN-US.${voice.charAt(0).toUpperCase() + voice.slice(1)}`;
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
                language_code: 'en-US',
                sample_rate_hz: 22050
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const err = await response.text();
            console.warn(`⚠️ [TTS] NVIDIA failed (${response.status}): ${err.slice(0, 100)}`);
            return null;
        }

        const buf = Buffer.from(await response.arrayBuffer());
        if (buf.length > 0) {
            console.log(`✅ [TTS] NVIDIA audio: ${buf.length} bytes`);
            return buf;
        }
        return null;
    } catch (err) {
        console.warn('⚠️ [TTS] NVIDIA exception:', err.message);
        return null;
    }
}

/**
 * Main TTS generation function.
 * @param {string} text - Text to synthesize
 * @param {string} language - Language code (en, hi, ta, te, mr)
 * @param {boolean} forceEdge - Force Edge TTS even for English
 * @param {string} voice - NVIDIA voice personality (mia, aria, sofia)
 * @returns {Promise<Buffer|null>}
 */
async function generateNvidiaSpeech(text, language = 'en', forceEdge = false, voice = 'mia') {
    const clean = cleanText(text);
    if (!clean) return null;

    const cacheKey = cacheService.generateKey('tts-native', clean, language, voice, forceEdge);
    const cached = cacheService.get(cacheKey);
    if (cached) {
        console.log('📦 [TTS] Cache hit');
        return Buffer.from(cached);
    }

    let audioBuffer = null;

    // English: try NVIDIA first, then Edge TTS
    if (language === 'en' && !forceEdge) {
        audioBuffer = await generateNvidiaAudio(clean, voice);
    }

    // Fallback to Edge TTS for all other languages or if NVIDIA failed
    if (!audioBuffer) {
        audioBuffer = await generateEdgeAudio(clean, language);
    }

    if (audioBuffer) {
        cacheService.set(cacheKey, audioBuffer, 86400); // cache 24h
    }

    return audioBuffer;
}

module.exports = { generateNvidiaSpeech };
