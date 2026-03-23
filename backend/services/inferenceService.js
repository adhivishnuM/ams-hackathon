const fs = require('fs');
const path = require('path');
const { getAgriAdvice, generateSpeech } = require('./openRouterService');

// Load Knowledge Base
let knowledgeBase = { crops: {}, topics: {}, general: {} };
try {
    const kbPath = path.join(__dirname, '../data/agricultural_knowledge.json');
    if (fs.existsSync(kbPath)) {
        knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    }
} catch (err) {
    console.error('Failed to load agricultural knowledge base:', err);
}

// Pattern definitions for fallback agricultural conditions
const CONDITION_PATTERNS = [
    {
        keywords: ['yellow', 'yellowing', 'chlorosis', 'pale', 'faded', 'bleach'],
        condition: 'Nutrient Story',
        recommendation: "Yellow leaves usually mean the plant is hungry for nitrogen or iron. Check your soil and try a balanced fertilizer. Also, don't overwater, as that can cause yellowing too!"
    },
    {
        keywords: ['dry', 'dried', 'wilt', 'wilted', 'wilting', 'drought', 'parched'],
        condition: 'Watering Wisdom',
        recommendation: "I see some wilting. Try deep, early morning watering so it reaches the roots before the heat. Adding some mulch around the base will help keep the moisture in."
    },
    {
        keywords: ['brown', 'browning', 'necrosis', 'dead', 'dying', 'scorched', 'burnt'],
        condition: 'Environmental Stress',
        recommendation: "Those brown patches might be too much sun or a bit of chemical burn. Prune those dead parts and give the plant some shade during the hottest part of the day."
    },
    {
        keywords: ['spot', 'spots', 'spotted', 'lesion', 'lesions', 'blotch', 'patch'],
        condition: 'Disease Watch',
        recommendation: "Spots on leaves often mean a fungus is visiting. Remove the spotted leaves so it doesn't spread, and try an organic copper-based spray."
    },
    {
        keywords: ['mold', 'mildew', 'fungus', 'fungi', 'powdery', 'fuzzy', 'cottony'],
        condition: 'Fungal Alert',
        recommendation: "That powdery coating is likely a fungus. Thin out the branches to get better air flow and use some neem oil to clear it up."
    },
    {
        keywords: ['insect', 'bug', 'pest', 'aphid', 'beetle', 'caterpillar', 'worm', 'larvae'],
        condition: 'Pest Patrol',
        recommendation: "Pests are trying to have a free meal! Check under the leaves and use a bit of neem oil. You can also try inviting ladybugs over for natural protection."
    }
];

/**
 * Fuzzy crop name matching
 * Handles variations like "dragon fruit" vs "dragonfruit"
 */
function fuzzyMatchCrop(text) {
    const normalized = (text || '').toLowerCase().replace(/[\s-_]/g, '');

    // Slang mappings
    const slang = {
        'rmelon': 'watermelon',
        'tato': 'potato',
        'mater': 'tomato',
        'bhindi': 'ladyfinger'
    };

    for (const [s, real] of Object.entries(slang)) {
        if (normalized.includes(s)) return real;
    }

    for (const [cropKey, cropData] of Object.entries(knowledgeBase.crops || {})) {
        // Check exact names or if normalized contains a significant part of the name
        if (cropData.names && cropData.names.some(name => {
            const n = name.toLowerCase().replace(/[\s-_]/g, '');
            return normalized.includes(n) || (n.length > 4 && normalized.includes(n.substring(0, n.length - 1)));
        })) {
            return cropKey;
        }
        // Check crop key itself
        if (normalized.includes(cropKey.replace(/[\s-_]/g, ''))) {
            return cropKey;
        }
    }
    return null;
}

/**
 * Detect large scale farming vs home gardening
 */
function detectScale(text) {
    const normalized = (text || '').toLowerCase();
    const largeScaleKeywords = ['acre', 'acrea', 'hectare', 'big farm', 'commercial', 'field', '10 acre', '5 acre'];

    if (largeScaleKeywords.some(kw => normalized.includes(kw))) {
        return 'large';
    }
    return 'small';
}

