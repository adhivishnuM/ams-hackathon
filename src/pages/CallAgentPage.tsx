import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, ArrowLeft, Phone, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { getTextAdvice, getNvidiaTts } from '@/lib/apiClient';
import { toast } from 'sonner';

interface IWindow {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export default function CallAgentPage() {
    const navigate = useNavigate();
    const {
        language,
        selectedVoice,
        isOnline,
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

    const [callState, setCallState] = useState<'connecting' | 'listening' | 'processing' | 'speaking' | 'idle'>('connecting');
    const [transcript, setTranscript] = useState('');
    const [agentSubtitles, setAgentSubtitles] = useState('');
    const recognitionRef = useRef<any>(null);
    const accumulatedTranscriptRef = useRef('');
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(true);
    const callStateRef = useRef(callState);

    // Keep callStateRef in sync
    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);

    // Start connection simulation
    useEffect(() => {
        const timer = setTimeout(() => {
            const greetings = {
                en: "Hello, I am the AgroTalk Agronomist. How can I help you today?",
                hi: "नमस्ते, मैं एग्रोटॉक कृषिविज्ञानी हूँ। मैं आज आपकी कैसे मदद कर सकता हूँ?",
                ta: "வணக்கம், நான் அக்ரோடாக் வேளாண் நிபுணர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
                te: "నమస్కారం, నేను ఆగ్రోటాక్ వ్యవసాయ శాస్త్రవేత్తను. ఈ రోజు నేను మీకు ఎలా సహాయపడగలను?",
                mr: "नमस्कार, मी ॲग्रोटॉक कृषितज्ज्ञ आहे. आज मी तुम्हाला कशी मदत करू शकेन?"
            };
            const text = greetings[language as keyof typeof greetings] || greetings.en;
            playResponse(text);
        }, 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        isActiveRef.current = true;
        return () => {
            isActiveRef.current = false;
            // Immediate cleanup
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (recognitionRef.current) {
                // Remove listeners to prevent onend restart
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.stop();
            }
            if (ttsAudio) {
                ttsAudio.pause();
                ttsAudio.currentTime = 0;
            }
            window.speechSynthesis?.cancel();
        };
    }, [ttsAudio]); // Keep ttsAudio here to handle state-based audio cleanup

    const endCall = () => {
        isActiveRef.current = false;
        setCallState('idle');

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.stop();
        }
        if (ttsAudio) {
            ttsAudio.pause();
            ttsAudio.currentTime = 0;
            setTtsAudio(null);
        }
        window.speechSynthesis?.cancel();
        navigate(-1);
    };

    const cleanMarkdown = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .replace(/#{1,6}\s+(.*)/g, '$1')
            .replace(/[-*]\s+/g, '')
            .replace(/[`](.*?)[`]/g, '$1')
            .trim();
    };

    const speakText = async (text: string) => {
        if (isMuted) {
            setCallState('idle');
            return;
        }
        setCallState('speaking');

        window.speechSynthesis?.cancel();
        if (ttsAudio) {
            ttsAudio.pause();
            ttsAudio.currentTime = 0;
        }

        try {
            const cleanedText = cleanMarkdown(text);
            if (navigator.onLine) {
                const audioBlob = await getNvidiaTts(cleanedText, language);
                if (audioBlob) {
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.onended = () => {
                        if (!isActiveRef.current) return;
                        setCallState('idle');
                        setAgentSubtitles('');
                        URL.revokeObjectURL(audioUrl);
                        if (!isMuted) startListening();
                    };
                    audio.onerror = () => {
                        if (!isActiveRef.current) return;
                        setCallState('idle');
                        setAgentSubtitles('');
                        if (!isMuted) startListening();
                    };
                    setTtsAudio(audio);
                    setAgentSubtitles(text);
                    await audio.play();
                    return;
                }
            }
        } catch (e) {
            console.warn("Cloud TTS failed, fallback to browser", e);
        }

        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
            const cleanedText = cleanMarkdown(text);
            const utterance = new SpeechSynthesisUtterance(cleanedText);
            const langMap: Record<string, string> = {
                'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN'
            };
            utterance.lang = langMap[language] || 'en-IN';
            utterance.onend = () => {
                if (!isActiveRef.current) return;
                setCallState('idle');
                setAgentSubtitles('');
                if (!isMuted) startListening();
            };
            utterance.onerror = () => {
                if (!isActiveRef.current) return;
                setCallState('idle');
                setAgentSubtitles('');
                if (!isMuted) startListening();
            };
            setAgentSubtitles(text);
            window.speechSynthesis.speak(utterance);
        } else {
            setCallState('idle');
        }
    };

