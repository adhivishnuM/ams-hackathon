"""
WhatsApp AI Service
Handles all multimodal AI processing for the WhatsApp self-message bridge.
Provides: image analysis, text chat, audio STT, B2B crop selling, and WhatsApp-specific formatting.
"""
import os
import base64
import re
import time
from typing import Optional, Dict, Any, List
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv
from services.nvidia_stt import NvidiaSTTService

load_dotenv()

# ─────────────────────────────────────────────────────────────
# WhatsApp text formatter
# ─────────────────────────────────────────────────────────────

def format_for_whatsapp(text: str) -> str:
    """
    Converts Markdown-style text into WhatsApp-compatible formatting.
    WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```code```
    """
    # Convert Markdown bold **text** or __text__ → WhatsApp *text*
    text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', text)
    text = re.sub(r'__(.+?)__', r'*\1*', text)

    # Convert Markdown italic *text* or _text_ → WhatsApp _text_
    # (but not already converted **bold**)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'_\1_', text)

    # Convert ### headers to bold with emoji
    text = re.sub(r'^#{1,3}\s+(.+)$', r'*\1*', text, flags=re.MULTILINE)

    # Convert Markdown bullet points to WhatsApp-friendly bullets
    text = re.sub(r'^[-•]\s+', '• ', text, flags=re.MULTILINE)
    text = re.sub(r'^\d+\.\s+', lambda m: m.group(0), text, flags=re.MULTILINE)  # Keep numbered lists

    # Remove HTML tags if any
    text = re.sub(r'<[^>]+>', '', text)

    # Clean up excessive blank lines (max 2)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def build_image_reply(analysis: dict, language: str = "en") -> str:
    """
    Build a beautifully formatted WhatsApp image analysis reply.
    """
    lang_suffix = {
        "en": "",
        "hi": "_hindi",
        "ta": "_tamil",
        "te": "_telugu",
        "mr": "_marathi"
    }.get(language, "")

    def get_field(base_key: str, fallback_key: Optional[str] = None):
        val = analysis.get(f"{base_key}{lang_suffix}") or analysis.get(base_key)
        if not val and fallback_key:
            val = analysis.get(fallback_key)
        return val or ""

    crop = get_field("crop_identified") or "Plant"
    disease = get_field("disease_name") or "Unknown"
    confidence = analysis.get("confidence", 0)
    severity = analysis.get("severity", "unknown")
    is_healthy = analysis.get("is_healthy", False)

    description = get_field("description")
    symptoms = get_field("symptoms")
    treatment = get_field("treatment_steps")
    organic = get_field("organic_options")
    prevention = get_field("prevention_tips")

    # Severity emoji
    sev_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}.get(str(severity).lower(), "⚪")
    status_emoji = "✅" if is_healthy else "⚠️"

    def format_list(items) -> str:
        if not items:
            return "_None listed_"
        if isinstance(items, str):
            # Split on newlines or semicolons
            items = [i.strip() for i in re.split(r'[\n;]', items) if i.strip()]
        return "\n".join(f"  • {item}" for item in items if item)

    lines = [
        f"📸 *Plant Health Analysis*",
        f"",
        f"🌱 *Crop:* {crop}",
        f"{status_emoji} *Condition:* {disease} ({str(severity).capitalize()} severity)",
    ]

    if description:
        lines += ["", format_for_whatsapp(str(description))]

    if symptoms and not is_healthy:
        lines += ["", f"🩺 *Symptoms:*", format_list(symptoms)]

    if treatment and not is_healthy:
        lines += ["", f"💊 *Treatment:*", format_list(treatment)]

    if organic and not is_healthy:
        lines += ["", f"🌿 *Organic Options:*", format_list(organic)]

    if prevention:
        lines += ["", f"🛡️ *Prevention:*", format_list(prevention)]

    return "\n".join(lines)


def build_text_reply_wrapper(ai_text: str) -> str:
    """Wraps an AI text response in a WhatsApp-branded header/footer."""
    return format_for_whatsapp(ai_text)


def build_audio_reply_wrapper(transcript: str, ai_text: str) -> str:
    """Wraps an audio-based AI response for WhatsApp."""
    return format_for_whatsapp(ai_text)


