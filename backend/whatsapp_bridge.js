/**
 * AgroTalk WhatsApp Self-Message Bridge
 * ========================================
 * Connects to your WhatsApp account and listens ONLY for messages you
 * send to yourself ("Saved Messages" / "Me"). Routes them to the Python
 * FastAPI backend for AI processing and sends back formatted replies.
 *
 * Message routing:
 *   📷 Image  → NVIDIA Vision analysis → Plant health report
 *   🎙️ Audio  → Whisper STT → AI reply → TTS voice note
 *   💬 Text   → AI agricultural assistant → Formatted text reply
 *
 * Usage:
 *   node backend/whatsapp_bridge.js
 *
 * First run: Scan the QR code in your terminal with WhatsApp > Linked Devices
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8000';
const DEFAULT_LANGUAGE = 'en'; // Hardcoded default as per user request
const BOT_TAG = '\u200B'; // Zero-width space to tag bot messages and prevent loops

// ─────────────────────────────────────────────────────────────
// HTTP helper — sends JSON to the Python backend
// ─────────────────────────────────────────────────────────────
function postJson(url, body) {
    return new Promise((resolve, reject) => {
        const jsonBody = JSON.stringify(body);
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + (urlObj.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonBody),
            },
            timeout: 60000, // 60s timeout for AI calls
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: { error: data } });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        req.write(jsonBody);
        req.end();
    });
}

// ─────────────────────────────────────────────────────────────
// Message handler helpers
// ─────────────────────────────────────────────────────────────

/**
 * Determines if a message is from the user to themselves (self-message).
 * Works across different WhatsApp Web.js versions.
 */
function isSelfMessage(msg, client) {
    if (!client || !client.info || !client.info.wid) return false;
    const myNumber = client.info.wid._serialized;

    // Strict check: YOU sent it AND it was sent TO your own number
    return msg.fromMe === true && msg.from === myNumber && msg.to === myNumber;
}

/**
 * Handle a text message sent to yourself.
 */
async function handleText(msg, chat) {
    const text = msg.body.trim();
    if (!text) return;

    console.log(`💬 [Text] "${text.substring(0, 80)}"`);

    // Detect language hint in message (e.g. "[hi]" prefix)
    let language = DEFAULT_LANGUAGE;
    const langMatch = text.match(/^\[(en|hi|ta|te|mr)\]\s*/i);
    let cleanText = text;
    if (langMatch) {
        language = langMatch[1].toLowerCase();
        cleanText = text.slice(langMatch[0].length).trim();
    }

    try {
        // Show typing indicator in the background, don't await it to save latency
        chat.sendStateTyping().catch(() => { });

        const response = await postJson(`${PYTHON_API}/api/whatsapp/chat`, {
            text: cleanText,
            language
        });

        await chat.clearState();

        if (response.status === 200 && response.body.success) {
            await chat.sendMessage(response.body.reply + BOT_TAG);
            console.log(`✅ [Text] Reply sent (${response.body.reply.length} chars)`);
        } else {
            console.error(`❌ [Text] AI Error:`, response.body);
            await chat.sendMessage(`⚠️ *Error*: ${response.body.detail || response.body.error || 'Failed to process request.'}` + BOT_TAG);
        }
    } catch (err) {
        await chat.clearState();
        console.error(`❌ [Text] Connection Error:`, err.message);
        await chat.sendMessage(`⚠️ *Connection Error*: ${err.message}` + BOT_TAG);
    }
}

/**
 * Handle an image message sent to yourself.
 */
async function handleImage(msg, chat) {
    console.log('📷 [Image] Downloading media...');

    try {
        chat.sendStateTyping().catch(() => { });
        const media = await msg.downloadMedia();

        if (!media || !media.data) {
            await chat.sendMessage('⚠️ Could not download the image. Please try again.');
            return;
        }

        console.log(`📷 [Image] Downloaded ${media.mimetype} (${media.data.length} chars b64)`);

        // Detect language from caption if present
        let language = DEFAULT_LANGUAGE;
        const caption = msg.body || '';
        const langMatch = caption.match(/\[(en|hi|ta|te|mr)\]/i);
        if (langMatch) language = langMatch[1].toLowerCase();

        const response = await postJson(`${PYTHON_API}/api/whatsapp/analyze_image`, {
            image: media.data,
            language
        });

        await chat.clearState();

        if (response.status === 200 && response.body.success) {
            // Send the formatted text report
            await chat.sendMessage(response.body.reply + BOT_TAG);

            // If server returned a TTS audio, send it as voice note
            if (response.body.audio_b64) {
                const audioMedia = new MessageMedia(
                    'audio/mpeg',
                    response.body.audio_b64,
                    'analysis_summary.mp3'
                );
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
                console.log('🔊 [Image] Voice note sent');
            }

            console.log('✅ [Image] Analysis reply sent');
        } else {
            await chat.sendMessage(`⚠️ *Analysis Failed*\n\n_${response.body.detail || response.body.error || 'Unknown error'}_`);
        }
    } catch (err) {
        await chat.clearState();
        console.error('❌ [Image] Error:', err.message);
        await chat.sendMessage(`⚠️ *Image Analysis Error*\n\n\`${err.message}\``);
    }
}

/**
 * Handle a voice note / audio message sent to yourself.
 */