/**
 * Language Intent Detection
 * Detects if the user wants to switch to a specific language.
 */
function detectLanguageIntent(text) {
    const lower = (text || "").toLowerCase();
    
    // Check for language keywords + switch intent
    const intents = ["speak in", "talk in", "change to", "switch to", "bolo", "bolen", "pesu", "maatru", "badlo", "badli"];
    const hasIntent = intents.some(i => lower.includes(i));
    
    // Direct mention detection (more aggressive)
    if (lower.includes("tamil") || lower.includes("tamizh") || lower.includes("thamil")) return "ta";
    if (lower.includes("hindi") || lower.includes("hindu") || lower.includes("hindustani")) return "hi";
    if (lower.includes("telugu")) return "te";
    if (lower.includes("marathi")) return "mr";
    if (lower.includes("english") || lower.includes("angrezi")) return "en";
    
    return null;
}

/**
 * Identify the crop and the topic from the text.
 */
function extractCropAndTopic(text) {
    const normalized = (text || '').toLowerCase();

    // Detect Crop with fuzzy matching
    let detectedCrop = fuzzyMatchCrop(text);

    // Default topic
    let detectedTopic = 'care';

    // Detect Topic
    for (const [topicKey, keywords] of Object.entries(knowledgeBase.topics || {})) {
        if (keywords.some(kw => normalized.includes(kw))) {
            detectedTopic = topicKey;
            break;
        }
    }

    return { crop: detectedCrop, topic: detectedTopic };
}

/**
 * Infer agricultural advice from vision labels
 */
function inferAdvice(labels) {
    if (!labels || labels.length === 0) {
        return {
            condition: 'Analysis Complete',
            confidence: 'Low',
            recommendation: 'We analyzed your image but could not identify specific agricultural conditions. For best results, upload a clear, well-lit photo focusing on leaves or affected plant parts.'
        };
    }

    const labelText = labels.map(l => l.label.toLowerCase()).join(' ');
    const maxScore = Math.max(...labels.slice(0, 3).map(l => l.score));

    let bestMatch = null;
    let bestMatchScore = 0;

    for (const pattern of CONDITION_PATTERNS) {
        let matchCount = 0;
        for (const keyword of pattern.keywords) {
            if (labelText.includes(keyword)) matchCount++;
        }
        if (matchCount > bestMatchScore) {
            bestMatchScore = matchCount;
            bestMatch = pattern;
        }
    }

    if (bestMatch && bestMatchScore > 0) {
        return {
            condition: bestMatch.condition,
            confidence: maxScore > 0.5 ? 'High' : 'Medium',
            recommendation: bestMatch.recommendation
        };
    }

    const topLabel = labels[0].label;
    return {
        condition: `Detected: ${topLabel}`,
        confidence: 'Low',
        recommendation: `The analysis identified "${topLabel}" as the primary feature. For specific advice, ensure the image clearly shows any problem areas on leaves or stems.`
    };
}

/**
 * Advanced Dynamic Inference from Text
 * Enhanced for Extensive Local Wisdom (6000+ lines knowledge base)
 */
