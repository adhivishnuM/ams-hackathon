/**
 * Image Analysis Route (Updated to use NVIDIA Vision natively)
 */
const express = require('express');
const multer = require('multer');
const { analyzeImage } = require('../services/pythonService');
const inferenceService = require('../services/inferenceService');
const storageService = require('../services/storageService');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
    }
});

// POST /analyze-image (multipart/form-data with 'image' field)
router.post('/', upload.single('image'), async (req, res) => {
    console.log('\n📥 Received image analysis request');

    try {
        if (!req.file && !req.body.image) {
            return res.status(400).json({ success: false, error: 'No image provided.' });
        }

        const language = req.body.language || 'en';
        let base64Image;

        if (req.file) {
            base64Image = req.file.buffer.toString('base64');
        } else {
            base64Image = req.body.image; // Base64 direct from WhatsApp bridge
        }

        console.log(`📷 Analyzing image (lang: ${language})...`);

        // Use NVIDIA Vision (fully native Node.js)
        const result = await analyzeImage(base64Image, language);

        if (!result.success) {
            return res.status(503).json({ success: false, error: result.error || 'Vision analysis failed' });
        }

        return res.json({
            success: true,
            analysis: result.analysis,
            timestamp: new Date().toISOString(),
            mode: 'nvidia'
        });

    } catch (error) {
        console.error('❌ analyze-image error:', error);
        return res.status(500).json({ success: false, error: 'Failed to process image.' });
    }
});

// POST /analyze-image/base64 (JSON body with base64 image)
router.post('/base64', async (req, res) => {
    const { image, language = 'en', cropType } = req.body;
    if (!image) return res.status(400).json({ success: false, error: 'No image data provided' });

    try {
        const result = await analyzeImage(image, language);
        return res.json({
            success: result.success,
            analysis: result.analysis,
            error: result.error,
            timestamp: new Date().toISOString(),
            mode: 'nvidia'
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
