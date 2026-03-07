/**
 * NVIDIA STT Service (Node.js Native)
 * Uses NVIDIA Riva / Whisper via gRPC for speech-to-text.
 * Falls back to Hugging Face Whisper if Riva gRPC is unavailable.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WHISPER_HF_URL = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

const LANG_MAP = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN'
};

const EXT_MAP = {
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/webm': '.webm',
    'audio/x-m4a': '.m4a'
};

/**
 * Convert audio to 16-bit mono 16kHz WAV using ffmpeg.
 */
function convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', outputPath],
            { timeout: 30000 },
            (err) => {
                if (err) reject(new Error(`FFmpeg failed: ${err.message}`));
                else resolve();
            });
    });
}

/**
 * Transcribe via Hugging Face Whisper (fallback).
 */
async function transcribeViaHF(audioBuffer, mimeType) {
    const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
    if (!hfToken) throw new Error('No HF token available');

    const response = await fetch(WHISPER_HF_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': mimeType || 'audio/webm'
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) throw new Error(`HF Whisper error: ${response.status}`);

    const data = await response.json();
    return data.text?.trim() || '';
}

/**
 * Transcribe audio bytes to text.
 * @param {Buffer} audioBytes - Raw audio data
 * @param {string} mimeType - MIME type
 * @param {string} language - Language code
 * @returns {Promise<string|null>}
 */
async function transcribeAudio(audioBytes, mimeType = 'audio/ogg', language = 'en') {
    const ext = EXT_MAP[mimeType] || '.ogg';
    const tmpIn = path.join(os.tmpdir(), `agrotalk_stt_in_${Date.now()}${ext}`);
    const tmpWav = path.join(os.tmpdir(), `agrotalk_stt_out_${Date.now()}.wav`);

    try {
        // Write input bytes to temp file
        fs.writeFileSync(tmpIn, audioBytes);
        console.log(`🎙️ [STT] Processing ${audioBytes.length} bytes (${mimeType})...`);

        // Convert to WAV
        try {
            await convertToWav(tmpIn, tmpWav);
        } catch (ffmpegErr) {
            console.warn('⚠️ [STT] FFmpeg failed, trying HF Whisper with original audio...');
            const transcript = await transcribeViaHF(audioBytes, mimeType);
            if (transcript) return transcript;
            throw ffmpegErr;
        }

        const wavBytes = fs.readFileSync(tmpWav);

        // Try NVIDIA Riva gRPC if available
        const sttKey = process.env.NVIDIA_STT_KEY;
        const functionId = process.env.NVIDIA_STT_FUNCTION_ID;
        if (sttKey && functionId) {
            try {
                // Riva gRPC requires the native client SDK, attempt via REST NVCF
                const langCode = LANG_MAP[language] || 'en-US';
                const response = await fetch(`https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/${functionId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sttKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        audio: wavBytes.toString('base64'),
                        language_code: langCode,
                        encoding: 'LINEAR_PCM',
                        sample_rate_hertz: 16000,
                        audio_channel_count: 1
                    }),
                    signal: AbortSignal.timeout(30000)
                });

                if (response.ok) {
                    const data = await response.json();
                    const transcript = data?.results?.[0]?.alternatives?.[0]?.transcript;
                    if (transcript) {
                        console.log(`✅ [STT] NVIDIA transcript: "${transcript.slice(0, 80)}"`);
                        return transcript;
                    }
                }
            } catch (nvidiaErr) {
                console.warn('⚠️ [STT] NVIDIA Riva REST failed, falling back to HF Whisper:', nvidiaErr.message);
            }
        }

        // Fallback to HF Whisper
        console.log('🔁 [STT] Using HF Whisper fallback...');
        const transcript = await transcribeViaHF(wavBytes, 'audio/wav');
        console.log(`✅ [STT] HF transcript: "${transcript.slice(0, 80)}"`);
        return transcript;

    } finally {
        [tmpIn, tmpWav].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { } });
    }
}

module.exports = { transcribeAudio };
