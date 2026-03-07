/**
 * Image Analysis Route
 * 
 * POST /analyze-image
 * Accepts multipart form data with an image file.
 * Returns agricultural advisory based on vision analysis.
 */

const express = require('express');
const multer = require('multer');
const visionService = require('../services/visionService');
const inferenceService = require('../services/inferenceService');
const storageService = require('../services/storageService');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// POST /analyze-image
router.post('/', upload.single('image'), async (req, res) => {
    console.log('\n📥 Received image analysis request');

    try {
        // Validate file exists
        if (!req.file) {
            console.log('❌ No image file provided');
            return res.status(400).json({
                success: false,
                error: 'No image file provided. Please upload an image.'
            });
        }

        console.log(`📷 Image: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

        // Step 1: Call Hugging Face Vision API
        console.log('🔍 Calling Vision API...');
        const visionResult = await visionService.analyzeImage(req.file.buffer);

        if (!visionResult.success) {
            console.log('❌ Vision API failed:', visionResult.error);
            return res.status(503).json({
                success: false,
                error: visionResult.error || 'Vision analysis failed'
            });
        }

        console.log(`✅ Vision API returned ${visionResult.labels.length} labels`);

        // Step 2: Apply agricultural inference
        console.log('🌾 Applying agricultural inference...');
        const advisory = inferenceService.inferAdvice(visionResult.labels);

        console.log(`✅ Generated advisory: ${advisory.condition} (${advisory.confidence})`);

        // Return success response
        return res.json({
            success: true,
            data: advisory,
            labels: visionResult.labels.slice(0, 5) // Return top 5 labels for transparency
        });

    } catch (error) {
        console.error('❌ Error processing request:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process image. Please try again.'
        });
    }
});

module.exports = router;
