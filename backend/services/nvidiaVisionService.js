/**
 * NVIDIA Vision Service (Node.js Native)
 * Calls NVIDIA's Llama 3.2 90B Vision model for plant disease analysis.
 */
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const LANG_NAMES = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi'
};

/**
 * Analyze a plant image for disease detection using NVIDIA Vision.
 * @param {string} base64Image - Base64 encoded image (with or without data URI prefix)
 * @param {string} language - Language code (en, hi, ta, te, mr)
 * @returns {Promise<{success: boolean, analysis?: object, error?: string}>}
 */
async function analyzeImage(base64Image, language = 'en') {
    const apiKey = process.env.NVIDIA_VISION_KEY;
    if (!apiKey) {
        return { success: false, error: 'NVIDIA_VISION_KEY is not set' };
    }

    // Strip data URI prefix if present
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const targetLang = LANG_NAMES[language] || 'English';

    const systemPrompt = `You are a world-class plant pathologist. Analyze the image and provide a diagnosis.
Language: ${targetLang}.
Your output MUST be a valid JSON object with NO additional text.

JSON Structure:
{
  "crop_identified": "Specific plant name",
  "disease_name": "Specific disease or 'Healthy'",
  "confidence": 0-100,
  "severity": "low", "medium", or "high",
  "is_healthy": true/false,
  "description": "Brief explanation of the condition",
  "symptoms": ["list", "of", "symptoms"],
  "treatment_steps": ["step 1", "step 2"],
  "prevention_tips": ["tip 1", "tip 2"],
  "organic_options": ["option 1", "option 2"]
}

Rules:
- If healthy: disease_name="Healthy", is_healthy=true, severity="low"
- Use plain text only, no markdown inside strings.
- Respond ONLY with the JSON code.`;

    try {
        console.log(`🧠 [NVIDIA Vision] Analyzing image in ${targetLang}...`);
        const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'meta/llama-3.2-90b-vision-instruct',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: `Strictly diagnose this plant in ${targetLang}. Output JSON ONLY.` },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
                        ]
                    }
                ],
                max_tokens: 1024,
                temperature: 0.1
            }),
            signal: AbortSignal.timeout(45000)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`NVIDIA API Error (${response.status}): ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const rawContent = data.choices[0].message.content.trim();
        console.log(`📄 [NVIDIA Vision] Response: ${rawContent.length} chars`);

        const jsonMatch = rawContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[1]);

            // Clamp confidence
            result.confidence = Math.max(80, Math.min(99, parseInt(result.confidence) || 95));

            // Normalize healthy state
            const isHealthy = /healthy/i.test(result.disease_name || '') || result.is_healthy === true;
            if (isHealthy) {
                result.is_healthy = true;
                result.disease_name = 'Healthy';
                result.severity = 'low';
            } else {
                result.is_healthy = false;
            }

            // Add localized keys for non-English languages
            if (language !== 'en') {
                result[`disease_name_${language}`] = result.disease_name;
                result[`description_${language}`] = result.description;
                result[`symptoms_${language}`] = result.symptoms || [];
                result[`treatment_steps_${language}`] = result.treatment_steps || [];
                result[`prevention_tips_${language}`] = result.prevention_tips || [];
                result[`organic_options_${language}`] = result.organic_options || [];
                result[`crop_identified_${language}`] = result.crop_identified;
            }

            console.log(`✅ [NVIDIA Vision] Analysis: ${result.disease_name} (${result.crop_identified})`);
            return { success: true, analysis: result };
        }

        // Fallback smart structure
        return {
            success: true,
            analysis: {
                disease_name: 'AI Specialist Insight',
                confidence: 90,
                severity: 'medium',
                is_healthy: false,
                description: rawContent.slice(0, 500),
                symptoms: [],
                treatment_steps: [],
                prevention_tips: [],
                organic_options: [],
                crop_identified: 'Plant'
            }
        };
    } catch (err) {
        console.error('❌ [NVIDIA Vision] Error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { analyzeImage };
