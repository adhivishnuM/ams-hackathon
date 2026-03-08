/**
 * NVIDIA STT Service (Hybrid Mode)
 * Proxies transcription requests to the Python AI backend on port 8000.
 */

/**
 * Transcribe audio bytes to text via the Python backend.
 * @param {Buffer} audioBytes - Raw audio data
 * @param {string} mimeType - MIME type
 * @param {string} language - Language code
 * @returns {Promise<string|null>}
 */
async function transcribeAudio(audioBytes, mimeType = 'audio/ogg', language = 'en') {
    try {
        console.log(`🎙️ [STT Hybrid] Delegating transcription to Python (Port 8000)...`);

        const response = await fetch('http://localhost:8000/api/whatsapp/audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio: audioBytes.toString('base64'),
                mime_type: mimeType,
                language: language
            }),
            signal: AbortSignal.timeout(180000) // 3 minute timeout for long audio
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ [STT Hybrid] Python Error (${response.status}): ${errText.slice(0, 100)}`);
            return null;
        }

        const data = await response.json();

        if (data.success && data.transcript) {
            console.log(`✅ [STT Hybrid] Transcript received: "${data.transcript.slice(0, 80)}..."`);
            return data.transcript;
        } else {
            console.warn('⚠️ [STT Hybrid] Python returned success=false:', data.error || 'Unknown error');
            return null;
        }

    } catch (err) {
        console.error('❌ [STT Hybrid] Request failed:', err.message);
        return null;
    }
}

module.exports = { transcribeAudio };