async function inferAdviceFromText(text, language = 'en', weatherContext = null, conversationHistory = []) {
    const normalized = (text || '').trim();
    const normalizedLower = normalized.toLowerCase();

    // 0. Language Intent Detection
    const newLanguage = detectLanguageIntent(normalized);
    const effectiveLang = newLanguage || (['hi', 'ta', 'te', 'mr'].includes(language) ? language : 'en');

    if (!normalized) {
        return {
            condition: 'No audio',
            confidence: 'Low',
            recommendation: 'I didn\'t hear anything. Please try asking about your crop care or a specific problem.',
            newLanguage: newLanguage
        };
    }

    const lang = effectiveLang;

    // 1. LANGUAGE RULE: Local Wisdom is English-only.
    // For other languages, we MUST use an AI model (Remote or Local).
    if (lang !== 'en') {
        console.log(`📡 Non-English query (${lang}) detected. Routing to AI...`);

        if (process.env.OPENROUTER_API_KEY && process.env.OFFLINE_MODE !== 'true') {
            try {
                const aiResponse = await getAgriAdvice(normalized, weatherContext, null, 'image/jpeg', lang, conversationHistory);
                if (aiResponse) {
                    return {
                        condition: 'Farmer Assist',
                        confidence: 'High',
                        recommendation: aiResponse.text,
                        newLanguage: newLanguage
                    };
                }
            } catch (e) {
                console.error('❌ Cloud AI Error for non-English:', e);
            }
        }

        // Fallback messages for offline / AI failure
        const languageFallbacks = {
            'hi': "क्षमा करें, इस भाषा में सलाह देने के लिए मुझे एआई सेवा की आवश्यकता है जो अभी उपलब्ध नहीं है। कृपया अपना इंटरनेट जांचें।",
            'ta': "மன்னிக்கவும், இந்த மொழியில் ஆலோசனை வழங்க எனக்கு AI சேவை தேவை, அது தற்போது கிடைக்கவில்லை. உங்கள் இணையத்தை சரிபார்க்கவும்.",
            'te': "క్షమించండి, ఈ భాషలో సలహా ఇవ్వడానికి నాకు AI సేవ అవసరం, అది ప్రస్తుతం అందుబాటులో లేదు. మీ ఇంటర్నెట్‌ని తనిఖీ చేయండి.",
            'mr': "क्षमस्व, या भाषेत सल्ला देण्यासाठी मला एआय सेवेची आवश्यकता आहे जी सध्या उपलब्ध नाही. कृपया तुमचे इंटरनेट तपासा."
        };

        return {
            condition: 'AI Required',
            confidence: 'Low',
            recommendation: languageFallbacks[lang] || "I'm sorry, providing advice in this language requires an active AI connection which is currently unavailable."
        };
    }

    // 2. English — if OFFLINE_MODE is set, skip AI and go straight to local wisdom
    if (process.env.OFFLINE_MODE === 'true' || !process.env.OPENROUTER_API_KEY) {
        console.log('📖 Offline mode or no API key — using local knowledge base.');
    }

    // 2. AI Assistant (Online Priority)
    if (process.env.OPENROUTER_API_KEY && conversationHistory && conversationHistory.length > 0) {
        // ... (existing AI logic)
        try {
            const aiResponse = await getAgriAdvice(normalized, weatherContext, null, 'image/jpeg', lang, conversationHistory);
            if (aiResponse) {
                return {
                    condition: 'Farmer Assist',
                    confidence: 'High',
                    recommendation: aiResponse.text,
                    newLanguage: newLanguage
                };
            }
        } catch (e) {
            console.error('❌ AI Priority Error:', e);
        }
    }

    // 3. EXTENSIVE LOCAL WISDOM SEARCH (The "Farming Buddy" Layer)
    const { crop, topic } = extractCropAndTopic(normalized);

    // Internal Helper for Direct Advice
    const makeConversational = (content, header, scale = 'small') => {
        const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const intros = {
            en: [
                `Here is the latest advice for ${header} (as of ${currentDate}):`,
                `About ${header}:`,
                `Regarding ${header}:`
            ],
            hi: [
                `${header} के लिए ताज़ा जानकारी (${currentDate}):`,
                `${header} के बारे में:`
            ]
        };

        const list = intros[lang] || intros['en'];
        const intro = list[Math.floor(Math.random() * list.length)];
        return `**${intro}**\n\n${content}\n\nHope this helps!`;
    };

    const scale = detectScale(normalized);

    // Check for specific disease/pest keywords... (Keep the detection logic)
    let detectedDisease = null;
    if (knowledgeBase.disease_reference) {
        for (const [key, data] of Object.entries(knowledgeBase.disease_reference)) {
            const searchKey = key.replace(/_/g, ' ');
            if (normalizedLower.includes(searchKey)) {
                detectedDisease = { key, ...data };
                break;
            }
        }
    }

    let detectedPest = null;
    if (knowledgeBase.pest_reference) {
        for (const [key, data] of Object.entries(knowledgeBase.pest_reference)) {
            const searchKey = key.replace(/_/g, ' ');
            if (normalizedLower.includes(searchKey)) {
                detectedPest = { key, ...data };
                break;
            }
        }
    }

    // Build Comprehensive Response (STRICT MATCHING)
    if (crop && knowledgeBase.crops[crop]) {
        const cropData = knowledgeBase.crops[crop];
        const cropTitle = crop.charAt(0).toUpperCase() + crop.slice(1);
        let cropAdvice = cropData[topic] ? cropData[topic][lang] : (cropData['care'] ? cropData['care'][lang] : null);

        if (cropAdvice) {
            return {
                condition: 'General',
                confidence: 'High',
                recommendation: makeConversational(cropAdvice, cropTitle, scale)
            };
        }
    }

    if (detectedDisease) {
        const dName = detectedDisease.key.replace(/_/g, ' ').charAt(0).toUpperCase() + detectedDisease.key.replace(/_/g, ' ').slice(1);
        const content = `${detectedDisease.symptoms[lang] || detectedDisease.symptoms['en']}. Here is the plan: ${detectedDisease.treatment[lang] || detectedDisease.treatment['en']}`;
        return {
            condition: 'General',
            confidence: 'High',
            recommendation: makeConversational(content, dName, scale)
        };
    }

    if (detectedPest) {
        const pName = detectedPest.key.charAt(0).toUpperCase() + detectedPest.key.slice(1);
        const content = `${detectedPest.symptoms[lang] || detectedPest.symptoms['en']}. My advice: ${detectedPest.control[lang] || detectedPest.control['en']}`;
        return {
            condition: 'General',
            confidence: 'High',
            recommendation: makeConversational(content, pName, scale)
        };
    }

    // Skip weather unless specifically asked
    const weatherKeywords = ['weather', 'rain', 'hot', 'cold', 'temperature', 'humidity'];
    const askingWeather = weatherKeywords.some(kw => normalizedLower.includes(kw));

    if (weatherContext && askingWeather) {
        const temp = Math.round(weatherContext.temp);
        const humidity = weatherContext.humidity;

        let weatherAdvice = "";
        if (temp > 30) {
            weatherAdvice = `It's getting quite **hot** out there today, reaching about **${temp}°C**. With humidity at ${humidity}%, your crops are definitely going to feel the thirst. If I were you, I'd give them some extra water, ideally in the early morning to keep them cool through the peak sun.`;
        } else if (temp < 15) {
            weatherAdvice = `There's a bit of a **chill** in the air today, around **${temp}°C**. Most crops are fine, but keep an eye on your tropical plants. They don't like the cold any more than we do!`;
        } else {
            weatherAdvice = `The weather is looking **beautiful and moderate** today, about **${temp}°C**. It's a perfect day for some light field work or just checking in on your growth. Humidity is sitting comfortably at ${humidity}%.`;
        }

        return {
            condition: 'General',
            confidence: 'High',
            recommendation: makeConversational(weatherAdvice, "Today's Weather", scale)
        };
    }

    // 5. Final Fallback (Try AI if English query matched nothing local)
    // If we reached here, it means NO specific local wisdom matched (Confidence was effectively LOW/0)
    console.log("⚠️ No specific local wisdom matched. Falling back to AI...");

    if (process.env.OPENROUTER_API_KEY && process.env.OFFLINE_MODE !== 'true') {
        try {
            const aiResponse = await getAgriAdvice(normalized, weatherContext, null, 'image/jpeg', 'en', conversationHistory);
            if (aiResponse) {
                return {
                    condition: 'Farmer Assist',
                    confidence: 'High',
                    recommendation: aiResponse.text
                };
            }
        } catch (e) {
            console.error('❌ Final English AI Fallback Error:', e);
        }
    }

    // 6. Last Resort (Only if AI fails too)
    return {
        condition: 'Standard Response',
        confidence: 'Low',
        recommendation: "I'm listening, bro! I couldn't find a direct fix in my wisdom files for that specific phrase, but I'm here. Try asking about a crop like **Tomato** or **Watermelon**, or tell me about a pest. If you're farming a big area, I can give you some high-level tips too!"
    };
}

module.exports = { inferAdvice, inferAdviceFromText, generateSpeech };
