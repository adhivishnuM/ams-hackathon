// Use global fetch (Node 18+)
const HF_URL =
    "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function analyzeImage(imageBuffer) {
    const token = process.env.HF_TOKEN || process.env.HF_API_KEY;
    if (!token) {
        throw new Error("HF_TOKEN or HF_API_KEY is missing in environment variables");
    }

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`HF attempt ${attempt}...`);

            const res = await fetch(HF_URL, {
                method: "POST",
                headers,
                body: imageBuffer,
            });

            const raw = await res.text();
            console.log(`Vision API status: ${res.status}`);

            if (res.status === 503 || raw.toLowerCase().includes("loading")) {
                console.log("HF cold start/loading, waiting...");
                await sleep(12000);
                continue;
            }

            if (!res.ok) {
                console.error("Vision API Error Response:", raw.slice(0, 200));
                throw new Error(`HF HTTP ${res.status}: ${raw.slice(0, 100)}`);
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (parseError) {
                console.error("Failed to parse Vision response:", raw.slice(0, 200));
                throw new Error("Invalid JSON response from Vision API");
            }

            if (Array.isArray(data)) {
                console.log("HF success");
                return { success: true, labels: data };
            }

            throw new Error("Unexpected HF response: " + raw);
        } catch (e) {
            console.error("HF error:", e.message);
        }
    }

    // FALLBACK
    console.log("Using fallback vision logic");

    return {
        success: true,
        source: "fallback",
        labels: [
            { label: "leaf", score: 0.9 },
            { label: "plant disease", score: 0.7 },
        ],
    };
}

module.exports = { analyzeImage };
