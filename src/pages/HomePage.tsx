import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Volume2, VolumeX, Mic, ChevronDown, ArrowRight, User, Play, Pause, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { LanguageSelector } from '@/components/LanguageSelector';
import { WeatherDashboard } from '@/components/WeatherDashboard';
import { getTranslation } from '@/lib/translations';
import { getTextAdvice, getNvidiaTts, transcribeAndGetAdvice, ConversationMessage } from '@/lib/apiClient';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface IWindow {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export default function HomePage() {
    const {
        language,
        setLanguage,
        selectedVoice,
        setSelectedVoice,
        isMuted,
        setIsMuted,
        isOnline,
        weatherData,
        isWeatherLoading,
        weatherError,
        weatherLastUpdated,
        isChatMode,
        setIsChatMode,
        chatMessages,
        setChatMessages,
        conversationHistory,
        setConversationHistory,
        conversationId,
        setConversationId,
        textInput,
        setTextInput,
        isProcessing,
        setIsProcessing,
        isRecording,
        setIsRecording,
        currentPlayingId,
        setCurrentPlayingId,
        isPlaying,
        setIsPlaying,
        ttsAudio,
        setTtsAudio,
    } = useApp();

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const accumulatedTranscriptRef = useRef('');
    const voiceMenuRef = useRef<HTMLDivElement>(null);

    const [showVoiceMenu, setShowVoiceMenu] = useState(false);
    const navigate = useNavigate();

    const t = getTranslation('home', language);
    const tVoice = getTranslation('voice', language);
    const tCall = getTranslation('call', language);


    // Available NVIDIA voices
    const voiceOptions = [
        { id: 'mia', name: 'Mia', label: language === 'hi' ? 'मिया (महिला)' : 'Mia (Female)' },
        { id: 'aria', name: 'Aria', label: language === 'hi' ? 'आरिया (महिला)' : 'Aria (Female)' },
        { id: 'sofia', name: 'Sofia', label: language === 'hi' ? 'सोफिया (महिला)' : 'Sofia (Female)' },
    ];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (voiceMenuRef.current && !voiceMenuRef.current.contains(event.target as Node)) {
                setShowVoiceMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, isProcessing]);

    const addMessage = (role: 'user' | 'assistant', content: string, condition?: string) => {
        setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role,
            content,
            timestamp: new Date(),
            condition
        }]);
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

    const speakText = async (text: string, messageId?: string) => {
        if (isMuted) return;
        window.speechSynthesis?.cancel();
        if (ttsAudio) {
            ttsAudio.pause();
            ttsAudio.currentTime = 0;
        }

        // 1. Try Cloud TTS (NVIDIA/Edge via Backend)
        try {
            const cleanedText = cleanMarkdown(text);
            if (navigator.onLine) {
                const audioBlob = await getNvidiaTts(cleanedText, language, selectedVoice);
                if (audioBlob) {
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.onended = () => {
                        setIsPlaying(false);
                        setCurrentPlayingId(null);
                        URL.revokeObjectURL(audioUrl);
                    };
                    audio.onerror = () => {
                        setIsPlaying(false);
                        setCurrentPlayingId(null);
                    };
                    setTtsAudio(audio);
                    setIsPlaying(true);
                    if (messageId) setCurrentPlayingId(messageId);
                    await audio.play();
                    return;
                }
            }
        } catch (e) {
            console.warn("Cloud TTS failed, fallback to browser", e);
        }

        // 2. Fallback to Browser TTS
        if ('speechSynthesis' in window) {
            const cleanedText = cleanMarkdown(text);
            const utterance = new SpeechSynthesisUtterance(cleanedText);
            const langMap: Record<string, string> = {
                'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN'
            };
            utterance.lang = langMap[language] || 'en-IN';
            utterance.onstart = () => { setIsPlaying(true); if (messageId) setCurrentPlayingId(messageId); };
            utterance.onend = () => { setIsPlaying(false); setCurrentPlayingId(null); };
            utterance.onerror = () => { setIsPlaying(false); setCurrentPlayingId(null); };

            setIsPlaying(true);
            if (messageId) setCurrentPlayingId(messageId);
            window.speechSynthesis.speak(utterance);
        }
    };

    const playResponse = (text: string, audioBase64?: string) => {
        if (isMuted) return;
        if (audioBase64) {
            const isWav = audioBase64.startsWith('UklG');
            const mimeType = isWav ? 'audio/wav' : 'audio/mp3';
            const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
            audio.onended = () => { setIsPlaying(false); setCurrentPlayingId(null); };
            audio.onerror = () => speakText(text);
            setTtsAudio(audio);
            setIsPlaying(true);
            audio.playbackRate = 1.15;
            audio.play().catch(() => speakText(text));
        } else {
            speakText(text);
        }
    };

    const processResponse = async (text: string) => {
        let currentConvId = conversationId;
        if (!currentConvId) {
            currentConvId = `chat_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
            setConversationId(currentConvId);
        }

        addMessage('user', text);
        setIsProcessing(true);

        try {
            const weatherContext = (weatherData && weatherData.current) ? {
                temp: weatherData.current.temperature_2m,
                condition: weatherData.current.weather_code,
                humidity: weatherData.current.relative_humidity_2m
            } : undefined;

            const result = await getTextAdvice(text, language, weatherContext, conversationHistory, true, currentConvId, selectedVoice);

            if (result.success && result.advisory) {
                // Handle automatic language detection/switching
                if (result.newLanguage && result.newLanguage !== language) {
                    setLanguage(result.newLanguage as any);
                }

                addMessage('assistant', result.advisory.recommendation, result.advisory.condition);
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user' as const, content: text },
                    { role: 'assistant' as const, content: result.advisory!.recommendation }
                ].slice(-10));
                playResponse(result.advisory!.recommendation, result.audio);
            }
        } catch (e) {
            console.error('Chat error:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTextSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const text = textInput.trim();
        if (!text || isProcessing) return;

        // Clear input immediately to prevent "duplicate" feel
        setTextInput('');
        accumulatedTranscriptRef.current = '';
        
        setIsChatMode(true);
        await processResponse(text);
    };

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onend = null;
            try { recognitionRef.current.stop(); } catch (e) {}
            recognitionRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsRecording(false);
    };

    const handleMicClick = async () => {
        if (isRecording) {
            const finalPayload = textInput.trim();
            stopRecording();
            
            if (finalPayload) {
                // If we were using browser STT, we already have the text
                setTextInput('');
                accumulatedTranscriptRef.current = '';
                setIsChatMode(true);
                await processResponse(finalPayload);
            }
            return;
        }

        // Try Browser STT first
        const WindowObj = window as unknown as IWindow;
        const Recognition = WindowObj.webkitSpeechRecognition || WindowObj.SpeechRecognition;

        if (Recognition && navigator.onLine) {
            try {
                const recognition = new Recognition();
                const langMap: Record<string, string> = {
                    'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN', 'en': 'en-US'
                };
                recognition.lang = langMap[language] || 'en-US';
                recognition.continuous = true;
                recognition.interimResults = true;
                accumulatedTranscriptRef.current = '';

                recognition.onstart = () => setIsRecording(true);

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
                    setTextInput(accumulatedTranscriptRef.current + interimTranscript);
                };

                recognition.onend = () => setIsRecording(false);
                recognition.onerror = () => setIsRecording(false);

                recognition.start();
                recognitionRef.current = recognition;
            } catch (e) {
                console.error('Speech recognition error:', e);
                startBackendSTT();
            }
        } else {
            startBackendSTT();
        }
    };

    const startBackendSTT = async () => {
        if (!navigator.onLine) {
            toast.error("Offline speech not supported");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size < 1000) return;

                setIsProcessing(true);
                setIsChatMode(true);
                try {
                    const result = await transcribeAndGetAdvice(blob, language, undefined, conversationHistory, true, conversationId);
                    if (result.success && result.transcript) {
                        await processResponse(result.transcript);
                    }
                } catch (e) {
                    console.error("STT Failed", e);
                } finally {
                    setIsProcessing(false);
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error("Mic access denied", e);
            toast.error("Microphone access denied");
        }
    };

    const handlePlayMessage = async (msgId: string, content: string) => {
        if (currentPlayingId === msgId && isPlaying) {
            window.speechSynthesis?.cancel();
            if (ttsAudio) { ttsAudio.pause(); ttsAudio.currentTime = 0; }
            setIsPlaying(false);
            setCurrentPlayingId(null);
        } else {
            await speakText(content, msgId);
        }
    };

    const exitChat = () => {
        setIsChatMode(false);
        setChatMessages([]);
        setConversationHistory([]);
        setConversationId('');
        setTextInput('');
        window.speechSynthesis?.cancel();
    };

    const getPlaceholderText = () => {
        const ph: Record<string, string> = {
            en: 'Ask about your crops...',
            hi: 'अपनी फसल के बारे में पूछें...',
            ta: 'உங்கள் பயிர்களைப் பற்றி கேளுங்கள்...',
            te: 'మీ పంటల గురించి అడగండి...',
            mr: 'तुमच्या पिकांबद्दल विचारा...'
        };
        return ph[language] || ph.en;
    };

    if (isChatMode) {
        return (
            <div className="flex flex-col h-full bg-background pb-24 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10" />

                {/* Chat Header */}
                <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-5 bg-background/60 backdrop-blur-3xl border-b border-border/40 shadow-sm">
                    <button 
                        onClick={exitChat} 
                        className="w-11 h-11 flex items-center justify-center rounded-2xl bg-muted/40 border border-border/50 shadow-apple-sm hover:bg-muted/80 transition-all active:scale-95 group"
                    >
                        <X size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-xl bg-white shadow-apple-sm border border-border/40">
                            <img src="/logo.svg" alt="AgroTalk" className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-[17px] font-black text-foreground tracking-tight leading-none">AgroTalk <span className="text-primary italic">AI</span></h1>
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t.activeAgent || 'Active Agent'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Voice Model Selector (Polished) */}
                        <div className="relative group/voice" ref={voiceMenuRef}>
                            <button
                                onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                                className={cn(
                                    'hidden lg:flex items-center gap-2 px-4 h-11 rounded-2xl border shadow-apple-sm transition-all active:scale-95',
                                    showVoiceMenu
                                        ? 'bg-primary/20 border-primary/40 text-primary'
                                        : 'bg-muted/40 border-border/50 hover:bg-muted/80'
                                )}
                            >
                                <Volume2 size={16} className={cn("transition-colors", showVoiceMenu ? "text-primary" : "text-muted-foreground")} />
                                <span className="text-xs font-black uppercase tracking-widest">{selectedVoice}</span>
                                <ChevronDown size={14} className={cn('transition-transform duration-300', showVoiceMenu && 'rotate-180')} />
                            </button>

                            {showVoiceMenu && (
                                <div className="absolute right-0 top-full mt-3 z-50 w-56 bg-card/90 backdrop-blur-2xl rounded-2xl border border-border/60 shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-4 py-2 mb-1 border-b border-border/30">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t.voicePersona || 'Voice Persona'}</span>
                                    </div>
                                    <div className="px-2 space-y-1">
                                        {voiceOptions.map((voice) => (
                                            <button
                                                key={voice.id}
                                                onClick={() => {
                                                    setSelectedVoice(voice.id);
                                                    setShowVoiceMenu(false);
                                                }}
                                                className={cn(
                                                    'w-full px-4 py-3 text-left rounded-xl transition-all duration-200 flex items-center justify-between group/item',
                                                    selectedVoice === voice.id
                                                        ? 'bg-primary text-white shadow-md'
                                                        : 'text-foreground/80 hover:bg-muted/60'
                                                )}
                                            >
                                                <span className="text-xs font-bold tracking-tight">{voice.label}</span>
                                                {selectedVoice === voice.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={cn(
                                'w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-95 shadow-apple-sm border',
                                isMuted 
                                    ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20' 
                                    : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                            )}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                    </div>
                </header>

                {/* Chat Messages */}
                <ScrollArea ref={chatContainerRef} className="flex-1 overflow-y-auto">
                    <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
                        {chatMessages.map((msg, index) => (
                            <div
                                key={msg.id}
                                className={cn('animate-fade-in', msg.role === 'user' ? 'flex justify-end' : 'flex justify-start')}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {msg.role === 'user' ? (
                                    <div className="max-w-[85%] group">
                                        <div className="bg-primary text-white px-5 py-3.5 rounded-2xl rounded-br-md shadow-lg">
                                            <p className="text-body leading-relaxed">{msg.content}</p>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 mt-1.5 px-1">
                                            <User className="w-3 h-3 text-muted-foreground/50" />
                                            <span className="text-[10px] text-muted-foreground/70">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-w-[90%] group">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center border border-border/50 shadow-sm overflow-hidden p-1">
                                                <img src="/logo.svg" alt="AgroTalk" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {msg.condition && (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-full bg-primary/10 border border-primary/20">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{msg.condition}</span>
                                                    </div>
                                                )}
                                                <div className="relative bg-card rounded-2xl rounded-tl-md shadow-sm border border-border/50 overflow-hidden">
                                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                                                    <div className="px-5 py-4">
                                                        <div className="prose prose-sm dark:prose-invert text-foreground max-w-none leading-relaxed">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/30">
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <button
                                                            onClick={() => handlePlayMessage(msg.id, msg.content)}
                                                            disabled={isMuted}
                                                            className={cn(
                                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95',
                                                                currentPlayingId === msg.id && isPlaying
                                                                    ? 'bg-primary text-white shadow-md'
                                                                    : 'bg-card text-primary border border-primary/30 hover:bg-primary/10',
                                                                isMuted && 'opacity-50 cursor-not-allowed'
                                                            )}
                                                        >
                                                            {currentPlayingId === msg.id && isPlaying ? <><Pause className="w-3 h-3" /><span>Stop</span></> : <><Play className="w-3 h-3" /><span>Listen</span></>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isProcessing && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center border border-border/50 shadow-sm overflow-hidden p-1 animate-pulse">
                                        <img src="/logo.svg" alt="AgroTalk" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-card rounded-2xl rounded-tl-md shadow-sm border border-border/50 px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2.5 h-2.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Chat Input */}
                < div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-3 pb-4" >
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        <button
                            onClick={handleMicClick}
                            className={cn(
                                'w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95',
                                isRecording
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-primary text-white shadow-green'
                            )}
                        >
                            <Mic size={24} />
                        </button>
                        <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder={getPlaceholderText()}
                                    className={cn(
                                        'w-full h-14 pl-5 pr-14 rounded-full',
                                        'bg-card border-2 border-border',
                                        'text-body placeholder:text-muted-foreground/60',
                                        'focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
                                        'transition-all duration-200 shadow-apple-sm',
                                        'disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                    disabled={isProcessing}
                                />
                                {textInput.trim() && (
                                    <button
                                        type="submit"
                                        disabled={isProcessing}
                                        className={cn(
                                            'absolute right-2 top-1/2 -translate-y-1/2',
                                            'w-10 h-10 rounded-full',
                                            'bg-[#76b900] text-white',
                                            'flex items-center justify-center',
                                            'hover:bg-[#5da600]',
                                            'active:scale-95 transition-all duration-200',
                                            'disabled:opacity-50 disabled:cursor-not-allowed'
                                        )}
                                    >
                                        <ArrowRight size={20} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div >
            </div >
        );
    }

    // Default home screen
    return (
        <div className="flex flex-col flex-1 bg-background min-h-screen pb-32 lg:pb-0 relative overflow-hidden">
            {/* Background glowing effects for premium feel */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* ── Top bar ── */}
            <header className="flex items-center justify-between px-5 lg:px-8 pt-5 pb-3 z-10 relative">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => navigate('/call-agent')}
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-card border border-border/50 hover:bg-muted transition-colors active:scale-95"
                    >
                        <PhoneCall size={18} className="text-primary" />
                    </button>
                    <ConnectionStatus isOnline={isOnline} />
                </div>
                <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
            </header>

            {/* ── Content: perfectly centered layout for desktop ── */}
            <div className="flex-1 w-full max-w-4xl mx-auto px-5 lg:px-0 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] pb-12 z-10 relative">

                {/* Hero section */}
                <div className="flex flex-col items-center justify-center text-center mb-10 w-full animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <div className="relative group mb-8">
                        <div className="absolute -inset-6 bg-gradient-to-b from-primary/20 to-transparent rounded-full blur-2xl opacity-0 lg:group-hover:opacity-100 transition-opacity duration-1000"></div>
                        <img 
                            src="/logo.svg" 
                            alt="AgroTalk" 
                            className="w-24 h-24 lg:w-36 lg:h-36 shrink-0 animate-float drop-shadow-2xl relative z-10" 
                        />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-[36px] lg:text-[64px] font-black text-foreground tracking-tight uppercase leading-[1.05] drop-shadow-sm">
                            {t.greeting.split(' ')[0] || "Hello"}{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#5da600]">{t.greeting.split(' ').slice(1).join(' ') || "Farmer!"}</span>
                        </h1>
                        <p className="text-[13px] lg:text-[18px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] max-w-xl mx-auto">
                            {t.greetingSubtext}
                        </p>
                    </div>
                </div>

                {/* Weather widget */}
                <div className="w-full max-w-2xl mx-auto mb-10 animate-in slide-in-from-bottom-6 fade-in duration-700 delay-150">
                    <WeatherDashboard
                        data={weatherData}
                        loading={isWeatherLoading}
                        error={weatherError}
                        language={language}
                        lastUpdated={!isOnline ? weatherLastUpdated : null}
                        compact
                    />
                </div>

                {/* Chat input wrapper */}
                <div className="flex flex-col items-center w-full max-w-3xl mx-auto gap-4 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300">
                    <form onSubmit={handleTextSubmit} className="relative w-full group">
                        {/* Outer Glow */}
                        <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/30 to-[#5da600]/30 rounded-[40px] blur-xl opacity-0 lg:group-hover:opacity-100 transition duration-700 pointer-events-none z-0"></div>
                        
                        <div className="relative bg-card/90 backdrop-blur-3xl border border-border/80 flex items-center p-2.5 lg:p-3.5 rounded-[36px] shadow-apple-lg hover:shadow-apple-xl transition-all duration-300 z-10">
                            
                            {/* Inner Input Area */}
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder={getPlaceholderText()}
                                className="flex-1 h-14 lg:h-16 bg-transparent border-none text-[16px] lg:text-[18px] font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 leading-tight pl-6"
                            />
                            
                            <div className="flex items-center gap-2 pr-2">
                                {/* Submit Arrow (Slide in if text exists) */}
                                {textInput.trim() ? (
                                    <div className="animate-in zoom-in-50 duration-200">
                                        <button
                                            type="submit"
                                            className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
                                        >
                                            <ArrowRight size={20} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                ) : null}

                                {/* Prominent Mic Button integrated into the right side of the chat box */}
                                <button
                                    type="button"
                                    onClick={handleMicClick}
                                    className={cn(
                                        'w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300',
                                        isRecording 
                                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/40 hover:bg-red-600' 
                                            : 'bg-gradient-to-br from-primary to-[#5da600] text-white hover:shadow-primary/50 hover:scale-105 active:scale-95'
                                    )}
                                >
                                    <Mic size={26} strokeWidth={2.5} className={cn("transition-all", isRecording && "animate-bounce")} />
                                </button>
                            </div>
                        </div>
                    </form>
                    <p className="text-center text-[12px] font-medium text-muted-foreground/50 tracking-wider mb-8">{t.tapToSpeak}</p>
                </div>
            </div>
        </div>
    );
}