    const playResponse = (text: string, audioBase64?: string) => {
        if (isMuted) {
            setCallState('idle');
            return;
        }
        setCallState('speaking');

        if (audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
            audio.onended = () => {
                if (!isActiveRef.current) return;
                setCallState('idle');
                setAgentSubtitles('');
                if (!isMuted) startListening();
            };
            audio.onerror = () => {
                speakText(text);
            };
            setTtsAudio(audio);
            setAgentSubtitles(text);
            audio.play().catch(() => speakText(text));
        } else {
            speakText(text);
        }
    };

    const processResponse = async (text: string) => {
        if (!isActiveRef.current) return;
        let currentConvId = conversationId;
        if (!currentConvId) {
            currentConvId = `call_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
            setConversationId(currentConvId);
        }

        setCallState('processing');

        try {
            const weatherContext = weatherData ? {
                temp: weatherData.current.temperature_2m,
                condition: weatherData.current.weather_code,
                humidity: weatherData.current.relative_humidity_2m
            } : undefined;

            const promptText = text + " (Reply in 1 short sentence)";
            const result = await getTextAdvice(promptText, language, weatherContext, conversationHistory, true, currentConvId, selectedVoice);

            if (result.success && result.advisory) {
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user' as const, content: text },
                    { role: 'assistant' as const, content: result.advisory!.recommendation }
                ].slice(-6));
                setTimeout(() => playResponse(result.advisory!.recommendation, result.audio), 300);
            } else {
                setCallState('idle');
                toast.error("Failed to get response");
            }
        } catch (e) {
            console.error('Call error:', e);
            setCallState('idle');
            toast.error("Network error");
        }
    };

    const toggleMicrophone = () => {
        if (callState === 'connecting') return;

        if (callState === 'listening') {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        const WindowObj = window as unknown as IWindow;
        const Recognition = WindowObj.webkitSpeechRecognition || WindowObj.SpeechRecognition;

        if (Recognition) {
            try {
                if (ttsAudio) {
                    ttsAudio.pause();
                }
                window.speechSynthesis?.cancel();

                const recognition = new Recognition();
                const langMap: Record<string, string> = {
                    'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN', 'en': 'en-US'
                };
                recognition.lang = langMap[language] || 'en-US';
                recognition.continuous = true;
                recognition.interimResults = true;
                accumulatedTranscriptRef.current = '';

                recognition.onstart = () => {
                    setCallState('listening');
                    setTranscript('');
                    // Initial silence timeout if user says nothing at all
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        if (callStateRef.current === 'listening' && accumulatedTranscriptRef.current === '' && transcript === '') {
                            console.log("Initial 2s silence, stopping listener");
                            stopListening();
                        }
                    }, 2000); // 2s of initial silence as requested
                };

                recognition.onresult = (event: any) => {
                    let interimTranscript = '';
                    let finalChunk = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalChunk += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalChunk) {
                        accumulatedTranscriptRef.current += finalChunk + ' ';
                    }
                    const newTranscript = accumulatedTranscriptRef.current + interimTranscript;
                    setTranscript(newTranscript);

                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    if (newTranscript.trim().length > 0) {
                        silenceTimerRef.current = setTimeout(() => {
                            if (callStateRef.current === 'listening') {
                                console.log("Silence detected, processing response...");
                                stopListening();
                            }
                        }, 2000); // 2s silence detection as requested
                    }
                };

                recognition.onend = () => {
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    if (callStateRef.current === 'listening') {
                        stopListening();
                    }
                };

                recognition.onerror = (e: any) => {
                    console.error('Speech recognition error in call:', e);
                    setCallState('idle');
                };

                recognition.start();
                recognitionRef.current = recognition;
            } catch (e) {
                console.error('Speech recognition setup error:', e);
                setCallState('idle');
            }
        } else {
            toast.error("Speech recognition is not supported in this browser.");
        }
    };

    const stopListening = async () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        const finalPayload = accumulatedTranscriptRef.current.trim() || transcript.trim();
        if (finalPayload) {
            await processResponse(finalPayload);
            setTranscript('');
        } else {
            setCallState('idle');
        }
    };

    // UI helpers
    const getStatusText = () => {
        switch (callState) {
            case 'connecting': return 'Connecting...';
            case 'listening': return 'Listening...';
            case 'processing': return 'Thinking...';
            case 'speaking': return 'Speaking...';
            case 'idle': return 'Agent is on line';
            default: return '';
        }
    };

    const getPulsingColor = () => {
        switch (callState) {
            case 'listening': return 'bg-red-500';
            case 'speaking': return 'bg-green-500';
            case 'processing': return 'bg-blue-500';
            case 'connecting': return 'bg-yellow-500';
            case 'idle': return 'bg-primary/50';
            default: return 'bg-primary';
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white relative overflow-hidden">
            {/* Subtle Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black" />
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(118,185,0,0.15),transparent_70%)]" />

            {/* Header - In-Call Style */}
            <header className="flex items-center justify-between px-6 pt-10 pb-6 z-10 relative">
                <button
                    onClick={endCall}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft size={20} className="text-white/70" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase mb-1">In Call</span>
                    <h1 className="text-xl font-bold text-white tracking-tight">AgroTalk Agronomist</h1>
                </div>
                <div className="w-10 h-10"></div>
            </header>

            {/* Main Center Area - Avatar Focus */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 relative px-10">
                <div className="relative">
                    <div className={cn(
                        "w-48 h-48 rounded-full border-2 border-white/10 p-1 transition-all duration-700",
                        callState === 'speaking' ? 'border-primary/50 scale-105' : 'scale-100'
                    )}>
                        <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden relative group">
                            <img src="/logo.svg" alt="AgroTalk" className="w-24 h-24 object-contain opacity-90 group-hover:scale-110 transition-transform duration-500" />
                            {callState === 'speaking' && (
                                <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
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

            {/* Horizontal Waveform / Listening Line */}
            <div className="h-24 w-full flex items-center justify-center px-20 z-10 relative">
                <div className="flex items-center gap-1.5 h-12 w-full max-w-xs justify-center">
                    {(callState === 'listening' || callState === 'speaking' || callState === 'processing') ? (
                        Array.from({ length: 15 }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-1 rounded-full transition-all duration-300",
                                    callState === 'listening' ? 'bg-red-500' :
                                        callState === 'speaking' ? 'bg-primary' :
                                            'bg-blue-500'
                                )}
                                style={{
                                    height: callState === 'processing' ? '40%' : `${10 + Math.random() * 80}%`,
                                    transitionDelay: `${i * 50}ms`,
                                    animation: callState === 'processing' ? 'pulse 1.5s infinite' : 'none'
                                }}
                            />
                        ))
                    ) : (
                        <div className="h-[2px] w-full bg-white/10 rounded-full" />
                    )}
                </div>
            </div>

            {/* Movie-style Subtitles (Minimal, Focused) */}
            <div className="absolute bottom-32 left-0 right-0 z-20 pointer-events-none px-10">
                <div className="max-w-2xl mx-auto flex flex-col items-center justify-center">
                    {(transcript || agentSubtitles) && (
                        <p className="text-white text-center text-xl font-bold tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,1)] animate-in fade-in slide-in-from-bottom-2 duration-500 transition-all max-w-[90%]">
                            <span className="bg-black/40 backdrop-blur-sm px-4 py-1 rounded-lg italic">
                                {agentSubtitles ? agentSubtitles : transcript}
                            </span>
                        </p>
                    )}
                </div>
            </div>

            {/* Horizontal Waveform / Listening Line */}
            <div className="h-20 w-full flex items-center justify-center px-20 z-10 relative mb-4">
                <div className="flex items-center gap-1.5 h-8 w-full max-w-xs justify-center">
                    {(callState === 'listening' || callState === 'speaking' || callState === 'processing') ? (
                        Array.from({ length: 24 }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-[3px] rounded-full transition-all duration-300",
                                    callState === 'listening' ? 'bg-red-500' :
                                        callState === 'speaking' ? 'bg-primary' :
                                            'bg-blue-500'
                                )}
                                style={{
                                    height: callState === 'processing' ? '40%' : `${20 + Math.random() * 80}%`,
                                    transitionDelay: `${i * 30}ms`,
                                    animation: (callState === 'listening' || callState === 'speaking') ? 'wave-simple 1.2s ease-in-out infinite' : (callState === 'processing' ? 'pulse 1.5s infinite' : 'none'),
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
            <div className="pb-12 pt-4 px-8 z-10 relative">
                <div className="flex items-center justify-center gap-10 max-w-md mx-auto">
                    {/* Mute toggle */}
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-95 border",
                            isMuted
                                ? "bg-white text-black border-white shadow-lg"
                                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                        )}
                    >
                        {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>

                    {/* Microphone toggle */}
                    <button
                        onClick={toggleMicrophone}
                        disabled={callState === 'connecting'}
                        className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 relative",
                            callState === 'listening'
                                ? "bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)] scale-110"
                                : "bg-white/10 text-white hover:bg-white/20",
                            callState === 'connecting' && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {callState === 'listening' ? <Mic size={32} /> : <MicOff size={32} className="opacity-50" />}
                    </button>

                    {/* End call */}
                    <button
                        onClick={endCall}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600/20 text-red-500 hover:bg-red-600/40 transition-all active:scale-95 border border-red-500/20"
                    >
                        <PhoneOff size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
