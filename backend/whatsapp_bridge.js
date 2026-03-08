/**
 * AgroTalk WhatsApp Bridge (Consolidated — Firebase Session + Socket.io QR)
 * ============================================================================
 * - Connects to WhatsApp and listens for self-messages.
 * - ALL AI processing done via internal Node.js backend (no Python needed).
 * - WhatsApp session stored in Firebase Storage for persistence.
 * - QR code delivered to frontend via Socket.io in real-time.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');

// Internal Node.js services (no Python needed)
const { getAgriAdvice } = require('./services/openRouterService');
const nvidiaVision = require('./services/nvidiaVisionService');
const { generateNvidiaSpeech } = require('./services/nvidiaTtsService');
const { transcribeAudio } = require('./services/nvidiaSttService');

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const DEFAULT_LANGUAGE = process.env.WHATSAPP_LANGUAGE || 'en';
const BOT_TAG = '\u200B'; // Zero-width space to prevent loops
let lastBotMediaTimestamp = 0;

// ─────────────────────────────────────────────────────────────
// Helper: get Socket.io instance from main server
// ─────────────────────────────────────────────────────────────
function getIO() {
    return global.socketIO || null;
}

// ─────────────────────────────────────────────────────────────
// Firebase Session Backup/Restore
// ─────────────────────────────────────────────────────────────
const SESSION_DIR = path.join(__dirname, '..', '.whatsapp_session');

async function backupSessionToFirebase() {
    try {
        const { getStorage } = require('./services/firebaseService');
        const storageInstance = getStorage();
        if (!storageInstance) return;

        // Zip the session directory
        const archiver = require('archiver');
        const tmpZip = path.join(os.tmpdir(), 'wa_session.zip');
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(tmpZip);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(SESSION_DIR, false);
            archive.finalize();
        });

        await storageInstance.bucket().upload(tmpZip, { destination: 'whatsapp_session/session.zip' });
        fs.unlinkSync(tmpZip);
        console.log('✅ [WhatsApp] Session backed up to Firebase Storage');
    } catch (err) {
        console.warn('⚠️ [WhatsApp] Session backup failed:', err.message);
    }
}

async function restoreSessionFromFirebase() {
    try {
        const { getStorage } = require('./services/firebaseService');
        const storageInstance = getStorage();
        if (!storageInstance) return false;

        const tmpZip = path.join(os.tmpdir(), 'wa_session_restore.zip');
        const file = storageInstance.bucket().file('whatsapp_session/session.zip');
        const [exists] = await file.exists();
        if (!exists) return false;

        await file.download({ destination: tmpZip });

        // Unzip into session directory
        const unzipper = require('unzipper');
        if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
        await fs.createReadStream(tmpZip)
            .pipe(unzipper.Extract({ path: SESSION_DIR }))
            .promise();

        fs.unlinkSync(tmpZip);
        console.log('✅ [WhatsApp] Session restored from Firebase Storage');
        return true;
    } catch (err) {
        console.warn('⚠️ [WhatsApp] Session restore failed:', err.message);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// Helper: Is this a self-message?
// ─────────────────────────────────────────────────────────────
function isSelfMessage(msg, client) {
    if (!client?.info?.wid) return false;
    const myNumber = client.info.wid._serialized;
    return msg.fromMe === true && msg.from === myNumber && msg.to === myNumber;
}

// ─────────────────────────────────────────────────────────────
// Message Handlers
// ─────────────────────────────────────────────────────────────
async function handleText(msg, chat) {
    const text = msg.body.trim();
    if (!text) return;
    console.log(`\n💬 [WhatsApp Text] "${text.slice(0, 80)}"`);

    let language = DEFAULT_LANGUAGE;
    let cleanText = text;
    const langMatch = text.match(/^\[(en|hi|ta|te|mr)\]\s*/i);
    if (langMatch) { language = langMatch[1].toLowerCase(); cleanText = text.slice(langMatch[0].length).trim(); }

    try {
        chat.sendStateTyping().catch(() => { });
        const result = await getAgriAdvice(cleanText, null, null, null, language, []);
        await chat.clearState();
        const reply = result?.text || '⚠️ Could not process your request.';
        await chat.sendMessage(reply + BOT_TAG);
        console.log(`✅ [WhatsApp Text] Reply sent (${reply.length} chars)`);
    } catch (err) {
        await chat.clearState();
        console.error('❌ [WhatsApp Text] Error:', err.message);
        await chat.sendMessage(`⚠️ Error: ${err.message}` + BOT_TAG);
    }
}

