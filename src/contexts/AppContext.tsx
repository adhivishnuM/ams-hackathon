import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { dbService } from '@/services/db';
import { syncService } from '@/services/syncService';
import { ConversationMessage } from '@/lib/apiClient';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    condition?: string;
}

interface WeatherData {
    current: {
        temperature_2m: number;
        weather_code: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
    };
    [key: string]: any;
}

interface AppContextType {
    // Language & Voice
    language: string;
    setLanguage: (lang: string) => void;
    voiceSpeed: 'slow' | 'normal' | 'fast';
    setVoiceSpeed: (speed: 'slow' | 'normal' | 'fast') => void;
    selectedVoice: string;
    setSelectedVoice: (voice: string) => void;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;

    // Online Status
    isOnline: boolean;

    // Weather
    weatherData: WeatherData | null;
    isWeatherLoading: boolean;
    weatherError: string | null;
    weatherLastUpdated: number | null;

    // Chat State (to preserve streaming)
    isChatMode: boolean;
    setIsChatMode: (mode: boolean) => void;
    chatMessages: ChatMessage[];
    setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    conversationHistory: ConversationMessage[];
    setConversationHistory: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
    conversationId: string;
    setConversationId: (id: string) => void;
    textInput: string;
    setTextInput: (input: string) => void;
    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
    isRecording: boolean;
    setIsRecording: (recording: boolean) => void;

    // Audio playback
    currentPlayingId: string | null;
    setCurrentPlayingId: (id: string | null) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    ttsAudio: HTMLAudioElement | null;
    setTtsAudio: (audio: HTMLAudioElement | null) => void;

    // Image Analysis Modal
    isImageOpen: boolean;
    setIsImageOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AppProvider({ children }: { children: ReactNode }) {
    // Language & Voice
    const [language, setLanguage] = useState(() => localStorage.getItem('agro_language') || 'en');
    const [voiceSpeed, setVoiceSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
    const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('agrovoice_voice') || 'mia');
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('agrovoice_muted') === 'true');

    // Online Status
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Weather
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(true);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [weatherLastUpdated, setWeatherLastUpdated] = useState<number | null>(null);

    // Chat State
    const [isChatMode, setIsChatMode] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
    const [conversationId, setConversationId] = useState('');
    const [textInput, setTextInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // Audio playback
    const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);

    // Image Analysis Modal
    const [isImageOpen, setIsImageOpen] = useState(false);

    // Persist language changes
    useEffect(() => {
        localStorage.setItem('agro_language', language);
    }, [language]);

    // Persist voice selection
    useEffect(() => {
        localStorage.setItem('agrovoice_voice', selectedVoice);
    }, [selectedVoice]);

    // Persist muted state
    useEffect(() => {
        localStorage.setItem('agrovoice_muted', String(isMuted));
        if (isMuted) {
            window.speechSynthesis?.cancel();
            if (ttsAudio) {
                ttsAudio.pause();
                ttsAudio.currentTime = 0;
            }
            setIsPlaying(false);
            setCurrentPlayingId(null);
        }
    }, [isMuted, ttsAudio]);

    // Online/Offline handling
    useEffect(() => {
        const handleOnline = () => {
            const forced = localStorage.getItem('agro_force_offline') === 'true';
            setIsOnline(!forced);
        };
        const handleOffline = () => setIsOnline(false);
        const handleOfflineModeChange = () => {
            const forced = localStorage.getItem('agro_force_offline') === 'true';
            setIsOnline(navigator.onLine && !forced);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('offline-mode-change', handleOfflineModeChange);

        // Initial check
        const forced = localStorage.getItem('agro_force_offline') === 'true';
        setIsOnline(navigator.onLine && !forced);

        // Auto-Save / Sync on Launch
        const autoSave = localStorage.getItem('agro_auto_save') !== 'false';
        if (navigator.onLine && !forced && autoSave) {
            syncService.syncAll();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('offline-mode-change', handleOfflineModeChange);
        };
    }, []);

    // Fetch weather
    const fetchWeather = async (lat: number, lon: number) => {
        try {
            setIsWeatherLoading(true);
            // Try cache first
            try {
                const cached = await dbService.get('weather_cache', 'current');
                if (cached && (Date.now() - cached.lastUpdated < 3600000)) {
                    setWeatherData(cached.data);
                    setWeatherLastUpdated(cached.lastUpdated);
                    setIsWeatherLoading(false);
                }
            } catch (e) { console.error(e); }

            if (!navigator.onLine) {
                setIsWeatherLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/weather?lat=${lat}&lon=${lon}`);
            const result = await response.json();
            if (result.success) {
                const now = Date.now();
                setWeatherData(result.data);
                setWeatherLastUpdated(now);
                await dbService.put('weather_cache', {
                    id: 'current',
                    data: result.data,
                    lastUpdated: now
                });
            } else {
                setWeatherError(result.error || 'Failed to fetch weather');
            }
        } catch (err) {
            setWeatherError('Connection to weather service failed');
        } finally {
            setIsWeatherLoading(false);
        }
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
                () => fetchWeather(28.6139, 77.2090) // Fallback to Delhi
            );
        } else {
            setWeatherError('Geolocation not supported');
            setIsWeatherLoading(false);
        }
    }, []);

    const value: AppContextType = {
        language,
        setLanguage,
        voiceSpeed,
        setVoiceSpeed,
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
        isImageOpen,
        setIsImageOpen,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