def build_order_confirmation_message(order: dict) -> str:
    """Build a WhatsApp-formatted order confirmation card."""
    order_type = order.get("type", "sell")
    if order_type == "sell":
        return (
            f"✅ *Order Confirmed!*\n\n"
            f"📦 *Crop:* {order['crop']}\n"
            f"⚖️ *Quantity:* {order['quantity']}\n"
            f"📍 *Location:* {order['location']}\n"
            f"💰 *Price:* {order['price_estimate']}\n"
            f"🏷️ *Status:* {order['status']}\n"
            f"🆔 *Order ID:* `{order['id']}`\n\n"
            f"_AgroTalk is connecting you with buyers in your area. "
            f"You will hear back within 24 hours._"
        )
    else:
        return (
            f"✅ *Product Order Placed!*\n\n"
            f"🛒 *Item:* {order['crop']}\n"
            f"💰 *Price:* {order['price_estimate']}\n"
            f"🚚 *Delivery:* {order['location']}\n"
            f"🏷️ *Status:* {order['status']}\n"
            f"🆔 *Order ID:* `{order['id']}`\n\n"
            f"_Your item will be delivered to your farm in 2-3 days._"
        )


# ─────────────────────────────────────────────────────────────
# B2B System Prompt (shared across chat and audio)
# ─────────────────────────────────────────────────────────────

B2B_SYSTEM_PROMPT_CORE = """
SELLING CROPS (Structured Flow — collect step by step):
- Step 1: If farmer says they want to sell crops → ask "Which crop do you want to sell?"
- Step 2: After crop name → ask "How many quintals or kilograms do you have?"
- Step 3: After quantity → ask "Which district or area are you from?"
- Step 4: Once crop, quantity, AND location are all confirmed → say "Great! Connecting you with buyers now." → append exactly: [B2B_ORDER_CONFIRMED: <CropName>|<Quantity>|<Location>]

BUYING FARM INPUTS (if farmer wants to buy):
- Confirm product name and quantity → say it will arrive in 2-3 days → append exactly: [PRODUCT_ORDER_CONFIRMED: <ProductName>]
- Available products: Aliette Fungicide ₹450 | Coragen Insecticide ₹850 | NPK 19:19:19 ₹150/kg | Neem Oil ₹250 | DAP ₹1200/bag | Urea ₹300/bag

WHOLESALE BUYERS IN TAMIL NADU:
- Chennai: Rajesh Kumar (Koyambedu) +91 98410 XXXXX — Tomato, Onion, Potato — ₹800–2000/q
- Coimbatore: Senthilkumar (Ukkadam) +91 98423 XXXXX — Banana, Coconut, Turmeric — ₹700–2200/q
- Madurai: Kalaiselvan (Mattuthavani) +91 94430 XXXXX — Banana, Flowers — ₹500–5000/q
- Salem: Marimuthu (Shevapet) +91 97878 XXXXX — Mango, Turmeric, Banana — ₹800–4000/q
- Trichy: Periyasamy (Ariyamangalam) +91 98941 XXXXX — Rice, Groundnut — ₹1200–5500/q
- Tirunelveli: Jeyakumar (Palayamkottai) +91 98422 XXXXX — Banana, Plantain — ₹800–2500/q
- Erode: Sivakumar (Turmeric Market) +91 98944 XXXXX — Turmeric, Ginger — ₹4000–15000/q
- Vellore: Ramprasad (Katpadi) +91 97899 XXXXX — Tomato, Onion, Groundnut — ₹500–4500/q
- Tiruppur: Ilango (Dharapuram Rd) +91 98432 XXXXX — Cotton, Groundnut — ₹4500–8000/q
- Thanjavur: Velayutham (Big Market) +91 94453 XXXXX — Paddy, Rice — ₹1400–2800/q
"""


# ─────────────────────────────────────────────────────────────
# In-memory order store
# ─────────────────────────────────────────────────────────────

_orders: List[Dict] = []

