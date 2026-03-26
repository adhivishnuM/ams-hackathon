/**
 * AgroTalk Backend Server — Lean Production Build
 * Pure Node.js, no Python, no WhatsApp, no Puppeteer.
 */

const path = require('path');
const fs = require('fs');

// Load .env: prefer local (Render deployment), fallback to parent (local dev)
const localEnv = path.resolve(__dirname, '.env');
const parentEnv = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(localEnv) ? localEnv : parentEnv });

const express = require('express');
const cors = require('cors');

// Routes
const analyzeRoute = require('./routes/analyze');
const transcribeRoute = require('./routes/transcribe');
const libraryRoute = require('./routes/library');
const weatherRoute = require('./routes/weather');
const chatRoute = require('./routes/chat');
const marketRoute = require('./routes/market');
const ttsRoute = require('./routes/tts');


const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow any origin (frontend can be anywhere)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            openrouter: !!process.env.OPENROUTER_API_KEY,
            nvidia_vision: !!process.env.NVIDIA_VISION_KEY,
            nvidia_tts: !!process.env.NVIDIA_TTS_KEY,
            nvidia_stt: !!process.env.NVIDIA_STT_KEY,
            mandi: !!process.env.MANDI_API_KEY
        }
    });
});

// API Routes
app.use('/analyze-image', analyzeRoute);
app.use('/weather', weatherRoute);
app.use('/transcribe', transcribeRoute);
app.use('/library', libraryRoute);
app.use('/chat', chatRoute);
app.use('/market', marketRoute);
app.use('/api/tts', ttsRoute);

// Serve uploads (local only)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start
app.listen(PORT, () => {
    console.log(`\n🌱 AgroTalk Backend running on port ${PORT}`);
    console.log(`   OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✅' : '❌ missing'}`);
    console.log(`   NVIDIA Vision: ${process.env.NVIDIA_VISION_KEY ? '✅' : '❌ missing'}`);
    console.log(`   NVIDIA TTS: ${process.env.NVIDIA_TTS_KEY ? '✅' : '❌ missing'}`);
    console.log(`   NVIDIA STT: ${process.env.NVIDIA_STT_KEY ? '✅' : '❌ missing'}`);
    console.log(`   Mandi API: ${process.env.MANDI_API_KEY ? '✅' : '❌ missing'}`);
    console.log(`   Firebase: ❌ removed — using local storage\n`);

    // Pre-warm Python backend connection so first TTS/STT request is instant
    const PYTHON_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';
    const tryWarm = (attempts = 0) => {
        fetch(`${PYTHON_URL}/`, { signal: AbortSignal.timeout(2000) })
            .then(() => console.log('   Python backend: ✅ warm'))
            .catch(() => {
                if (attempts < 10) setTimeout(() => tryWarm(attempts + 1), 2000);
            });
    };
    setTimeout(tryWarm, 1000);
});
