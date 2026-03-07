"""
WhatsApp AI Service
Handles all multimodal AI processing for the WhatsApp self-message bridge.
Provides: image analysis, text chat, audio STT, and WhatsApp-specific formatting.
"""
import os
import base64
import re
import tempfile
from typing import Optional, Dict, Any
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv

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


# ─────────────────────────────────────────────────────────────
# AI Service class
# ─────────────────────────────────────────────────────────────

class WhatsAppAIService:
    """
    Handles AI inference for all WhatsApp bridge message types.
    Uses NVIDIA's OpenAI-compatible endpoint for:
      - Text chat (llama-3.3-70b-instruct or similar)
      - Audio STT (whisper-large-v3 via NVIDIA NIM)
    """

    AGRO_SYSTEM_PROMPT = (
        "You are AgroTalk, an elite agricultural AI specialist. "
        "Provide expert advice on plant diseases, crop management, and organic farming. "
        "Keep responses professional, highly concise (max 3 sentences unless listing steps), and practical. "
        "Use numbered lists for steps. Do NOT use conversational filler like 'I'm here to help' or 'No need to worry'. "
        "Focus purely on the scientific and practical agricultural solution."
    )

    def __init__(self):
        # NVIDIA OpenAI-compatible endpoint for chat
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
            self.chat_model = "meta-llama/llama-3.2-3b-instruct:free"
            print("🟡 [WhatsApp AI] Chat using OpenRouter fallback")
        else:
            self.chat_client = None
            self.chat_model: Optional[str] = None
            print("❌ [WhatsApp AI] No chat API key found!")

        # STT uses same NVIDIA key
        if self.nvidia_vision_key:
            self.stt_client = AsyncOpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=self.nvidia_vision_key
            )
            print("🟢 [WhatsApp AI] STT using NVIDIA Whisper NIM")
        else:
            self.stt_client = None
            print("⚠️ [WhatsApp AI] No STT client - NVIDIA_VISION_KEY missing")

        # Node.js backend URL for market data
        self.node_api_url = os.getenv("VITE_API_URL") or "http://localhost:3001"

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
                    
                    # Format records into a concise string for the LLM
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

    def _extract_market_intent(self, text: str) -> Optional[Dict[str, str]]:
        """Identify if user is asking for prices and extract commodity."""
        if not text:
            return None
            
        text = text.lower()
        if not any(kw in text for kw in ["price", "mandi", "rate", "bhav", "cost", "market"]):
            return None
        
        # Common crops list to match against
        crops = [
            "onion", "tomato", "potato", "garlic", "ginger", "wheat", "rice", "corn", "maize",
            "cotton", "soybean", "mustard", "chilli", "pomegranate", "banana", "mango", "apple",
            "lemon", "orange", "grapes", "cauliflower", "cabbage", "brinjal"
        ]
        
        found_commodity = None
        for crop in crops:
            if crop in text:
                found_commodity = crop
                break
        
        if found_commodity:
            # Map maize to corn if needed, but the Mandi API usually uses the common name
            commodity_str = str(found_commodity)
            if commodity_str == "corn": commodity_str = "Maize"
            return {"commodity": commodity_str.capitalize()}
        
        return {"commodity": ""} # Mentioned price but no crop found

    async def chat(self, text: str, language: str = "en") -> str:
        """
        Run text through the agricultural AI assistant.
        Returns a WhatsApp-formatted reply string.
        """
        if not self.chat_client:
            return "❌ AI service not configured. Please check your API keys."

        lang_instruction = {
            "hi": "Reply in Hindi.",
            "ta": "Reply in Tamil.",
            "te": "Reply in Telugu.",
            "mr": "Reply in Marathi.",
        }.get(language, "Reply in English.")

        from datetime import datetime
        current_date = datetime.now().strftime("%A, %B %d, %Y")
        
        agro_system_prompt = (
            f"You are AgroTalk, an elite agricultural specialist. "
            f"CONTEXT: Current Date is {current_date}. "
            f"RULES: 1. Be 'SHORT AND SWEET': Max 3 sentences, friendly yet professional. "
            f"2. NO HALLUCINATIONS: Never make up dates, links, or market facts not provided. "
            f"3. GROUNDED: Use only the provided data or general expertise. "
            f"4. Respond only in the requested language."
        )

        try:
            # Step 0: Input Validation
            if not text or not isinstance(text, str):
                return "⚠️ Empty or invalid message received."

            # Step 1: Check for Market Price Intent
            market_intent = self._extract_market_intent(text)
            market_context = ""
            
            if market_intent:
                commodity = market_intent.get("commodity")
                if commodity:
                    print(f"📈 [Market] Fetching prices for {commodity}...")
                    prices = await self._fetch_market_prices(commodity)
                    if prices:
                        market_context = f"\n\nCURRENT MARKET DATA FOR '{commodity}':\n{prices}\n\nSummarize briefly."
                    else:
                        market_context = f"\n\nNOTICE: User asked for '{commodity}' prices, but none found. Advise checking later."
                else:
                    market_context = "\n\nNOTICE: User asked about prices but no crop found. Ask which crop."

            print(f"🤖 [WhatsApp Chat] Sending: '{str(text)[:60]}...' (lang={language})")
            response = await self.chat_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": f"{agro_system_prompt} {lang_instruction} {market_context}"},
                    {"role": "user", "content": text}
                ],
                max_tokens=600,
                temperature=0.3
            )
            reply = response.choices[0].message.content.strip()
            print(f"✅ [WhatsApp Chat] Got {len(reply)} char reply")
            return build_text_reply_wrapper(reply)
        except Exception as e:
            print(f"❌ [WhatsApp Chat] Error: {e}")
            return f"⚠️ AI error: {str(e)}"

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/ogg") -> Optional[str]:
        """
        Transcribe audio bytes using NVIDIA Whisper NIM or fallback.
        Returns transcription text or None.
        """
        if not self.stt_client:
            print("❌ [STT] No STT client available")
            return None

        # Determine file extension
        ext_map = {
            "audio/ogg": ".ogg",
            "audio/mpeg": ".mp3",
            "audio/mp4": ".m4a",
            "audio/wav": ".wav",
            "audio/webm": ".webm",
        }
        ext = ext_map.get(mime_type, ".ogg")

        tmp_path = None
        try:
            # Write bytes to temp file
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            print(f"🎙️ [STT] Transcribing {len(audio_bytes)} bytes ({mime_type})...")

            with open(tmp_path, "rb") as audio_file:
                transcription = await self.stt_client.audio.transcriptions.create(
                    model="nvidia/whisper-large-v3",
                    file=audio_file,
                )

            transcript = transcription.text.strip()
            print(f"✅ [STT] Transcript: '{transcript}'")
            return transcript
        except Exception as e:
            print(f"❌ [STT] NVIDIA Whisper-Large-v3 failed: {e}")
            return None
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def transcribe_and_reply(
        self, audio_bytes: bytes, mime_type: str = "audio/ogg", language: str = "en"
    ) -> Dict[str, Any]:
        """
        Full pipeline: audio → STT → AI chat → TTS
        Returns: { transcript, text_reply, audio_reply_b64 }
        """
        # Step 1: Transcribe
        transcript = await self.transcribe_audio(audio_bytes, mime_type)
        if not transcript:
            return {
                "transcript": "",
                "text_reply": "⚠️ Sorry, I couldn't understand the audio. Please try again.",
                "audio_reply_b64": None
            }

        # Step 2: Get AI text reply
        lang_instruction = {
            "hi": "Reply in Hindi.",
            "ta": "Reply in Tamil.",
            "te": "Reply in Telugu.",
            "mr": "Reply in Marathi.",
        }.get(language, "Reply in English.")

        market_intent = self._extract_market_intent(transcript)
        market_context = ""
        if market_intent:
            commodity = market_intent.get("commodity")
            if commodity:
                print(f"📈 [Market-Audio] Fetching prices for {commodity}...")
                prices = await self._fetch_market_prices(commodity)
                if prices:
                    market_context = f"\n\nCURRENT MARKET DATA FOR '{commodity}':\n{prices}\n\nSummarize very briefly."
                else:
                    market_context = f"\n\nNOTICE: User asked for '{commodity}' prices, but none found."
            else:
                market_context = "\n\nNOTICE: User asked about prices but no crop found. Ask which crop."

        try:
            response = await self.chat_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": f"{self.AGRO_SYSTEM_PROMPT} {lang_instruction} {market_context} Keep the reply under 100 words since it will be spoken aloud."},
                    {"role": "user", "content": transcript}
                ],
                max_tokens=200,
                temperature=0.6
            )
            raw_reply = response.choices[0].message.content.strip()
        except Exception as e:
            raw_reply = f"I received your message but couldn't process it: {str(e)}"

        # Clean AI reply text for TTS (remove markdown)
        tts_text = re.sub(r'[*_~`#]', '', raw_reply)
        tts_text = re.sub(r'\n+', ' ', tts_text).strip()

        # Step 3: TTS (import here to avoid circular import)
        audio_reply_b64 = None
        try:
            from services.nvidia_tts import NvidiaTTSService
            tts = NvidiaTTSService()
            audio_bytes_out = await tts.generate_audio(tts_text, language)
            if audio_bytes_out:
                audio_reply_b64 = base64.b64encode(audio_bytes_out).decode("utf-8")
                print(f"✅ [TTS] Generated {len(bytes(audio_bytes_out))} bytes of audio reply")
        except Exception as e:
            print(f"⚠️ [TTS] Could not generate audio reply: {e}")

        text_reply = build_audio_reply_wrapper(transcript, raw_reply)

        return {
            "transcript": transcript,
            "text_reply": text_reply,
            "audio_reply_b64": audio_reply_b64
        }


# Singleton instance
_whatsapp_service: Optional[WhatsAppAIService] = None

def get_whatsapp_service() -> WhatsAppAIService:
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppAIService()
    return _whatsapp_service
