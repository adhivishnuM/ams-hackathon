/**
 * AgroTalk Backend Server (Consolidated - No Python Dependency)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

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
});
