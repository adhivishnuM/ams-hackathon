/**
 * AgroTalk Backend Server (Consolidated - No Python Dependency)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const nvidiaVision = require('./services/nvidiaVisionService');
const { generateNvidiaSpeech } = require('./services/nvidiaTtsService');

// API Connectivity Test (Selective)
async function runSelfCheck() {
    console.log('\n🔍 [Self-Check] Verifying Hybrid AI Connectivity...');
    console.log('   (Waiting 3s for Python AI backend to initialize...)');
    await new Promise(r => setTimeout(r, 3000));

    // 1. OpenRouter (Direct)
    try {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error('Key missing');
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemini-2.0-flash-001', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
        });
        if (res.ok) console.log('✅ OpenRouter: Authentication successful');
        else console.warn(`❌ OpenRouter: ${res.status} ${res.statusText}`);
    } catch (e) { console.warn(`❌ OpenRouter: ${e.message}`); }

    // 2. NVIDIA Vision (via Python Hybrid)
    try {
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='; // 1x1 black pixel
        const result = await nvidiaVision.analyzeImage(testImage, 'en');
        if (result.success) console.log('✅ NVIDIA Vision (Hybrid): Connection successful');
        else console.warn(`❌ NVIDIA Vision (Hybrid): ${result.error}`);
    } catch (e) { console.warn(`❌ NVIDIA Vision (Hybrid): ${e.message}`); }

    // 3. NVIDIA TTS (via Python Hybrid)
    try {
        const audio = await generateNvidiaSpeech('test', 'en', false, 'mia');
        if (audio && audio.length > 0) console.log('✅ NVIDIA TTS (Hybrid): Connection successful');
        else console.warn('❌ NVIDIA TTS (Hybrid): Failed to generate test audio');
    } catch (e) { console.warn(`❌ NVIDIA TTS (Hybrid): ${e.message}`); }

    console.log('--- Hybrid Self-Check Complete ---\n');
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Routes
const analyzeRoute = require('./routes/analyze');
const transcribeRoute = require('./routes/transcribe');
const libraryRoute = require('./routes/library');
const weatherRoute = require('./routes/weather');
const chatRoute = require('./routes/chat');
const marketRoute = require('./routes/market');
const ttsRoute = require('./routes/tts');
const whatsappRoute = require('./routes/whatsapp');

// Firebase Admin (lazy init)
const { initFirebase } = require('./services/firebaseService');

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server and attach Socket.io
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Make io available globally so whatsapp_bridge can emit events
global.socketIO = io;

// Enable CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/analyze-image', analyzeRoute);
app.use('/weather', weatherRoute);
app.use('/transcribe', transcribeRoute);
app.use('/library', libraryRoute);
app.use('/chat', chatRoute);
app.use('/market', marketRoute);
app.use('/api/tts', ttsRoute);
app.use('/api/whatsapp', whatsappRoute);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Socket.io connection log
io.on('connection', (socket) => {
    console.log(`🔌 Frontend client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`🔌 Frontend client disconnected: ${socket.id}`));
});

// Start
httpServer.listen(PORT, () => {
    console.log(`🌱 AgroTalk Backend running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io enabled for real-time QR delivery`);
    if (process.env.OPENROUTER_API_KEY) console.log('✅ OpenRouter AI Enabled');
    if (process.env.NVIDIA_VISION_KEY) console.log('✅ NVIDIA Vision Enabled');
    if (process.env.NVIDIA_TTS_KEY) console.log('✅ NVIDIA TTS Enabled');
    if (process.env.NVIDIA_STT_KEY) console.log('✅ NVIDIA STT Enabled');
    initFirebase(); // Attempt Firebase init
    runSelfCheck(); // Test AI connectivity
});
