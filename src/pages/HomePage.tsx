import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, X, Volume2, VolumeX, Mic, ChevronDown, ArrowRight, User, Play, Pause, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { LanguageSelector } from '@/components/LanguageSelector';
import { RecentQueryCard } from '@/components/RecentQueryCard';
import { WeatherDashboard } from '@/components/WeatherDashboard';
import { getTranslation } from '@/lib/translations';
import { getTextAdvice, getNvidiaTts, ConversationMessage } from '@/lib/apiClient';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLibrary } from '@/hooks/useLibrary';
import { useChat } from '@/hooks/useChat';

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
        setIsImageOpen,
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

    const { items: libraryItems, refresh: refreshLibrary } = useLibrary();
    const { history: chatHistory, fetchHistory: fetchChatHistory } = useChat();

    // Available NVIDIA voices
    const voiceOptions = [
        { id: 'mia', name: 'Mia', label: language === 'hi' ? 'मिया (महिला)' : 'Mia (Female)' },
        { id: 'aria', name: 'Aria', label: language === 'hi' ? 'आरिया (महिला)' : 'Aria (Female)' },
        { id: 'sofia', name: 'Sofia', label: language === 'hi' ? 'सोफिया (महिला)' : 'Sofia (Female)' },
    ];

    useEffect(() => {
        if (!isChatMode) {
            fetchChatHistory();
        }
    }, [isChatMode]);

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
            const weatherContext = weatherData ? {
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
                ].slice(-10)); // Increased history for better context
                setTimeout(() => playResponse(result.advisory!.recommendation, result.audio), 300);
            }
        } catch (e) {
            console.error('Chat error:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!textInput.trim()) return;
        setIsChatMode(true);
        const text = textInput.trim();
        setTextInput('');
        accumulatedTranscriptRef.current = '';
        await processResponse(text);
    };

    const handleMicClick = async () => {
        if (isRecording) {
            if (recognitionRef.current) {
                const finalPayload = textInput.trim();
                recognitionRef.current.stop();
                recognitionRef.current = null;
                setIsRecording(false);
                if (finalPayload) {
                    setIsChatMode(true);
                    setTextInput('');
                    accumulatedTranscriptRef.current = '';
                    await processResponse(finalPayload);
                }
            }
            return;
        }

        const WindowObj = window as unknown as IWindow;
        const Recognition = WindowObj.webkitSpeechRecognition || WindowObj.SpeechRecognition;

        if (Recognition) {
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
            }
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

    const handleRecentQueryClick = (item: any) => {
        setIsChatMode(true);
        if (item.conversationId) {
            setConversationId(item.conversationId);
        }

        let messages: any[] = [];

        if (item.messages && Array.isArray(item.messages)) {
            messages = item.messages.flatMap((m: any) => [
                { id: `user_${m.id}`, role: 'user', content: m.query, timestamp: new Date(m.timestamp) },
                { id: `assistant_${m.id}`, role: 'assistant', content: m.response, timestamp: new Date(new Date(m.timestamp).getTime() + 1000), condition: undefined }
            ])
                .filter((msg) => msg.content && msg.content.trim() !== '')
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        } else {
            messages = [
                { id: `user_${item.id}`, role: 'user', content: item.query, timestamp: item.timestamp },
                { id: `assistant_${item.id}`, role: 'assistant', content: item.response, timestamp: new Date(item.timestamp.getTime() + 1000), condition: undefined }
            ];
        }

        setChatMessages(messages);

        const historyContext = messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        })).slice(-10);

        setConversationHistory(historyContext);

        const latestResponse = messages.filter(m => m.role === 'assistant').pop();
        if (latestResponse) {
            setTimeout(() => speakText(latestResponse.content, latestResponse.id), 500);
        }
    };

    // Build recent items
    const allItems = [
        ...libraryItems.map(item => ({
            id: item.id,
            query: language === 'hi' ? item.diseaseNameHi : item.diseaseName,
            response: language === 'hi' ? item.summaryHi : item.summary,
            timestamp: new Date(item.timestamp),
            cropType: (item.cropType.toLowerCase() || 'general') as any,
            type: 'scan'
        })),
        ...chatHistory.map(item => ({
            id: item.id,
            conversationId: item.conversationId,
            query: item.query,
            response: item.response,
            timestamp: new Date(item.timestamp),
            cropType: 'general' as const,
            type: 'chat',
            messages: item.messages
        }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const recentQueries = allItems.slice(0, 3);

    if (isChatMode) {
        return (
            <div className="flex flex-col h-full bg-background pb-24">
                {/* Chat Header */}
                <header className="relative z-50 flex items-center justify-between px-5 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
                    <button onClick={exitChat} className="w-10 h-10 flex items-center justify-center rounded-xl bg-background/80 border border-border/50 shadow-sm hover:bg-muted transition-all active:scale-95">
                        <X size={18} className="text-muted-foreground" />
                    </button>

                    <div className="flex items-center gap-2">
                        <img src="/logo.svg" alt="AgroTalk" className="w-8 h-8 rounded-full" />
                        <h1 className="text-headline font-bold text-primary">AgroTalk</h1>
                    </div>

                    {/* Voice Model Selector */}
                    <div className="relative mx-2" ref={voiceMenuRef}>
                        <button
                            onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-10 rounded-xl border shadow-sm transition-all active:scale-95',
                                showVoiceMenu
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-background/80 border-border/50 hover:bg-muted hover:border-primary/30'
                            )}
                        >
                            <Volume2 size={14} className="text-primary" />
                            <span className={cn('text-xs font-medium capitalize', showVoiceMenu ? 'text-primary' : 'text-foreground')}>
                                {selectedVoice}
                            </span>
                            <ChevronDown size={14} className={cn('text-muted-foreground transition-transform duration-200', showVoiceMenu && 'rotate-180 text-primary')} />
                        </button>

                        {showVoiceMenu && (
                            <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-card rounded-xl border border-border/50 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 border-b border-border/30 bg-muted/30">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                        {language === 'hi' ? 'आवाज़ चुनें' : 'Select Voice'}
                                    </span>
                                </div>
                                <div className="p-1">
                                    {voiceOptions.map((voice) => (
                                        <button
                                            key={voice.id}
                                            onClick={() => {
                                                setSelectedVoice(voice.id);
                                                setShowVoiceMenu(false);
                                            }}
                                            className={cn(
                                                'w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 rounded-lg transition-colors',
                                                selectedVoice === voice.id
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'text-foreground/80 hover:bg-muted'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-2 h-2 rounded-full ring-2 ring-offset-1',
                                                selectedVoice === voice.id ? 'bg-primary ring-primary/30' : 'bg-border ring-transparent'
                                            )} />
                                            {voice.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            'w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95',
                            isMuted ? 'bg-destructive/10 border border-destructive/30 text-destructive' : 'bg-primary/10 border border-primary/30 text-primary'
                        )}
                    >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
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
        <div className="flex flex-col flex-1 pb-32 bg-background">
            <header className="px-5 pt-4 pb-4 max-w-lg mx-auto w-full">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/call-agent')}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border/50 shadow-apple-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-95"
                            aria-label="Call AI Agent"
                        >
                            <PhoneCall size={20} className="text-primary" />
                        </button>
                        <ConnectionStatus isOnline={isOnline} />
                    </div>
                    <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
                </div>

                {/* Hero Section - Tactical Perfection */}
                <div className="text-center mb-6 relative">
                    <div className="mb-6 flex justify-center">
                        <div className="relative">
                            <img
                                src="/logo.svg"
                                alt="AgroTalk"
                                className="w-32 h-32 animate-float relative z-10"
                            />
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight uppercase leading-tight mb-2">
                        {t.greeting.split(' ')[0]}<br />
                        <span className="text-primary">{t.greeting.split(' ')[1]}</span>
                    </h1>
                    <p className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.3em]">
                        {t.greetingSubtext}
                    </p>
                </div>

                <WeatherDashboard
                    data={weatherData}
                    loading={isWeatherLoading}
                    error={weatherError}
                    language={language}
                    lastUpdated={!isOnline ? weatherLastUpdated : null}
                />
            </header>

            {/* Chat Input Box */}
            <div className="px-5 py-6 max-w-lg mx-auto w-full">
                <form onSubmit={handleTextSubmit} className="flex items-center gap-3">
                    <button
                        type="button"
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
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder={getPlaceholderText()}
                            className="w-full h-14 pl-5 pr-14 rounded-full bg-card border-2 border-border shadow-apple-sm text-body focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                        {textInput.trim() && (
                            <button
                                type="submit"
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
                <p className="text-center text-muted-foreground mt-4 text-subhead">{t.tapToSpeak}</p>


            </div>

            {/* Recent Queries */}
            <section className="px-5 mt-4 max-w-lg mx-auto w-full">
                <h2 className="text-headline font-bold text-foreground mb-4">{t.recentQueries}</h2>
                <div className="space-y-3">
                    {recentQueries.length > 0 ? (
                        recentQueries.map((item) => (
                            <RecentQueryCard
                                key={item.id}
                                id={item.id}
                                query={item.query}
                                response={item.response}
                                timestamp={item.timestamp}
                                cropType={item.cropType}
                                onClick={() => handleRecentQueryClick(item)}
                                onPlay={() => handleRecentQueryClick(item)}
                                isPlaying={currentPlayingId === `assistant_${item.id}`}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center bg-muted/50 rounded-apple border border-dashed border-border">
                            <p className="text-subhead text-muted-foreground">No recent queries yet</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