async function handleImage(msg, chat) {
    console.log('📷 [WhatsApp Image] Processing...');
    try {
        chat.sendStateTyping().catch(() => { });
        const media = await msg.downloadMedia();
        if (!media?.data) {
            await chat.sendMessage('⚠️ Could not download the image.');
            return;
        }

        let language = DEFAULT_LANGUAGE;
        const langMatch = (msg.body || '').match(/\[(en|hi|ta|te|mr)\]/i);
        if (langMatch) language = langMatch[1].toLowerCase();

        const visionResult = await nvidiaVision.analyzeImage(media.data, language);
        await chat.clearState();

        if (!visionResult.success) {
            await chat.sendMessage(`⚠️ Analysis Failed: ${visionResult.error}`);
            return;
        }

        const a = visionResult.analysis;
        const replyText = [
            `🌿 *AgroTalk Plant Analysis*`,
            ``,
            `*Crop:* ${a.crop_identified || 'Plant'}`,
            `*Condition:* ${a.disease_name || 'Unknown'}`,
            `*Severity:* ${a.severity || 'N/A'} | *Confidence:* ${a.confidence || 'N/A'}%`,
            a.description ? `\n*Details:* ${a.description}` : '',
            a.symptoms?.length ? `\n*Symptoms:*\n${a.symptoms.slice(0, 3).map(s => `• ${s}`).join('\n')}` : '',
            a.treatment_steps?.length ? `\n*Treatment:*\n${a.treatment_steps.slice(0, 3).map(s => `• ${s}`).join('\n')}` : '',
        ].filter(Boolean).join('\n');

        await chat.sendMessage(replyText + BOT_TAG);

        // TTS voice note
        try {
            const spokenText = `Analysis complete. Crop: ${a.crop_identified}. Condition: ${a.disease_name}. ${(a.description || '').slice(0, 200)}`;
            const audioBuffer = await generateNvidiaSpeech(spokenText, language, true);
            if (audioBuffer) {
                await new Promise(r => setTimeout(r, 500));
                const audioMedia = new MessageMedia('audio/mp3', audioBuffer.toString('base64'), 'analysis.mp3');
                lastBotMediaTimestamp = Date.now();
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
                console.log('🔊 [WhatsApp Image] Voice note sent');
            }
        } catch (ttsErr) {
            console.warn('⚠️ [WhatsApp Image] TTS failed:', ttsErr.message);
        }
        console.log('✅ [WhatsApp Image] Done');
    } catch (err) {
        await chat.clearState();
        console.error('❌ [WhatsApp Image] Error:', err.message);
        await chat.sendMessage(`⚠️ Image Error: ${err.message}` + BOT_TAG);
    }
}

async function handleAudio(msg, chat) {
    console.log('🎙️ [WhatsApp Audio] Processing...');
    try {
        chat.sendStateRecording().catch(() => { });
        const media = await msg.downloadMedia();
        if (!media?.data) {
            await chat.sendMessage('⚠️ Could not download audio.');
            return;
        }

        const audioBytes = Buffer.from(media.data, 'base64');
        const transcript = await transcribeAudio(audioBytes, media.mimetype || 'audio/ogg', DEFAULT_LANGUAGE);
        await chat.clearState();

        if (!transcript) {
            await chat.sendMessage(`⚠️ Could not transcribe audio.` + BOT_TAG);
            return;
        }

        const result = await getAgriAdvice(transcript, null, null, null, DEFAULT_LANGUAGE, []);
        const textReply = result?.text || 'Could not process your request.';
        await chat.sendMessage(textReply + BOT_TAG);

        // TTS voice reply
        try {
            const audioBuffer = await generateNvidiaSpeech(textReply, DEFAULT_LANGUAGE, true);
            if (audioBuffer) {
                await new Promise(r => setTimeout(r, 500));
                const audioMedia = new MessageMedia('audio/mp3', audioBuffer.toString('base64'), 'reply.mp3');
                lastBotMediaTimestamp = Date.now();
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
            }
        } catch (ttsErr) {
            console.warn('⚠️ [WhatsApp Audio] TTS failed:', ttsErr.message);
        }

        console.log(`✅ [WhatsApp Audio] Transcript: "${transcript.slice(0, 80)}"`);
    } catch (err) {
        await chat.clearState();
        console.error('❌ [WhatsApp Audio] Error:', err.message);
        await chat.sendMessage(`⚠️ Audio Error: ${err.message}` + BOT_TAG);
    }
}

