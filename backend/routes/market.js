const express = require('express');
const router = express.Router();
const { getMarketAnalysis } = require('../services/openRouterService');

// Simple in-memory cache for analysis
const analysisCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Load API key from env (supports both root .env and backend .env)
const API_KEY = process.env.VITE_MANDI_API_KEY || process.env.MANDI_API_KEY;
/**
 * GET /market/prices
 * Proxy for Agmarknet API to avoid CORS issues
 * Supports: ?limit=20&offset=0&commodity=Onion&q=onion
 */
router.get('/prices', async (req, res) => {
    try {
        const { limit = 20, offset = 0, commodity, state, district, market, q } = req.query;

        if (!API_KEY) {
            console.warn('⚠️ VITE_MANDI_API_KEY not set in environment');
            return res.status(500).json({ success: false, error: 'Market API key not configured' });
        }

        // Use verified working resource ID
        const activeUrl = process.env.VITE_MANDI_API_BASE_URL || process.env.MANDI_API_BASE_URL || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
        let url = `${activeUrl}?api-key=${API_KEY}&format=json&limit=${limit}&offset=${offset}`;

        // Normalize to Title Case for API compatibility
        const toTitleCase = (s) => s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null;

        // State name normalization map
        const STATE_ALIASES = {
            'tamilnadu': 'Tamil Nadu', 'tn': 'Tamil Nadu', 'tamilnad': 'Tamil Nadu',
            'maharashtra': 'Maharashtra', 'maha': 'Maharashtra',
            'andhra': 'Andhra Pradesh', 'andhrapradesh': 'Andhra Pradesh', 'ap': 'Andhra Pradesh',
            'telangana': 'Telangana', 'karnataka': 'Karnataka',
            'kerala': 'Kerala', 'gujarat': 'Gujarat', 'rajasthan': 'Rajasthan',
            'uttarpradesh': 'Uttar Pradesh', 'up': 'Uttar Pradesh',
            'madhyapradesh': 'Madhya Pradesh', 'mp': 'Madhya Pradesh',
            'westbengal': 'West Bengal', 'wb': 'West Bengal',
            'punjab': 'Punjab', 'haryana': 'Haryana',
            'himachalpradesh': 'Himachal Pradesh', 'hp': 'Himachal Pradesh',
            'odisha': 'Odisha', 'orissa': 'Odisha',
            'bihar': 'Bihar', 'jharkhand': 'Jharkhand',
            'chhattisgarh': 'Chhattisgarh', 'assam': 'Assam',
        };
        const normalizeState = (s) => {
            if (!s) return null;
            const key = s.toLowerCase().replace(/\s+/g, '');
            return STATE_ALIASES[key] || toTitleCase(s);
        };

        const formattedCommodity = toTitleCase(commodity);
        const formattedState = normalizeState(state);

        // Use exact filters if provided
        if (formattedCommodity) {
            url += `&filters[commodity]=${encodeURIComponent(formattedCommodity)}`;
        }
        if (formattedState) {
            url += `&filters[state]=${encodeURIComponent(formattedState)}`;
        }
        if (district) {
            url += `&filters[district]=${encodeURIComponent(district)}`;
        }
        if (market) {
            url += `&filters[market]=${encodeURIComponent(market)}`;
        }
        // Use broad q search if provided
        if (q) {
            url += `&q=${encodeURIComponent(q)}`;
        }

        console.log(`🌐 Proxying Mandi request (commodity=${formattedCommodity || q || 'all'}, state=${formattedState || 'any'}, limit=${limit}, offset=${offset})`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AgroTalk/1.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Mandi API Error (${response.status}):`, errorText.substring(0, 200));
            throw new Error(`Mandi API responded with ${response.status}`);
        }

        const data = await response.json();
        const records = data.records || [];

        console.log(`✅ Mandi API returned ${records.length} records`);

        res.json({
            success: true,
            records,
            total: data.total || 0,
            count: data.count || records.length
        });
    } catch (error) {
        console.error('Error fetching mandi prices via proxy:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market data'
        });
    }
});



/**
 * POST /market/analyze
 * Body: { mandiData, language }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { mandiData, language = 'en', stream = false } = req.body;

        if (!mandiData) {
            return res.status(400).json({
                success: false,
                error: 'Mandi data is required'
            });
        }

        // Create cache key based on record and language
        const cacheKey = `${mandiData.market}-${mandiData.commodity}-${mandiData.modal_price}-${language}`;

        // Check cache
        if (analysisCache.has(cacheKey)) {
            const cached = analysisCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                console.log('💎 Returning cached market analysis');
                return res.json({
                    success: true,
                    analysis: cached.data.text,
                    cached: true
                });
            }
            analysisCache.delete(cacheKey);
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Send initial ping to establish connection
            res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            const analysis = await getMarketAnalysis(mandiData, language, (progress) => {
                res.write(`data: ${JSON.stringify(progress)}\n\n`);
            });

            if (!analysis) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate market analysis' })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                return res.end();
            }

            // Store in cache
            analysisCache.set(cacheKey, {
                timestamp: Date.now(),
                data: analysis
            });

            res.write(`data: ${JSON.stringify({ type: 'result', analysis: analysis.text, model: analysis.model })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            return res.end();
        }

        const analysis = await getMarketAnalysis(mandiData, language);

        if (!analysis) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate market analysis'
            });
        }

        // Store in cache
        analysisCache.set(cacheKey, {
            timestamp: Date.now(),
            data: analysis
        });

        res.json({
            success: true,
            analysis: analysis.text,
            model: analysis.model
        });

    } catch (error) {
        console.error('Error in market analysis route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
