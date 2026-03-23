# AgroTalk Backend

Express.js backend for the AgroTalk agricultural assistant platform.

## Features

- 🌿 **Image Analysis** — NVIDIA Vision-powered crop/plant disease detection
- 🗣️ **Text-to-Speech** — NVIDIA Riva TTS for multilingual audio
- 🎤 **Speech-to-Text** — NVIDIA Riva STT for voice transcription
- 💬 **AI Chat** — OpenRouter-powered conversational AI for farming advice
- 🌤️ **Weather** — Real-time weather data for agricultural planning
- 📚 **Knowledge Library** — Agricultural knowledge base
- 📈 **Market Data** — Crop market prices and trends
- 📱 **WhatsApp Bridge** — WhatsApp integration via Socket.io

## Deployment on Render

1. Fork/push this branch to your GitHub repo
2. Connect the repo to [Render](https://render.com)
3. Render will auto-detect `render.yaml` and configure the service
4. Set the following environment variables in the Render dashboard:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI chat |
| `NVIDIA_VISION_KEY` | NVIDIA API key for image analysis |
| `NVIDIA_TTS_KEY` | NVIDIA API key for text-to-speech |
| `NVIDIA_TTS_FUNCTION_ID` | NVIDIA TTS function ID |
| `NVIDIA_STT_KEY` | NVIDIA API key for speech-to-text |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON string |
| `FRONTEND_URL` | Your frontend URL (for CORS) |

## Local Development

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env
npm install
npm start
```

Server runs on `http://localhost:3001`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/analyze-image` | Analyze crop/plant images |
| POST | `/transcribe` | Speech-to-text transcription |
| POST | `/chat` | AI chat conversation |
| GET | `/weather` | Weather data |
| GET | `/library` | Agricultural knowledge |
| GET | `/market` | Market prices |
| POST | `/api/tts` | Text-to-speech |
| * | `/api/whatsapp` | WhatsApp bridge |
