import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { getTextAdvice, getNvidiaTts } from '@/lib/apiClient';
import { toast } from 'sonner';
import { getTranslation } from '@/lib/translations';

interface IWindow {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export default function CallAgentPage() {
    const navigate = useNavigate();
    const {
        language,
        selectedVoice,
        isMuted,
        setIsMuted,
        conversationHistory,
        setConversationHistory,
        ttsAudio,
        setTtsAudio,
        weatherData,
        conversationId,
        setConversationId
    } = useApp();

    const tCall = getTranslation('call', language);

    // --- State ---
    const [callState, setCallState] = useState<'connecting' | 'listening' | 'processing' | 'speaking' | 'idle'>('connecting');
    const callStateRef = useRef(callState);

    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);
    const [transcript, setTranscript] = useState('');
    const [agentSubtitles, setAgentSubtitles] = useState('');

    // --- Refs for Async Safety ---
    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(false);
    const accumulatedTextRef = useRef('');

    // --- Cleanup & Lifecycle ---
    useEffect(() => {
        isActiveRef.current = true;
        setCallState('connecting');

        // Initial Greeting Delay
        const greetingTimer = setTimeout(async () => {
            if (!isActiveRef.current) return;
            const greetings = {
                en: "Hello, I am the AgroTalk Agronomist. How can I help you today?",
                hi: "नमस्ते, मैं एग्रोटॉक कृषिविज्ञानी हूँ। मैं आज आपकी कैसे मदद कर सकता हूँ?",
                ta: "வணக்கம், நான் அக்ரோடாக் வேளாண் நிபுணர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
                te: "నமస్కారం, నేను ఆగ్రోటాక్ వ్యవసాయ శాస్త్రవేత్తను. ఈ రోజు నేను మీకు ఎలా సహాయపడగలను?",
                mr: "नमस्कार, मी ॲग्रोटॉक कृषितज्ज्ञ आहे. आज मी तुम्हाला कशी मदत करू शकेन?"
            };
            const text = greetings[language as keyof typeof greetings] || greetings.en;

            console.log(`🔊 [NVIDIA] Fetching initial greeting (voice: ${selectedVoice})...`);
            try {
                const audioBlob = await getNvidiaTts(text, language, selectedVoice);
                if (audioBlob) {
                    playResponse(text, undefined, audioBlob);
                } else {
                    console.warn("⚠️ Greeting TTS failed, calling playResponse with fallback");
                    playResponse(text);
                }
            } catch (err) {
                console.error("❌ Greeting TTS error:", err);
                playResponse(text);
            }
        }, 1500);

        return () => {
            isActiveRef.current = false;
            clearTimeout(greetingTimer);
            handleCleanup();
        };
    }, []);

