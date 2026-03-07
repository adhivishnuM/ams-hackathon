/**
 * AgroTalk Backend Server
 * 
 * Lightweight Express proxy for Hugging Face Vision API.
 * Solves CORS issues by making server-to-server API calls.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.openrouter') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.nvidia') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.openrouter') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.nvidia') });
const express = require('express');
const cors = require('cors');
const analyzeRoute = require('./routes/analyze');
const transcribeRoute = require('./routes/transcribe');
const libraryRoute = require('./routes/library');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors({
    origin: '*', // Allow all origins for local development flexibility
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies with increased size limit for images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Image analysis endpoint
app.use('/analyze-image', analyzeRoute);

// Weather forecast endpoint
const weatherRoute = require('./routes/weather');
app.use('/weather', weatherRoute);

// Voice transcription + advisory endpoint
app.use('/transcribe', transcribeRoute);

// Library CRUD endpoint
app.use('/library', libraryRoute);

// Chat History endpoint
const chatRoute = require('./routes/chat');
app.use('/chat', chatRoute);

// Market analysis endpoint
const marketRoute = require('./routes/market');
app.use('/market', marketRoute);

// Dedicated TTS endpoint
const ttsRoute = require('./routes/tts');
app.use('/api/tts', ttsRoute);

// Serve uploads as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🌱 AgroTalk Backend running on http://localhost:${PORT}`);
    console.log(`📡 Ready to analyze crop images`);

    if (!process.env.HF_TOKEN && !process.env.HF_API_KEY) {
        console.warn('⚠️  Warning: HF_TOKEN (or HF_API_KEY) not set in .env file');
    }

    if (process.env.OPENROUTER_API_KEY) {
        console.log('✅ OpenRouter AI Enabled');
    } else {
        console.warn('⚠️ OPENROUTER_API_KEY not found in env');
    }
});