def _parse_and_store_orders(text: str, session_id: str = "whatsapp") -> Optional[Dict]:
    """
    Scan AI response for B2B/product order tags, create order records,
    strip the tags from the text, and return the order if one was found.
    """
    order = None

    # Crop sell order
    sell_match = re.search(r'\[B2B_ORDER_CONFIRMED:\s*([^\]]+)\]', text, re.IGNORECASE)
    if sell_match:
        parts = [p.strip() for p in sell_match.group(1).split('|')]
        crop = parts[0] if len(parts) > 0 else "Farm Produce"
        quantity = parts[1] if len(parts) > 1 else "As requested"
        location = parts[2] if len(parts) > 2 else "Verified location"
        order = {
            "id": f"wa_{int(time.time())}",
            "type": "sell",
            "crop": crop,
            "quantity": quantity,
            "location": location,
            "price_estimate": "Live Market Rate",
            "status": "🟢 Connecting with Buyers",
            "buyer_name": "AgroTalk Network Buyer",
            "session_id": session_id,
            "timestamp": int(time.time())
        }
        _orders.append(order)
        print(f"📦 [B2B] New sell order: {crop} | {quantity} | {location}", flush=True)

    # Product buy order
    product_match = re.search(r'\[PRODUCT_ORDER_CONFIRMED:\s*([^\]]+)\]', text, re.IGNORECASE)
    if product_match:
        product_name = product_match.group(1).strip()
        order = {
            "id": f"wa_prod_{int(time.time())}",
            "type": "buy",
            "crop": product_name,
            "quantity": "As requested",
            "location": "Delivery to farm",
            "price_estimate": "Agro Store Rate",
            "status": "📦 Order Placed — Processing",
            "buyer_name": "AgroTalk Store",
            "session_id": session_id,
            "timestamp": int(time.time())
        }
        _orders.append(order)
        print(f"🛒 [B2B] New product order: {product_name}", flush=True)

    return order


def _clean_order_tags(text: str) -> str:
    """Remove raw order tags from text before sending to user."""
    text = re.sub(r'\[B2B_ORDER_CONFIRMED:[^\]]+\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[PRODUCT_ORDER_CONFIRMED:[^\]]+\]', '', text, flags=re.IGNORECASE)
    return text.strip()


def get_all_orders() -> List[Dict]:
    return list(reversed(_orders))  # newest first


def get_orders_for_session(session_id: str) -> List[Dict]:
    return [o for o in reversed(_orders) if o.get("session_id") == session_id]


# ─────────────────────────────────────────────────────────────
# AI Service class
# ─────────────────────────────────────────────────────────────

