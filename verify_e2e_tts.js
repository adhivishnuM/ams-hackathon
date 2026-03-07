const fetch = require('node-fetch');

async function verifyE2E() {
    console.log("🚀 Verifying End-to-End Multilingual TTS (Node -> Python)...");

    const payload = {
        text: "வணக்கம், நான் உங்கள் விவசாய உதவியாளர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
        language: "ta",
        useTts: "true"
    };

    try {
        const response = await fetch('http://localhost:3001/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success && result.audio) {
            console.log(`✅ Success! Received audio from backend (${result.audio.length} bytes base64)`);
            console.log(`📝 Transcript: ${result.transcript}`);
            console.log(`🌾 Advisory: ${result.advisory.recommendation.slice(0, 50)}...`);
        } else {
            console.log("❌ Failed to get audio from backend");
            console.log("Result:", JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error("❌ E2E Verification failed:", e.message);
        console.log("Ensure both Node (3001) and Python (8000) backends are running.");
    }
}

verifyE2E();