// ─────────────────────────────────────────────────────────────
// WhatsApp Client Setup
// ─────────────────────────────────────────────────────────────
console.log('\n🌿 ══════════════════════════════════════════════════');
console.log('🌿  AgroTalk WhatsApp Bridge (Consolidated Mode)     ');
console.log('🌿 ══════════════════════════════════════════════════');
console.log(`🌐 Default Language: ${DEFAULT_LANGUAGE}`);
console.log('');

async function startBridge() {
    // Try to restore Firebase session before initializing client
    await restoreSessionFromFirebase();

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: 'agrotalk',
            dataPath: path.join(__dirname, '..', '.whatsapp_session')
        }),
        puppeteer: {
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--no-first-run',
                '--no-zygote',
                '--disable_gpu'
            ]
        }
    });

    // QR code → print to terminal AND emit to frontend via Socket.io
    client.on('qr', (qr) => {
        console.log('\n📱 Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });

        const io = getIO();
        if (io) {
            io.emit('whatsapp-qr', { qr });
            console.log('📡 [Socket.io] QR emitted to frontend');
        }
    });

    client.on('loading_screen', (percent, message) => {
        process.stdout.write(`\r⏳ Loading WhatsApp... ${percent}% - ${message}       `);
    });

    client.on('authenticated', () => {
        console.log('\n✅ WhatsApp authenticated!');
        const io = getIO();
        if (io) io.emit('whatsapp-status', { status: 'authenticated' });
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp auth failed:', msg);
        const io = getIO();
        if (io) io.emit('whatsapp-status', { status: 'auth_failure', message: msg });
    });

    client.on('ready', () => {
        console.log('\n✅ WhatsApp Bridge READY!');
        const io = getIO();
        if (io) io.emit('whatsapp-status', { status: 'ready' });
        // Backup session to Firebase after successful connection
        setTimeout(() => backupSessionToFirebase(), 5000);
    });

    client.on('disconnected', (reason) => {
        console.log('⚠️ WhatsApp disconnected:', reason);
        const io = getIO();
        if (io) io.emit('whatsapp-status', { status: 'disconnected', reason });
    });

    // Core message handler
    client.on('message_create', async (msg) => {
        if (!isSelfMessage(msg, client)) return;
        if (msg.body?.endsWith(BOT_TAG)) return;
        if ((msg.type === 'audio' || msg.type === 'ptt') && (Date.now() - lastBotMediaTimestamp < 8000)) return;
        if (msg.isStatus) return;

        let chat;
        try { chat = await msg.getChat(); } catch (err) { return; }

        console.log(`\n📨 [${new Date().toLocaleTimeString()}] Self-message — Type: ${msg.type}`);

        try {
            if (msg.type === 'chat') await handleText(msg, chat);
            else if (msg.type === 'image' || msg.type === 'sticker') await handleImage(msg, chat);
            else if (msg.type === 'audio' || msg.type === 'ptt') await handleAudio(msg, chat);
        } catch (err) {
            console.error(`❌ Unhandled error (${msg.type}):`, err);
        }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await backupSessionToFirebase();
        try { await client.destroy(); } catch (_) { }
        process.exit(0);
    });

    console.log('🔄 Initializing WhatsApp client...\n');
    client.initialize();
}

startBridge().catch(console.error);
