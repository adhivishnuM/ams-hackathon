const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');

async function testTts() {
    console.log('🧪 Testing Node -> Python TTS connectivity via 127.0.0.1...');
    try {
        const response = await fetch('http://127.0.0.1:8000/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: "Testing NVIDIA TTS connection.",
                language: "en",
                force_edge: false
            })
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log(`✅ Success! Received ${buffer.byteLength} bytes.`);
            fs.writeFileSync('test_node_output_127.wav', Buffer.from(buffer));
        } else {
            const text = await response.text();
            console.error(`❌ Failed: ${text}`);
        }
    } catch (e) {
        console.error(`❌ Error connecting: ${e.message}`);
    }
}

testTts();
