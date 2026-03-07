/**
 * NVIDIA TTS Service (Proxy to Python Backend)
 * 
 * Routes TTS requests to the Python backend which handles:
 * - NVIDIA gRPC TTS for English
 * - Edge TTS fallback for Indian languages (Hindi, Tamil, Telugu, Marathi)
 */

const PYTHON_TTS_URL = 'http://localhost:8000/api/tts';

/**
 * Generate speech audio by proxying to Python TTS service
 * 
 * @param {string} text - The text to convert to speech
 * @param {string} language - Language code (en, hi, ta, te, mr)
 * @returns {Buffer|null} - Audio buffer (mp3/wav) or null on failure
 */
async function generateNvidiaSpeech(text, language = 'en', forceEdge = false) {
    // Clean text for TTS (remove markdown formatting)
    const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^[-•]\s*/gm, '')
        .replace(/#{1,6}\s*/g, '')
        .trim();

    if (!cleanText) {
        console.warn('⚠️ Empty text provided to TTS');
        return null;
    }

    console.log(`🔊 [TTS Proxy] Requesting speech for: "${cleanText.slice(0, 30)}..." (${language}, forceEdge: ${forceEdge})`);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(PYTHON_TTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: cleanText.slice(0, 4000), // Max chars
                language: language,
                voice: 'mia', // Default voice for NVIDIA, ignored for Edge TTS
                force_edge: forceEdge
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errText = '';
            try {
                const errBody = await response.json();
                errText = JSON.stringify(errBody);
            } catch (e) {
                errText = await response.text();
            }
            console.error(`❌ Python TTS Error (${response.status}):`, errText);
            return null;
        }

        const data = await response.json();

        if (data.success && data.audio) {
            const audioBuffer = Buffer.from(data.audio, 'base64');
            console.log(`✅ Received audio buffer (${audioBuffer.length} bytes)`);
            return audioBuffer;
        }

        console.warn('⚠️ TTS returned success but no audio data');
        return null;

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.error('❌ TTS request timed out after 30 seconds');
        } else {
            console.error('❌ TTS Service Exception:', error.message);
        }

        return null;
    }
}

module.exports = { generateNvidiaSpeech };
