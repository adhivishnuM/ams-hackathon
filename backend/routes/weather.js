const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/**
 * GET /api/weather
 * Fetches weather data from Open-Meteo API
 */
router.get('/', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({
            success: false,
            error: 'Latitude and longitude are required'
        });
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.reason || 'Failed to fetch weather data');
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Weather API error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

module.exports = router;