async function handleAudio(msg, chat) {
    console.log('🎙️ [Audio] Downloading voice note...');

    try {
        chat.sendStateRecording().catch(() => { });
        const media = await msg.downloadMedia();

        if (!media || !media.data) {
            await chat.sendMessage('⚠️ Could not download the audio. Please try again.');
            return;
        }

        console.log(`🎙️ [Audio] Downloaded ${media.mimetype} (${media.data.length} chars b64)`);

        const response = await postJson(`${PYTHON_API}/api/whatsapp/transcribe_and_reply`, {
            audio: media.data,
            mime_type: media.mimetype || 'audio/ogg',
            language: DEFAULT_LANGUAGE
        });

        await chat.clearState();

        if (response.status === 200 && response.body.success) {
            // Send the formatted text reply
            await chat.sendMessage(response.body.text_reply + BOT_TAG);

            // Send voice note reply if TTS generated audio
            if (response.body.audio_reply_b64) {
                const audioMedia = new MessageMedia(
                    'audio/mpeg',
                    response.body.audio_reply_b64,
                    'ai_reply.mp3'
                );
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
                console.log('🔊 [Audio] Voice reply sent');
            }

            console.log(`✅ [Audio] Transcript: "${response.body.transcript}"`);
        } else {
            console.error(`❌ [Audio] Error:`, response.body);
            await chat.sendMessage(`⚠️ *Audio Error*: ${response.body.detail || response.body.error || 'Transcription failed.'}` + BOT_TAG);
        }
    } catch (err) {
        await chat.clearState();
        console.error('❌ [Audio] Error:', err.message);
        await chat.sendMessage(`⚠️ *Connection Error*: ${err.message}` + BOT_TAG);
    }
}

// ─────────────────────────────────────────────────────────────
// WhatsApp Client Setup
// ─────────────────────────────────────────────────────────────

console.log('');
console.log('🌿 ═══════════════════════════════════════════════');
console.log('🌿  AgroTalk WhatsApp Bridge — Self-Message Mode  ');
console.log('🌿 ═══════════════════════════════════════════════');
console.log(`📡 Python API: ${PYTHON_API}`);
console.log(`🌐 Default Language: ${DEFAULT_LANGUAGE}`);
console.log('');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'agrotalk',
        dataPath: path.join(__dirname, '..', '.whatsapp_session')
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// QR code for first-time pairing
client.on('qr', (qr) => {
    console.log('');
    console.log('📱 Scan this QR code with WhatsApp:');
    console.log('   (WhatsApp → Settings → Linked Devices → Link a Device)');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
});

client.on('loading_screen', (percent, message) => {
    process.stdout.write(`\r⏳ Loading WhatsApp... ${percent}% - ${message}       `);
});

client.on('authenticated', () => {
    console.log('\n✅ WhatsApp authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp authentication failed:', msg);
    console.log('💡 Delete the .whatsapp_session folder and try again.');
    process.exit(1);
});

client.on('ready', () => {
    console.log('');
    console.log('✅ ════════════════════════════════════');
    console.log('✅  WhatsApp Bridge is READY!          ');
    console.log('✅ ════════════════════════════════════');
    console.log('');
    console.log('📋 How to use:');
    console.log('   1. Open WhatsApp on your phone');
    console.log('   2. Send a message to yourself (search "Me" or "Saved Messages")');
    console.log('   3. Send text, a photo, or a voice note');
    console.log('   4. AgroTalk AI will reply!');
    console.log('');
    console.log('🌐 Language hints (add to start of text):');
    console.log('   [en] English  [hi] Hindi  [ta] Tamil  [te] Telugu  [mr] Marathi');
    console.log('');
    console.log('⌨️  Press Ctrl+C to stop');
    console.log('');
});

// Core message handler
client.on('message_create', async (msg) => {
    // CRITICAL: Only handle self-messages
    if (!isSelfMessage(msg, client)) {
        return;
    }

    // AVOID SELF-LOOP: Ignore messages tagged with BOT_TAG
    if (msg.body && msg.body.endsWith(BOT_TAG)) {
        console.log(`⏭️  Ignoring bot's own message (tagged)`);
        return;
    }

    // Ignore status updates
    if (msg.isStatus) return;

    // Get the chat
    let chat;
    try {
        chat = await msg.getChat();
    } catch (err) {
        console.error('Could not get chat:', err.message);
        return;
    }

    const msgType = msg.type;
    console.log(`\n📨 [${new Date().toLocaleTimeString()}] Self-message received — Type: ${msgType}`);

    try {
        if (msgType === 'chat') {
            // Plain text
            await handleText(msg, chat);
        } else if (msgType === 'image' || msgType === 'sticker') {
            // Image or sticker photo
            await handleImage(msg, chat);
        } else if (msgType === 'audio' || msgType === 'ptt') {
            // Voice note (ptt = push-to-talk) or audio file
            await handleAudio(msg, chat);
        } else {
            console.log(`⏭️  Skipping unsupported message type: ${msgType}`);
        }
    } catch (err) {
        console.error(`❌ Unhandled error for type ${msgType}:`, err);
    }
});

client.on('disconnected', (reason) => {
    console.log('⚠️  WhatsApp disconnected:', reason);
    console.log('🔄 Reconnecting...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down WhatsApp bridge...');
    try {
        await client.destroy();
    } catch (e) { /* ignore */ }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    try {
        await client.destroy();
    } catch (e) { /* ignore */ }
    process.exit(0);
});

// Initialize
console.log('🔄 Initializing WhatsApp client...');
console.log('   (This may take 30-60 seconds on first run)\n');
client.initialize();