class WhatsAppAIService:
    """
    Handles AI inference for all WhatsApp bridge message types.
    Supports B2B crop selling, input buying, conversation history, market prices, and weather.
    """

    def __init__(self):
        self.nvidia_vision_key = os.getenv("NVIDIA_VISION_KEY")
        self.openrouter_key = os.getenv("OPENROUTER_API_KEY")

        # Primary: NVIDIA NIM endpoint
        if self.nvidia_vision_key:
            self.chat_client = AsyncOpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=self.nvidia_vision_key
            )
            self.chat_model = "meta/llama-3.3-70b-instruct"
            print("🟢 [WhatsApp AI] Chat using NVIDIA NIM (Llama 3.3 70B)")
        elif self.openrouter_key:
            self.chat_client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.openrouter_key
            )
            self.chat_model = "google/gemini-2.0-flash-001"
            print("🟡 [WhatsApp AI] Chat using OpenRouter (Gemini Flash)")
        else:
            self.chat_client = None
            self.chat_model: Optional[str] = None
            print("❌ [WhatsApp AI] No chat API key found!")

        # STT using dedicated service
        self.stt_service = NvidiaSTTService()

        # Node.js backend URL for market data
        self.node_api_url = os.getenv("VITE_API_URL") or "http://localhost:3001"

        # Per-session conversation history: { session_id: [{"role": ..., "content": ...}] }
        self._sessions: Dict[str, List[Dict]] = {}

    def _get_history(self, session_id: str) -> List[Dict]:
        return self._sessions.setdefault(session_id, [])

    def _append_history(self, session_id: str, role: str, content: str):
        history = self._get_history(session_id)
        history.append({"role": role, "content": content})
        # Keep last 10 turns to avoid token overflow
        if len(history) > 20:
            self._sessions[session_id] = history[-20:]

    def clear_session(self, session_id: str):
        self._sessions.pop(session_id, None)

    async def _fetch_market_prices(self, commodity: str, state: Optional[str] = None) -> Optional[str]:
        """Fetch market prices from the Node.js backend proxy."""
        try:
            params = {"commodity": commodity, "limit": 5}
            if state:
                params["state"] = state

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.node_api_url}/market/prices", params=params)
                if response.status_code == 200:
                    data = response.json()
                    records = data.get("records", [])
                    if not records:
                        return None

                    price_info = []
                    for r in records:
                        price_info.append(
                            f"- {r.get('market', 'Unknown')}, {r.get('district', 'Unknown')}, {r.get('state', 'Unknown')}: "
                            f"₹{r.get('modal_price', 'N/A')} (Arrival Date: {r.get('arrival_date', 'N/A')})"
                        )
                    return "\n".join(price_info)
        except Exception as e:
            print(f"⚠️ [Market Fetch] Error: {e}")
        return None

    async def _fetch_weather(self, lat: float = 28.6139, lon: float = 77.2090) -> Optional[str]:
        """Fetch real-time agricultural weather from Open-Meteo."""
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
                f"&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto"
            )
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    d = response.json()
                    curr = d.get("current", {})
                    daily = d.get("daily", {})
                    return (
                        f"Current: {curr.get('temperature_2m')}°C, "
                        f"Humidity: {curr.get('relative_humidity_2m')}%, "
                        f"Wind: {curr.get('wind_speed_10m')}km/h. "
                        f"Today's Range: {daily.get('temperature_2m_min', [0])[0]}°C "
                        f"to {daily.get('temperature_2m_max', [0])[0]}°C."
                    )
        except Exception as e:
            print(f"⚠️ [Weather Fetch] Error: {e}")
        return None

    def _extract_market_intent(self, text: str) -> Optional[Dict[str, str]]:
        """Identify if user is asking for prices and extract commodity."""
        if not text:
            return None
        text_lower = text.lower()
        if not any(kw in text_lower for kw in ["price", "mandi", "rate", "sell", "bhav", "cost", "market", "விலை", "சந்தை", "भाव", "कीमत"]):
            return None
        crops = [
            "onion", "tomato", "potato", "garlic", "ginger", "wheat", "rice", "corn", "maize",
            "cotton", "soybean", "mustard", "chilli", "pomegranate", "banana", "mango", "apple",
            "lemon", "orange", "grapes", "cauliflower", "cabbage", "brinjal", "turmeric",
            "groundnut", "paddy", "coconut", "sugarcane",
        ]
        for crop in crops:
            if crop in text_lower:
                commodity = "Maize" if crop == "corn" else crop.capitalize()
                return {"commodity": commodity}
        return {"commodity": ""}

    def _extract_weather_intent(self, text: str) -> bool:
        if not text: return False
        return any(kw in text.lower() for kw in ["weather", "rain", "temperature", "forecast", "climate", "mausam"])

    def _build_system_prompt(self, language: str, extra_context: str = "") -> str:
        from datetime import datetime
        lang_names = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "mr": "Marathi"}
        target_lang = lang_names.get(language, "English")
        current_date = datetime.now().strftime("%A, %B %d, %Y")

        return (
            f"You are AgroTalk, a friendly and expert agricultural assistant on WhatsApp. "
            f"Today is {current_date}. "
            f"CRITICAL: Respond ONLY in {target_lang}. Every word must be in {target_lang}.\n"
            f"STYLE: Be conversational, warm, and concise. Use WhatsApp formatting (*bold*, _italic_). "
            f"No markdown headers. Use emoji naturally.\n"
            f"{B2B_SYSTEM_PROMPT_CORE}"
            f"{extra_context}"
        )

    async def chat(self, text: str, language: str = "en", session_id: str = "default") -> Dict[str, Any]:
        """
        Run text through the agricultural AI assistant with full B2B support.
        Returns { reply, order } where order is None or a confirmed order dict.
        """
        if not self.chat_client:
            return {"reply": "❌ AI service not configured. Please check your API keys.", "order": None}

        try:
            if not text or not isinstance(text, str):
                return {"reply": "⚠️ Empty or invalid message received.", "order": None}

            # Build context injections
            extra = ""
            market_intent = self._extract_market_intent(text)
            if market_intent:
                commodity = market_intent.get("commodity")
                if commodity:
                    print(f"📈 [Market] Fetching prices for {commodity}...")
                    prices = await self._fetch_market_prices(commodity)
                    if prices:
                        extra += f"\n\nCURRENT MARKET DATA for '{commodity}':\n{prices}\nSummarize briefly."
                    else:
                        extra += f"\n\nNOTICE: User asked for '{commodity}' prices, but none found. Advise checking later."
                else:
                    extra += "\n\nNOTICE: User asked about prices but no crop found. Ask which crop."

            if self._extract_weather_intent(text):
                weather_data = await self._fetch_weather()
                if weather_data:
                    extra += f"\n\nREAL-TIME WEATHER: {weather_data}\nProvide agricultural advice based on this."

            system_prompt = self._build_system_prompt(language, extra)

            # Build messages: system + history + current user message
            history = self._get_history(session_id)
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history[-10:])  # last 5 turns
            messages.append({"role": "user", "content": text})

            print(f"🤖 [WhatsApp Chat] session={session_id} lang={language} '{text[:60]}...'")
            response = await self.chat_client.chat.completions.create(
                model=self.chat_model,
                messages=messages,
                max_tokens=600,
                temperature=0.4
            )
            raw_reply = response.choices[0].message.content.strip()
            print(f"✅ [WhatsApp Chat] {len(raw_reply)} chars")

            # Parse and strip order tags
            order = _parse_and_store_orders(raw_reply, session_id)
            clean_reply = _clean_order_tags(raw_reply)

            # Update history with clean versions (no tags)
            self._append_history(session_id, "user", text)
            self._append_history(session_id, "assistant", clean_reply)

            # If an order was placed, append a formatted confirmation card
            formatted_reply = build_text_reply_wrapper(clean_reply)
            if order:
                formatted_reply += "\n\n" + build_order_confirmation_message(order)

            return {"reply": formatted_reply, "order": order}

        except Exception as e:
            print(f"❌ [WhatsApp Chat] Error: {e}")
            return {"reply": f"⚠️ AI error: {str(e)}", "order": None}

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/ogg", language: str = "en") -> Optional[str]:
        """Transcribe audio bytes using NVIDIA STT."""
        if not self.stt_service:
            print("❌ [STT] No STT service initialized")
            return None
        return await self.stt_service.transcribe_audio(audio_bytes, mime_type, language)

    async def transcribe_and_reply(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/ogg",
        language: str = "en",
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Full pipeline: audio → STT → AI chat (with B2B) → TTS
        Returns: { success, transcript, text_reply, audio_reply_b64, order }
        """
        # Step 1: Transcribe
        transcript = await self.transcribe_audio(audio_bytes, mime_type, language)
        if not transcript:
            return {
                "success": False,
                "transcript": "",
                "text_reply": "⚠️ Sorry, I couldn't understand the audio. Please try again.",
                "audio_reply_b64": None,
                "order": None
            }

        # Step 2: Run through chat (handles B2B, market, weather, history)
        chat_result = await self.chat(transcript, language, session_id)
        raw_reply_for_tts = re.sub(r'[*_~`#]', '', chat_result["reply"])
        raw_reply_for_tts = re.sub(r'\n+', ' ', raw_reply_for_tts).strip()
        # Don't speak the order confirmation card — keep TTS shorter
        if chat_result.get("order"):
            # Only speak the conversational part before the order card
            raw_reply_for_tts = re.sub(r'✅.*', '', raw_reply_for_tts).strip()

        # Step 3: TTS
        audio_reply_b64 = None
        error_context = None
        try:
            from services.nvidia_tts import NvidiaTTSService
            tts = NvidiaTTSService()
            audio_bytes_out = await tts.generate_audio(raw_reply_for_tts, language, force_edge=True)
            if audio_bytes_out:
                audio_reply_b64 = base64.b64encode(audio_bytes_out).decode("utf-8")
                print(f"✅ [TTS] {len(audio_bytes_out)} bytes audio reply")
            else:
                error_context = "TTS returned empty audio"
        except Exception as e:
            error_context = f"TTS Error: {str(e)}"
            print(f"⚠️ [TTS] {e}")

        return {
            "success": True,
            "transcript": transcript,
            "text_reply": chat_result["reply"],
            "audio_reply_b64": audio_reply_b64,
            "order": chat_result.get("order"),
            "error_context": error_context
        }


# Singleton instance
_whatsapp_service: Optional[WhatsAppAIService] = None

def get_whatsapp_service() -> WhatsAppAIService:
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppAIService()
    return _whatsapp_service
