/**
 * OpenRouter AI Service (Enhanced with Context & Natural TTS)
 * 
 * Features:
 * - Conversation history for context-aware responses
 * - Dynamic agricultural advice for ANY crop
 * - Markdown-formatted responses
 * - Natural human-like TTS via OpenAI
 */
const cacheService = require('./cacheService');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';


/**
 * Get agricultural advice from AI with conversation context
 * 
 * @param {string} userQuery - The user's question
 * @param {object} weatherContext - { temp, condition, humidity }
 * @param {object} imageBuffer - Optional: Buffer of the image to analyze
 * @param {string} mimeType - Optional: Mime type of the image
 * @param {string} language - Language code (en, hi, ta, te, mr)
 * @param {Array} conversationHistory - Previous messages for context
 */
async function getAgriAdvice(userQuery, weatherContext, imageBuffer = null, mimeType = 'image/jpeg', language = 'en', conversationHistory = []) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY missing');
        return null;
    }

    const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'mr': 'Marathi'
    };

    const targetLang = languageNames[language] || 'English';

    // Generate cache key
    const cacheKey = cacheService.generateKey('agri-advice', userQuery, language, !!imageBuffer);
    const cachedResponse = cacheService.get(cacheKey);
    if (cachedResponse && !imageBuffer) {
        console.log('📦 Returning cached AI advice');
        return cachedResponse;
    }

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const marketKeywords = ['price', 'market', 'rate', 'sell', 'mandi', 'bhav', 'விலை', 'விற்க', 'சந்தை', 'भाव', 'कीमत', 'बेचना', 'मंडी', 'ధర', 'అమ్మకానికి', 'మార్కెట్', 'किंमत', 'विक्री', 'बाजार'];
        let activeModel = MODEL;
        if (marketKeywords.some(kw => userQuery.toLowerCase().includes(kw))) {
            activeModel = 'perplexity/sonar'; // Use sonar for live web search and current prices
        }

        // Voice-optimized prompt — natural phone call style with enough detail to be helpful
        let systemPrompt = `You are Priya, AgroTalk's friendly voice agronomist. You are on a PHONE CALL — speak like a real person, warm and direct. No bullet points, no markdown, no lists. Plain spoken sentences only.

CRITICAL: You MUST respond ONLY in ${targetLang}. Every single word of your response must be in ${targetLang}. Never mix languages.

SELLING CROPS (Structured Flow like LPG Order):
- Step 1: If farmer says they want to sell → ask "What crop do you want to sell?"
- Step 2: After crop name → ask "How many quintals / kilograms do you have?"
- Step 3: After quantity → ask "Which district or area are you from?"
- Step 4: Once all 3 collected → say "Great! I'm connecting you with wholesale buyers in your area. Your order is being placed!" → append [B2B_ORDER_CONFIRMED: <CropName>|<Quantity>|<Location>] at end.

WHOLESALE BUYERS IN TAMIL NADU (tell farmers these details if asked):
- Chennai: Rajesh Kumar (Koyambedu) +91 98410 XXXXX - Tomato, Onion, Potato - ₹800-2000/q
- Coimbatore: Senthilkumar (Ukkadam) +91 98423 XXXXX - Banana, Coconut, Turmeric - ₹700-2200/q
- Madurai: Kalaiselvan (Mattuthavani) +91 94430 XXXXX - Banana, Flowers - ₹500-5000/q
- Salem: Marimuthu (Shevapet) +91 97878 XXXXX - Mango, Turmeric, Banana - ₹800-4000/q
- Trichy: Periyasamy (Ariyamangalam) +91 98941 XXXXX - Rice, Groundnut - ₹1200-5500/q
- Tirunelveli: Jeyakumar (Palayamkottai) +91 98422 XXXXX - Banana, Plantain - ₹800-2500/q
- Erode: Sivakumar (Turmeric Market) +91 98944 XXXXX - Turmeric, Ginger - ₹4000-15000/q
- Vellore: Ramprasad (Katpadi) +91 97899 XXXXX - Tomato, Onion, Groundnut - ₹500-4500/q
- Tiruppur: Ilango (Dharapuram Rd) +91 98432 XXXXX - Cotton, Groundnut - ₹4500-8000/q
- Thanjavur: Velayutham (Big Market) +91 94453 XXXXX - Paddy, Rice - ₹1400-2800/q

BUYING INPUTS: If farmer wants to buy farm inputs → confirm product + price → say it will arrive in 2-3 days → append [PRODUCT_ORDER_CONFIRMED: <Product>] at end. Available: Aliette Fungicide ₹450 | Coragen Insecticide ₹850 | NPK 19:19:19 ₹150 | Neem Oil ₹250 | DAP ₹1200 | Urea ₹300.
CROP PROBLEMS: Diagnose the disease or pest, explain what it is, and recommend the best treatment in 3-4 natural sentences.
GENERAL CHAT: Be helpful and conversational. Give proper, useful answers — not one-liners.`;

        if (weatherContext) {
            systemPrompt += `\nWeather: ${weatherContext.temp}°C, humidity ${weatherContext.humidity}%. Give advice considering this.`;
        }

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Context
        if (conversationHistory && conversationHistory.length > 0) {
            const recentHistory = conversationHistory.slice(-4);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                });
            }
        }

        const userContent = [{
            type: 'text',
            text: userQuery || "Analyze this."
        }];

        if (imageBuffer) {
            const base64Image = imageBuffer.toString('base64');
            userContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                }
            });
        }

        messages.push({
            role: 'user',
            content: userContent
        });

        console.log(`🤖 Sending ${targetLang} request...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'AgroTalk Assist',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: activeModel,
                messages: messages,
                temperature: 0.5
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error('❌ OpenRouter Error:', response.status, errText);
            return null;
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            const result = {
                text: data.choices[0].message.content,
                model: data.model
            };
            // Cache for 2 hours if no image (image analysis is too dynamic)
            if (!imageBuffer) {
                cacheService.set(cacheKey, result, 7200);
            }
            return result;
        }
        return null;

    } catch (error) {
        console.error('❌ AI Service Error:', error);
        return null;
    }
}

/**
 * Generate speech using the native Node.js TTS service (no Python required).
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code
 * @param {string} gender - Unused (kept for API compatibility)
 * @returns {Buffer|null}
 */
async function generateSpeech(text, language = 'en', gender = 'male') {
    const { generateSpeech: proxySpeech } = require('./pythonService');
    return proxySpeech(text, language, false, 'mia');
}

/**
 * Analyze mandi market prices using AI
 * 
 * @param {object} mandiData - The market record to analyze
 * @param {string} language - Language code
 */
async function getMarketAnalysis(mandiData, language = 'en', onProgress = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OPENROUTER_API_KEY missing');
        return null;
    }

    const ONLINE_MODEL = 'perplexity/sonar';

    const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'te': 'Telugu',
        'mr': 'Marathi'
    };
    const targetLang = languageNames[language] || 'English';

    // Generate cache key for market analysis
    const cacheKey = cacheService.generateKey('market-analysis', mandiData.commodity, mandiData.market, language);
    const cachedMarket = cacheService.get(cacheKey);
    if (cachedMarket) {
        console.log('📦 Returning cached market analysis');
        return cachedMarket;
    }

    try {
        const { commodity, market, min_price, max_price, modal_price, arrival_date, district, state } = mandiData;
        const currentDateStr = arrival_date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Normalize to /kg
        const modalPerKg = (parseFloat(modal_price) / 100).toFixed(2);

        const systemPrompt = `You are "AgroTalk Real-Time Expert", a professional agricultural market analyst.
        
        TASK:
        You must perform a WEB SEARCH to find the ABSOLUTE LATEST market trends, news, and price forecasts for the specified crop in India for the date: ${currentDateStr}.
        
        RULES:
        1. BE ACCURATE: Use real-time data from the web.
        2. STRUCTURE:
           📈 **Market Summary**: Today's latest price trend vs the provided Mandi data (${arrival_date}).
           🌍 **Market Trends**: 2-3 sentences on WHY prices are moving today (demand, supply, exports, weather).
           💡 **Expert Action**: Provide a bold recommendation: **[SELL NOW]**, **[HOLD]**, or **[WAIT FOR PRICE RISE]**. Give a data-backed reason.
           🔗 **Referral**: Provide exactly one valid, clickable URL to a reputable agricultural news source or market portal (e.g., Agmarknet, Commodity Online, Krishi Jagran) where the farmer can verify this.
        3. LANGUAGE: Respond ONLY in ${targetLang}.
        4. No hallucinations. If you cannot find today's data, say so but still provide the best possible analysis.`;

        const userPrompt = `
        MANDI DATA TO ANALYZE:
        - Crop: ${commodity}
        - Market: ${market}, ${district}, ${state} (Arrival: ${arrival_date})
        - Mandi Price: ₹${modal_price}/quintal (₹${modalPerKg}/kg)
        - Current Date: ${currentDateStr}
        
        Search for today's market situation and give your expert advice.`;

        console.log(`🌐 Performing REAL-TIME search analysis for ${commodity} in ${targetLang}...`);

        if (onProgress) onProgress({ type: 'status', message: 'Performing real-time market search...' });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // Higher timeout for search

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'AgroTalk Assist',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: ONLINE_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 500
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error('❌ OpenRouter API Error (Online Market):', response.status, errText);
            // Fallback to non-online model if search model fails
            if (onProgress) onProgress({ type: 'status', message: 'Search failed, using standard analysis...' });
            return await getGroundedMarketAnalysis(mandiData, language, onProgress);
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            const result = {
                text: data.choices[0].message.content,
                model: data.model
            };
            // Cache market analysis for 1 hour
            cacheService.set(cacheKey, result, 3600);
            return result;
        }
        return null;

    } catch (error) {
        console.error('❌ Market AI Exception:', error);
        return null;
    }
}

/**
 * Fallback Grounded Analysis (Original Logic)
 */
async function getGroundedMarketAnalysis(mandiData, language = 'en', onProgress = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const languageNames = { 'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi' };
    const targetLang = languageNames[language] || 'English';
    const { commodity, market, modal_price, arrival_date } = mandiData;
    const currentDateStr = arrival_date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `You are "AgroTalk Expert". Use ONLY provided data.
    1. Short and Sweet (3 points). 2. Language: ${targetLang}.
    📈 Summary: Price today. 🌍 Trends: General info. 💡 Action: [SELL/HOLD/WAIT].`;

    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Analyze: ${commodity} at ${market} (${modal_price})` }],
            temperature: 0.2,
            max_tokens: 300
        }),
        signal: AbortSignal.timeout(30000)
    });
    const data = await response.json();
    return data.choices?.[0] ? { text: data.choices[0].message.content, model: data.model } : null;
}

module.exports = { getAgriAdvice, generateSpeech, getMarketAnalysis };
