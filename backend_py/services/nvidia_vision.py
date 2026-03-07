import os
import base64
from typing import Optional, Dict, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

class NvidiaVisionService:
    def __init__(self):
        self.api_key = os.getenv("NVIDIA_VISION_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.client = None
        
        if self.api_key:
            self.client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key
            )
            print(f"🟢 NVIDIA Vision Service initialized with key: {self.api_key[:10]}...")
        else:
            print("🟡 NVIDIA_VISION_KEY not found in environment. NVIDIA mode will be disabled.")

    async def analyze_image(self, base64_image_data: str, language: str = "en") -> Dict[str, Any]:
        """
        Analyzes an image using Meta Llama 3.2 90B Vision on NVIDIA NIM.
        """
        if not self.client:
            return {
                "success": False,
                "error": "NVIDIA API Key is missing. Please add it to your .env file."
            }

        # Ensure image data doesn't have the data:image/png;base64, prefix if passed directly
        if "," in base64_image_data:
            base64_image_data = base64_image_data.split(",")[1]

        try:
            print(f"🧠 [NVIDIA] Sending request to Llama 3.2 90B Vision ({language})...")
            
            # Map language codes to names for the prompt
            lang_names = {
                "en": "English",
                "hi": "Hindi",
                "ta": "Tamil",
                "te": "Telugu",
                "mr": "Marathi"
            }
            target_lang_name = lang_names.get(language, "English")
            
            # Always generate ALL 5 languages for storage
            all_lang_keys = (
                "disease_name, disease_name_hindi, disease_name_tamil, disease_name_telugu, disease_name_marathi, "
                "confidence, severity, "
                "description, description_hindi, description_tamil, description_telugu, description_marathi, "
                "symptoms, symptoms_hindi, symptoms_tamil, symptoms_telugu, symptoms_marathi, "
                "treatment_steps, treatment_steps_hindi, treatment_steps_tamil, treatment_steps_telugu, treatment_steps_marathi, "
                "organic_options, organic_options_hindi, organic_options_tamil, organic_options_telugu, organic_options_marathi, "
                "prevention_tips, prevention_tips_hindi, prevention_tips_tamil, prevention_tips_telugu, prevention_tips_marathi, "
                "crop_identified, crop_identified_hindi, crop_identified_tamil, crop_identified_telugu, crop_identified_marathi"
            )

            # Clear, strict prompt for JSON-only output
            system_prompt = (
                f"You are an expert plant pathologist AI. Your ONLY output must be a valid JSON object.\n"
                f"DO NOT include any text, explanation, or code blocks before or after the JSON.\n"
                f"DO NOT use asterisks, bullet symbols, or markdown formatting in any string values.\n\n"
                f"Return EXACTLY this JSON structure (all text in {target_lang_name}):\n"
                f'{{"crop_identified":"<plant name>","disease_name":"<disease or Healthy>","confidence":95,"severity":"<low|medium|high>","description":"<plain text explanation>","symptoms":["<symptom 1>","<symptom 2>","<symptom 3>"],"treatment_steps":["<step 1>","<step 2>","<step 3>"],"prevention_tips":["<tip 1>","<tip 2>"],"organic_options":["<option 1>","<option 2>"],"is_healthy":false}}\n\n'
                f"STRICT Rules:\n"
                f"- If the plant appears healthy: disease_name=\"Healthy\", severity=\"low\", is_healthy=true\n"
                f"- All string values must be plain text with NO asterisks, NO dashes, NO bullets\n"
                f"- confidence is an integer 0-100\n"
                f"- severity is exactly \"low\", \"medium\", or \"high\"\n"
                f"- Output ONLY the JSON object, nothing else"
            )

            response = await self.client.chat.completions.create(
                model="meta/llama-3.2-90b-vision-instruct",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this plant image and return the JSON diagnosis."},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image_data}"},
                            },
                        ],
                    }
                ],
                max_tokens=2048,
                temperature=0.1,
                timeout=45.0
            )

            raw_content = response.choices[0].message.content.strip()
            print(f"📄 [NVIDIA] Raw Response Length: {len(raw_content)} chars")
            print(f"📄 [NVIDIA] First 200 chars: {raw_content[:200]}")
            
            import json
            import re
            
            # 1. Try JSON parsing - multiple strategies
            result_json = None
            
            # Strategy A: Strip markdown code blocks if present
            cleaned = re.sub(r'^```(?:json)?\s*', '', raw_content, flags=re.MULTILINE)
            cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE).strip()
            
            # Strategy B: Parse cleaned content directly
            try:
                result_json = json.loads(cleaned)
            except:
                pass
            
            # Strategy C: Find first { to last }
            if not result_json:
                start_idx = cleaned.find('{')
                end_idx = cleaned.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    try:
                        result_json = json.loads(cleaned[start_idx:end_idx+1])
                    except:
                        pass
            
            if result_json:
                # Clean up list fields - strip any markdown artifacts from list items
                list_fields = ["symptoms", "treatment_steps", "prevention_tips", "organic_options"]
                for field in list_fields:
                    if field in result_json and isinstance(result_json[field], list):
                        result_json[field] = [
                            re.sub(r'^[\s\*\-•\d\.]+', '', str(item)).strip()
                            for item in result_json[field]
                            if item and str(item).strip()
                        ]
                
                # Clean string fields of markdown artifacts
                for field in ["disease_name", "crop_identified", "description"]:
                    if field in result_json and isinstance(result_json[field], str):
                        result_json[field] = re.sub(r'\*+', '', result_json[field]).strip()
                
                # Normalize confidence to a proper integer
                try:
                    conf = int(float(str(result_json.get("confidence", 95))))
                    result_json["confidence"] = max(80, min(99, conf)) if conf > 0 else 95
                except:
                    result_json["confidence"] = 95
                
                # Ensure is_healthy matches disease_name
                if "disease_name" in result_json:
                    is_healthy = "healthy" in str(result_json["disease_name"]).lower()
                    result_json["is_healthy"] = is_healthy
                    if is_healthy:
                        result_json["severity"] = "low"
                
                # Validate severity
                if result_json.get("severity") not in ["low", "medium", "high"]:
                    result_json["severity"] = "medium"
                
                print(f"✅ [NVIDIA] Parsed: Crop={result_json.get('crop_identified')}, Disease={result_json.get('disease_name')}")
                return {"success": True, "analysis": result_json}

            # 2. Smart Parsing Fallback
            structured_result = self._smart_parse_text(raw_content, language)
            return {
                "success": True,
                "analysis": structured_result
            }

        except Exception as e:
            print(f"❌ [NVIDIA] Error during analysis: {e}")
            return {
                "success": False,
                "error": f"NVIDIA API Error: {str(e)}"
            }

    def _smart_parse_text(self, text: str, language: str = "en") -> Dict[str, Any]:
        """
        Robustly extracts structured data from plain text if JSON parsing fails.
        """
        print(f"🤖 [NVIDIA] Running Smart Parser on natural language ({language})...")
        import re
        
        # Language names mapping
        lang_names = {
            "en": "English",
            "hi": "Hindi",
            "ta": "Tamil",
            "te": "Telugu",
            "mr": "Marathi"
        }
        
        # Determine suffix for localized keys
        is_english = (language == "en")
        suffix = f"_{language}" if not is_english else ""
        
        # Default empty structure (User requested 99% default for NVIDIA)
        result = {
            "disease_name": "AI Specialist Insight",
            "confidence": 99,
            "severity": "medium",
            "description": "",
            "symptoms": [],
            "treatment_steps": [],
            "organic_options": [],
            "prevention_tips": [],
            "crop_identified": "Plant"
        }
        
        # Initialize ALL language keys to empty lists/strings to match frontend expectations
        languages = ["hindi", "tamil", "telugu", "marathi"]
        
        for lang in languages:
            suffix = f"_{lang}"
            result[f"disease_name{suffix}"] = ""
            result[f"description{suffix}"] = ""
            result[f"symptoms{suffix}"] = []
            result[f"treatment_steps{suffix}"] = []
            result[f"organic_options{suffix}"] = []
            result[f"prevention_tips{suffix}"] = []
            result[f"crop_identified{suffix}"] = ""

        # Map current requested language to its specific message if needed (fallback mostly relies on English extracted text)
        # But we ensure keys exist.

        # Helper to clean up lines and remove bullet points
        def clean_line(line):
            return re.sub(r'^[\s\d\.\-\*•]+', '', line).strip()

        # Split text into sections by likely headers
        # We look for headers like **Symptoms**, Symptoms:, 1. Symptoms, etc.
        pattern = r'\n\s*[\d\.]*\s?\*?\*?(How it was formed|How we can prevent|How we can recover|Symptoms|Crop Identified|Plant Identified|Product|Disease Name)\*?\*?:?'
        sections = re.split(pattern, text, flags=re.IGNORECASE)
        
        # The first part is usually a general description or intro
        intro_text = sections[0].strip() if sections else ""
        result["description"] = intro_text
        
        # Comprehensive list of common crops to check for (Fallback)
        common_crops = [
            "Apple", "Tomato", "Cucumber", "Potato", "Onion", "Grape", "Orange", "Banana", "Lemon", "Mango",
            "Pepper", "Chill", "Strawberry", "Corn", "Rice", "Wheat", "Soybean", "Pomegranate",
            "Guava", "Papaya", "Brinjal", "Eggplant", "Cabbage", "Cauliflower", "Rosemary", "Tulsi", "Neem",
            "Pea", "Peas"
        ]

        # Helper to extract crop from any block of text
        def extract_crop_name(block):
            # Words to explicitly IGNORE if matched by regex
            ignored_words = {"fungal", "bacterial", "viral", "disease", "infection", "severe", "common", "issue", "problem", "leaf", "plant"}
            
            # 1. Check for regex patterns
            match = re.search(r'(?:in|of|on|identified as|is a|occurs in|analysis of)\s+([a-zA-Z]{3,20})', block, re.IGNORECASE)
            if match:
                found = match.group(1).capitalize()
                found = re.sub(r"'s$|s$|es$|leaf$|leaves$", '', found, flags=re.IGNORECASE)
                
                if len(found) >= 3 and found.lower() not in ignored_words: 
                    if found.lower() == "maize": return "Corn"
                    return found
            
            # 2. Check for explicit keywords from our list
            for crop in common_crops:
                if re.search(rf'\b{crop}\b', block, re.IGNORECASE):
                    return crop
            
            # Explicit check for Maize
            if re.search(r'\bmaize\b', block, re.IGNORECASE):
                return "Corn"
                
            return None

        # Iterate through matched headers and content
        found_crop = None
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                header = sections[i].lower()
                content = sections[i+1].strip()
                lines = [clean_line(l) for l in content.split('\n') if clean_line(l)]

                if "how it was formed" in header:
                    result["description"] = content
                elif "how we can prevent" in header:
                    result["prevention_tips"] = lines
                elif "how we can recover" in header:
                    result["treatment_steps"] = lines
                elif "symptoms" in header:
                    result["symptoms"] = lines
                elif any(x in header for x in ["crop identified", "plant identified", "product"]):
                    # DYNAMIC: Take what the AI said!
                    val = clean_line(content.split('\n')[0])
                    if val and len(val) > 2:
                        found_crop = val
                        # Normalize Maize to Corn
                        if "maize" in found_crop.lower():
                            found_crop = "Corn"
                        result["crop_identified"] = found_crop
                elif "disease name" in header:
                    result["disease_name"] = clean_line(content.split('\n')[0])
        
        # Fallback for crop if headers didn't give it
        if result["crop_identified"] == "Plant":
            potential_crop = extract_crop_name(text) # Scan entire text for crop keywords
            if potential_crop: result["crop_identified"] = potential_crop

        # POST-PROCESSING: Handle Healthy case & Normalization
        full_text = text.lower()
        
        # 1. Robust Healthy Detection
        is_actually_healthy = any(word in full_text for word in ["healthy", "normal", "no disease", "clear", "good health", "thriving"])
        
        # If the AI starts with "Healthy" or says it's healthy, and no specific disease was found by headers
        if (full_text.startswith("healthy") or is_actually_healthy) and ("none" in result["disease_name"].lower() or result["disease_name"] == "AI Specialist Insight"):
            result["disease_name"] = "Healthy"
            result["severity"] = "low"
            result["is_healthy"] = True
            
            # Localized versions
            # Localized versions for "Healthy"
            result["disease_name_hindi"] = "स्वस्थ"
            result["disease_name_tamil"] = "ஆரோக்கியமானது"
            result["disease_name_telugu"] = "ఆరోగ్యకరమైనది"
            result["disease_name_marathi"] = "निरोगी"
        else:
            # Default to medium if not clearly healthy and not already set
            if result["disease_name"] == "AI Specialist Insight":
                 # If severe keywords found, bump it
                 if any(w in full_text for w in ["severe", "deadly", "critical", "kill", "destroy"]):
                     result["severity"] = "high"
                 result["is_healthy"] = False
            else:
                 # If we found a disease name, check if it explicitly says healthy
                 if "healthy" in result["disease_name"].lower():
                     result["severity"] = "low"
                     result["is_healthy"] = True
                 else:
                     result["is_healthy"] = False

        return result
