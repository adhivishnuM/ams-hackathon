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

        // Initial Greeting
        const greetingTimer = setTimeout(() => {
            if (!isActiveRef.current) return;
            const greetings = {
                en: "Hello, I am the AgroTalk Agronomist. How can I help you today?",
                hi: "नमस्ते, मैं एग्रोटॉक कृषिविज्ञानी हूँ। मैं आज आपकी कैसे मदद कर सकता हूँ?",
                ta: "வணக்கம், நான் அக்ரோடாக் வேளாண் நிபுணர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
                te: "నమస్కారం, నేను ఆగ్రోటాక్ వ్యవసాయ శాస్త్రవేత్తను. ఈ రోజు నేను మీకు ఎలా సహాయపడగలను?",
                mr: "नमस्कार, मी ॲग्रोटॉक कृषितज्ज्ञ आहे. आज मी तुम्हाला कशी मदत करू शकेन?"
            };
            const text = greetings[language as keyof typeof greetings] || greetings.en;
            playResponse(text);
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
        if (!isActiveRef.current || isMuted) return;

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
            if (!isActiveRef.current) return;

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

            // Silence Detection (2s)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (currentFull.length > 0) {
                silenceTimerRef.current = setTimeout(() => {
                    if (isActiveRef.current) {
                        submitUserQuery(currentFull);
                    }
                }, 2000);
            }
        };

        recognition.onend = () => {
            if (isActiveRef.current && callState === 'listening' && !isMuted) {
                // If it died unexpectedly but we should be listening, restart
                try { recognition.start(); } catch (e) { }
            }
        };

        recognition.onerror = (e: any) => {
            console.error("Recognition error:", e);
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
        if (!isActiveRef.current || !text.trim()) return;

        stopListening();
        setCallState('processing');
        setTranscript(''); // Clear for "Thinking" state

        // --- Goodbye Detect ---
        const goodbyeWords = ["bye", "goodbye", "alvida", "khuda hafiz", "phir milenge", "bas", "end", "tata", "hang up"];
        const lower = text.toLowerCase().trim();
        if (goodbyeWords.some(word => lower.includes(word))) {
            const farewell = language === 'hi' ? "नमस्ते! फिर मिलेंगे।" : "Goodbye! Have a nice day.";
            setAgentSubtitles(farewell);
            // Say farewell before hanging up
            speakText(farewell, true);
            return;
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
                if (!isMuted) startListening();
            }
        } catch (e) {
            console.error("Process error:", e);
            setCallState('idle');
            if (!isMuted) startListening();
        }
    };

    // --- Playback ---
    const playResponse = (text: string, audioBase64?: string) => {
        if (!isActiveRef.current) return;

        setTranscript(''); // Clear any remaining user text
        setCallState('speaking');
        setAgentSubtitles(text);

        if (audioBase64) {
            try {
                const byteCharacters = atob(audioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);

                audio.onended = () => {
                    URL.revokeObjectURL(url);
                    onPlaybackEnd();
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    speakText(text); // Fallback
                };

                setTtsAudio(audio);
                audio.play().catch(() => speakText(text));
            } catch (e) {
                speakText(text);
            }
        } else {
            speakText(text);
        }
    };

    const speakText = (text: string, isExit: boolean = false) => {
        if (!('speechSynthesis' in window)) {
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
        if (!isMuted) startListening();
    };

    // --- UI State Helpers ---
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
            {/* Background */}
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

            {/* Center - Avatar */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 relative px-10">
                <div className={cn(
                    "w-48 h-48 rounded-full border-2 border-white/10 p-1 transition-all duration-700",
                    callState === 'speaking' ? 'border-primary/50 scale-105' : 'scale-100'
                )}>
                    <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                        <img src="/logo.svg" alt="AgroTalk" className="w-24 h-24 object-contain opacity-90" />
                        {callState === 'speaking' && (
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

            {/* Waveform Visualization */}
            <div className="h-32 w-full flex items-center justify-center px-10 z-10 relative">
                <div className="flex items-end gap-1.5 h-16 w-full max-w-xs justify-center">
                    {(callState === 'listening' || callState === 'speaking' || callState === 'processing') ? (
                        Array.from({ length: 20 }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-1 rounded-full transition-all duration-300",
                                    callState === 'listening' ? 'bg-red-500' :
                                        callState === 'speaking' ? 'bg-primary' :
                                            'bg-blue-500'
                                )}
                                style={{
                                    height: callState === 'processing' ? '30%' : `${15 + Math.random() * 80}%`,
                                    transitionDelay: `${i * 30}ms`,
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

            {/* Controls */}
            <div className="pb-16 pt-6 px-8 z-10 relative">
                <div className="flex items-center justify-center gap-12 max-w-md mx-auto">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-all border",
                            isMuted ? "bg-white text-black border-white" : "bg-white/5 text-white border-white/10"
                        )}
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
                            callState === 'listening' ? "bg-red-600 shadow-[0_0_25px_rgba(220,38,38,0.4)]" : "text-white/40",
                            (callState === 'connecting' || callState === 'processing' || callState === 'speaking') && "opacity-20 cursor-not-allowed"
                        )}
                    >
                        <Mic size={32} />
                    </button>

                    <button
                        onClick={endCall}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600/20 text-red-500 border border-red-500/20"
                    >
                        <PhoneOff size={24} />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes wave-simple {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(1.5); }
                }
            `}</style>
        </div>
    );
}
