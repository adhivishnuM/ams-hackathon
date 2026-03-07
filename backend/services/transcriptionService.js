/**
 * Transcription Service
 *
 * Uses Hugging Face Inference API (Whisper) for speech-to-text.
 * Same auth pattern as visionService: HF_TOKEN.
 */

// Use global fetch (Node 18+)
const WHISPER_URL =
    'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Transcribe audio buffer to text using HF Whisper.
 *
 * @param {Buffer} audioBuffer - Raw audio bytes (e.g. webm, wav)
 * @param {string} [contentType='audio/webm'] - MIME type of the audio
 * @returns {Promise<{ transcript: string }>}
 */
async function transcribe(audioBuffer, contentType = 'audio/webm') {
    const token = process.env.HF_TOKEN || process.env.HF_API_KEY;
    if (!token) {
        throw new Error('HF_TOKEN or HF_API_KEY is missing in environment variables');
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
    };

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Whisper attempt ${attempt}...`);

            const res = await fetch(WHISPER_URL, {
                method: 'POST',
                headers,
                body: audioBuffer,
            });

            console.log(`Whisper attempt ${attempt} response status: ${res.status}`);
            const raw = await res.text();
            console.log(`Whisper attempt ${attempt} raw response: ${raw.slice(0, 200)}${raw.length > 200 ? '...' : ''}`);
            console.log(`Whisper API status: ${res.status}`);

            if (res.status === 503 || raw.toLowerCase().includes('loading')) {
                const waitTime = 15000;
                console.log(`Whisper cold start/loading, waiting ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }

            if (!res.ok) {
                console.error('Whisper API Error Response:', raw.slice(0, 200));
                throw new Error(`Whisper HTTP ${res.status}: ${raw.slice(0, 100)}`);
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (parseError) {
                console.error('Failed to parse Whisper response:', raw.slice(0, 200));
                throw new Error('Invalid JSON response from Whisper API');
            }

            if (data && typeof data.text === 'string') {
                const transcript = data.text.trim();
                console.log('Whisper success, transcript length:', transcript.length);
                return { transcript };
            }

            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const text = data.transcription || data.text || '';
                if (typeof text === 'string') {
                    return { transcript: text.trim() };
                }
            }

            throw new Error('Unexpected Whisper response: ' + raw);
        } catch (e) {
            console.error('Whisper error:', e.message);
            if (attempt === 2) throw e;
        }
    }

    throw new Error('Transcription failed after retries');
}

module.exports = { transcribe };
