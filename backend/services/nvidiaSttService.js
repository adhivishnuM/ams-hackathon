/**
 * NVIDIA STT Service (Cloud-Native Node.js)
 * Uses NVIDIA Parakeet ASR via REST API for speech-to-text.
 * Falls back to HuggingFace Whisper if NVIDIA key is not available.
 */

const NVIDIA_STT_URL = 'https://integrate.api.nvidia.com/v1/audio/transcriptions';

/**
 * Transcribe audio bytes to text via NVIDIA Parakeet ASR (Cloud).
 * @param {Buffer} audioBytes - Raw audio data
 * @param {string} mimeType - MIME type (audio/ogg, audio/webm, audio/wav, etc.)
 * @param {string} language - Language code (en, hi, ta, te, mr)
 * @returns {Promise<string|null>}
 */
async function transcribeAudio(audioBytes, mimeType = 'audio/ogg', language = 'en') {
    // Try NVIDIA Parakeet first
    const nvidiaKey = process.env.NVIDIA_STT_KEY;
    if (nvidiaKey) {
        try {
            console.log(`🎙️ [STT] Using NVIDIA Parakeet ASR (${language})...`);
            const result = await transcribeWithNvidia(audioBytes, mimeType, language, nvidiaKey);
            if (result) return result;
        } catch (err) {
            console.warn('⚠️ [STT] NVIDIA Parakeet failed:', err.message);
        }
    }

    // Fallback: HuggingFace Whisper
    const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
    if (hfToken) {
        try {
            console.log('🎙️ [STT] Falling back to HuggingFace Whisper...');
            const result = await transcribeWithWhisper(audioBytes, mimeType, hfToken);
            if (result) return result;
        } catch (err) {
            console.warn('⚠️ [STT] Whisper fallback failed:', err.message);
        }
    }

    console.error('❌ [STT] No transcription service available. Set NVIDIA_STT_KEY or HF_TOKEN.');
    return null;
}

/**
 * NVIDIA Parakeet ASR transcription
 */
async function transcribeWithNvidia(audioBytes, mimeType, language, apiKey) {
    // Determine file extension from mime type
    const extMap = {
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/x-wav': 'wav',
        'audio/flac': 'flac'
    };
    const ext = extMap[mimeType] || 'ogg';

    // Build multipart form data manually
    const boundary = '----FormBoundary' + Date.now().toString(36);
    const parts = [];

    // File part
    parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
    );
    parts.push(audioBytes);
    parts.push('\r\n');

    // Model part
    parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `nvidia/parakeet-ctc-1.1b-asr\r\n`
    );

    // Language part
    const langMap = { en: 'en', hi: 'hi', ta: 'ta', te: 'te', mr: 'mr' };
    parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language_code"\r\n\r\n` +
        `${langMap[language] || 'en'}\r\n`
    );

    parts.push(`--${boundary}--\r\n`);

    // Combine all parts into a single buffer
    const bodyParts = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
    const body = Buffer.concat(bodyParts);

    const response = await fetch(NVIDIA_STT_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: body,
        signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NVIDIA STT Error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const transcript = data.text || data.transcript || '';

    if (transcript) {
        console.log(`✅ [STT] NVIDIA transcript: "${transcript.slice(0, 80)}..."`);
        return transcript.trim();
    }

    return null;
}

/**
 * HuggingFace Whisper transcription (fallback)
 */
async function transcribeWithWhisper(audioBytes, mimeType, token) {
    const WHISPER_URL = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

    const response = await fetch(WHISPER_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': mimeType
        },
        body: audioBytes,
        signal: AbortSignal.timeout(60000)
    });

    if (response.status === 503) {
        console.warn('⚠️ [STT] Whisper model is loading, retrying in 15s...');
        await new Promise(r => setTimeout(r, 15000));

        const retry = await fetch(WHISPER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': mimeType
            },
            body: audioBytes,
            signal: AbortSignal.timeout(60000)
        });

        if (!retry.ok) return null;
        const data = await retry.json();
        return data.text?.trim() || null;
    }

    if (!response.ok) return null;

    const data = await response.json();
    return data.text?.trim() || null;
}

module.exports = { transcribeAudio };
