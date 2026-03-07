const fetch = require('node-fetch'); // Use fetch if global not available in this node version
const fs = require('fs');

async function testTts() {
    console.log('🧪 Testing Node -> Python TTS connectivity...');
    try {
        const response = await fetch('http://localhost:8000/api/tts', {
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
            fs.writeFileSync('test_node_output.wav', Buffer.from(buffer));
            console.log('Saved to test_node_output.wav');
        } else {
            const text = await response.text();
            console.error(`❌ Failed: ${text}`);
        }
    } catch (e) {
        console.error(`❌ Error connecting: ${e.message}`);
    }
}

testTts();