    const handleCleanup = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            try { recognitionRef.current.stop(); } catch (e) { }
            recognitionRef.current = null;
        }
        if (ttsAudio) {
            ttsAudio.pause();
            ttsAudio.src = "";
        }
        window.speechSynthesis?.cancel();
    };

    const endCall = () => {
        isActiveRef.current = false;
        handleCleanup();
        setCallState('idle');
        navigate(-1);
    };

    // --- Speech Recognition ---
    const startListening = () => {
        if (!isActiveRef.current) return; // Note: We allow listening even if muted (speaker vs mic)

        const WindowObj = window as unknown as IWindow;
        const Recognition = WindowObj.webkitSpeechRecognition || WindowObj.SpeechRecognition;

        if (!Recognition) {
            toast.error("Speech recognition not supported");
            return;
        }

        handleCleanup(); // Ensure fresh start

        const recognition = new Recognition();
        const langMap: Record<string, string> = {
            'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN', 'en': 'en-US'
        };
        recognition.lang = langMap[language] || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            if (!isActiveRef.current) return;
            setCallState('listening');
            setTranscript('');
            accumulatedTextRef.current = '';
        };

        recognition.onresult = (event: any) => {
            if (!isActiveRef.current || callStateRef.current !== 'listening') return;

            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            if (final) accumulatedTextRef.current += final + ' ';
            const currentFull = (accumulatedTextRef.current + interim).trim();
            setTranscript(currentFull);

            // Silence Detection (3s)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (currentFull.length > 0) {
                silenceTimerRef.current = setTimeout(() => {
                    if (isActiveRef.current && callStateRef.current === 'listening') {
                        submitUserQuery(currentFull);
                    }
                }, 3000);
            }
        };

        recognition.onend = () => {
            // Keep it alive if we didn't explicitly transition away
            if (isActiveRef.current && callStateRef.current === 'listening') {
                try { recognition.start(); } catch (e) { }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Start error:", e);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            try { recognitionRef.current.stop(); } catch (e) { }
            recognitionRef.current = null;
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    // --- AI Logic ---
    const submitUserQuery = async (text: string) => {
        if (!isActiveRef.current || !text.trim() || callStateRef.current !== 'listening') return;

        callStateRef.current = 'processing';
        stopListening();
        setCallState('processing');
        setTranscript('');
        accumulatedTextRef.current = '';

        // Goodbye Detection
        const goodbyeWords = ["bye", "goodbye", "alvida", "khuda hafiz", "bas", "end", "tata", "hang up", "poitu", "vellostha", "avlo"];
        const lower = text.toLowerCase().trim();
        if (goodbyeWords.some(word => lower.includes(word))) {
            const farewells: Record<string, string> = {
                en: "Goodbye! Have a nice day.",
                hi: "नमस्ते! फिर मिलेंगे।",
                ta: "நன்றி, போய் வருகிறேன்!",
                te: "వెళ్లొస్తాను, శుభ దినం!",
                mr: "निरोप घेतो, आपला दिवस शुभ जावो!"
            };
            const farewell = farewells[language] || farewells.en;
            console.log(`🔊 [NVIDIA] Fetching farewell message (voice: ${selectedVoice})...`);
            try {
                const audioBlob = await getNvidiaTts(farewell, language, selectedVoice);
                if (audioBlob) {
                    playResponse(farewell, undefined, audioBlob, true);
                } else {
                    speakText(farewell, true);
                }
            } catch (err) {
                console.error("❌ Farewell TTS error:", err);
                speakText(farewell, true);
            }
            return;
        }

        // Language Switch Detection
        const langMap: Record<string, string> = {
            "english": "en", "angrezi": "en",
            "hindi": "hi",
            "tamil": "ta", "thamizh": "ta", "தமிழ்": "ta",
            "telugu": "te", "teks": "te", "తెలుగు": "te",
            "marathi": "mr", "मराठी": "mr"
        };
        for (const [word, code] of Object.entries(langMap)) {
            if (lower.includes(`speak in ${word}`) || lower.includes(`talk in ${word}`) || lower.includes(`${word} me baat`) || lower.includes(`${word} pesu`) || lower.includes(`${word} lo matladu`) || lower.includes(`change language to ${word}`)) {
                // Change language globally via AppContext
                const WindowObj = window as any;
                if (WindowObj.setGlobalLanguage) {
                    WindowObj.setGlobalLanguage(code);
                }
                
                const switchAcks: Record<string, string> = {
                    en: "Sure! Let's talk in English.",
                    hi: "हाँ, अब हम हिंदी में बात करेंगे।",
                    ta: "சரி, நாம் தமிழில் பேசலாம்.",
                    te: "సరే, మనం తెలుగులో మాట్లాడుకుందాం.",
                    mr: "ठीक आहे, आपण मराठीत बोलूया."
                };
                const ack = switchAcks[code] || switchAcks.en;
                // Wait a moment for State to flush before responding
                setTimeout(() => playResponse(ack), 500);
                return;
            }
        }

        let currentConvId = conversationId;
        if (!currentConvId) {
            currentConvId = `call_${Math.random().toString(36).substring(7)}`;
            setConversationId(currentConvId);
        }

        try {
            const weatherContext = weatherData ? {
                temp: weatherData.current.temperature_2m,
                condition: weatherData.current.weather_code,
                humidity: weatherData.current.relative_humidity_2m
            } : undefined;

            const instruction = " (Reply in 1 short sentence)";
            const result = await getTextAdvice(text + instruction, language, weatherContext, conversationHistory, true, currentConvId, selectedVoice);

            if (result.success && result.advisory) {
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user' as const, content: text },
                    { role: 'assistant' as const, content: result.advisory!.recommendation }
                ].slice(-6));

                playResponse(result.advisory!.recommendation, result.audio);
            } else {
                setCallState('idle');
                toast.error("AI Error");
                startListening();
            }
        } catch (e) {
            console.error("Process error:", e);
            setCallState('idle');
            startListening();
        }
    };

    // --- Playback Handling ---
    const playResponse = (text: string, audioBase64?: string, audioBlob?: Blob, isExit: boolean = false) => {
        if (!isActiveRef.current) return;

        setTranscript('');
        setCallState('speaking');
        setAgentSubtitles(text);

        if (isMuted) {
            console.log("🔇 Agent is muted, showing subtitles only");
            setTimeout(() => onPlaybackEnd(isExit), 2500);
            return;
        }

        const handleAudioPlayback = (audioUrl: string) => {
            const audio = new Audio(audioUrl);
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                console.log("✅ Playback finished normally");
                onPlaybackEnd(isExit);
            };
            audio.onerror = (e) => {
                console.error("❌ Audio playback error:", e);
                URL.revokeObjectURL(audioUrl);
                speakText(text, isExit); // Fallback to browser TTS
            };
            setTtsAudio(audio);
            console.log("▶️ Starting playback...");
            audio.play().catch(err => {
                console.error("❌ Playback play() failed:", err);
                speakText(text);
            });
        };

        if (audioBlob) {
            console.log(`🔊 [NVIDIA] Playing from received Blob (${audioBlob.size} bytes)`);
            const url = URL.createObjectURL(audioBlob);
            handleAudioPlayback(url);
            return;
        }

        if (audioBase64) {
            console.log(`🔊 [NVIDIA] Playing from received Base64 (${audioBase64.length} chars)`);
            try {
                const isWav = audioBase64.startsWith('UklG');
                const mimeType = isWav ? 'audio/wav' : 'audio/mp3';
                console.log(`📄 Detected MIME type: ${mimeType}`);

                const byteCharacters = atob(audioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
                const url = URL.createObjectURL(blob);
                handleAudioPlayback(url);
            } catch (e) {
                console.error("❌ Base64 decode error:", e);
                speakText(text);
            }
        } else {
            console.warn("⚠️ No NVIDIA audio data received, using browser fallback");
            speakText(text);
        }
    };

    const speakText = (text: string, isExit: boolean = false) => {
        if (!('speechSynthesis' in window) || isMuted) {
            onPlaybackEnd(isExit);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const langMap: Record<string, string> = {
            'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN'
        };
        utterance.lang = langMap[language] || 'en-IN';
        utterance.onend = () => onPlaybackEnd(isExit);
        utterance.onerror = () => onPlaybackEnd(isExit);

        window.speechSynthesis.speak(utterance);
    };

    const onPlaybackEnd = (isExit: boolean = false) => {
        if (!isActiveRef.current) return;
        if (isExit) {
            endCall();
            return;
        }
        setCallState('idle');
        setAgentSubtitles('');
        startListening();
    };

    const getStatusText = () => {
        switch (callState) {
            case 'connecting': return tCall.statusConnecting;
            case 'listening': return tCall.statusListening;
            case 'processing': return tCall.statusThinking;
            case 'speaking': return tCall.statusSpeaking;
            case 'idle': return tCall.statusIdle;
            default: return '';
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black" />
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(118,185,0,0.15),transparent_70%)]" />

            {/* Header */}
            <header className="flex items-center justify-between px-6 pt-10 pb-6 z-10 relative">
                <button
                    onClick={endCall}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft size={20} className="text-white/70" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mb-1">{tCall.inCall}</span>
                    <h1 className="text-xl font-bold text-white tracking-tight">{tCall.agentName}</h1>
                </div>
                <div className="w-10 h-10"></div>
            </header>

            {/* Center Area */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 relative px-10">
                <div className={cn(
                    "w-48 h-48 rounded-full border-2 border-white/10 p-1 transition-all duration-700",
                    callState === 'speaking' ? 'border-primary/50 scale-105' : 'scale-100'
                )}>
                    <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                        <img src="/logo.svg" alt="AgroTalk" className="w-24 h-24 object-contain opacity-90" />
                        {(callState === 'speaking' || callState === 'processing') && (
                            <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                        )}
                    </div>
                </div>

                <div className="mt-12 text-center h-6">
                    <p className={cn(
                        "text-sm font-bold tracking-widest uppercase transition-colors duration-500",
                        callState === 'listening' ? 'text-red-500' :
                            callState === 'speaking' ? 'text-primary' :
                                'text-white/40'
                    )}>
                        {getStatusText()}
                    </p>
                </div>
            </div>

            {/* Subtitles Overlay */}
            <div className="absolute bottom-40 left-0 right-0 z-20 pointer-events-none px-8">
                <div className="max-w-xl mx-auto">
                    {(transcript || agentSubtitles) && (
                        <div className="flex justify-center">
                            <span className="bg-black/60 backdrop-blur-md text-white text-center text-lg font-medium px-4 py-2 rounded-xl border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {agentSubtitles || transcript}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Waveform Visualization */}
            <div className="h-32 w-full flex items-center justify-center px-10 z-10 relative">
                <div className="flex items-end gap-1.5 h-16 w-full max-w-xs justify-center">
                    {(callState === 'listening' || callState === 'speaking' || callState === 'processing') ? (
                        Array.from({ length: 24 }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-1 rounded-full transition-all duration-300",
                                    callState === 'listening' ? 'bg-red-500' :
                                        callState === 'speaking' ? 'bg-primary' :
                                            'bg-blue-500'
                                )}
                                style={{
                                    height: callState === 'processing' ? '30%' : `${15 + Math.random() * 85}%`,
                                    transitionDelay: `${i * 20}ms`,
                                    animation: (callState === 'listening' || callState === 'speaking') ? 'wave-simple 1s ease-in-out infinite' : 'none',
                                    animationDelay: `${i * 0.05}s`
                                }}
                            />
                        ))
                    ) : (
                        <div className="h-[1px] w-48 bg-white/20 rounded-full" />
                    )}
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="pb-16 pt-6 px-8 z-10 relative">
                <div className="flex items-center justify-center gap-12 max-w-md mx-auto">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-all border",
                            isMuted ? "bg-white text-black border-white shadow-lg shadow-white/10" : "bg-white/5 text-white border-white/10"
                        )}
                        title={isMuted ? "Unmute Volume" : "Mute Volume"}
                    >
                        {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>

                    <button
                        onClick={() => {
                            if (callState === 'listening') stopListening();
                            else startListening();
                        }}
                        disabled={callState === 'connecting' || callState === 'processing' || callState === 'speaking'}
                        className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center transition-all bg-white/10",
                            callState === 'listening' ? "bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.4)]" : "text-white/40",
                            (callState === 'connecting' || callState === 'processing' || callState === 'speaking') && "opacity-20 cursor-not-allowed"
                        )}
                        title={callState === 'listening' ? "Stop Mic" : "Start Mic"}
                    >
                        <Mic size={32} />
                    </button>

                    <button
                        onClick={endCall}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600/20 text-red-500 border border-red-500/20 hover:bg-red-600/30"
                        title="End Call"
                    >
                        <PhoneOff size={24} />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes wave-simple {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(1.4); }
                }
            `}</style>
        </div>
    );
}
