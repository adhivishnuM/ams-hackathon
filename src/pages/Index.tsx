import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, Volume2, VolumeX, Send, Bot, User, Play, Pause, RotateCcw, Mic, ChevronDown, ArrowRight, Search, Menu, Bell, PhoneCall, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dbService } from '@/services/db';
import { syncService } from '@/services/syncService';
import { MicrophoneButton } from "@/components/MicrophoneButton";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LanguageSelector } from "@/components/LanguageSelector";
import { RecentQueryCard } from "@/components/RecentQueryCard";
import { BottomNavigation, type NavTab } from "@/components/BottomNavigation";
import { VoiceInteraction } from "@/components/VoiceInteraction";
import { ImageAnalysis } from "@/components/ImageAnalysis";
import { LibraryScreen } from "@/components/LibraryScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { MarketPriceScreen } from "@/components/MarketPriceScreen";
import { OfflineBanner } from "@/components/OfflineBanner";

import { useLibrary } from "@/hooks/useLibrary";
import { useChat } from "@/hooks/useChat";
import { WeatherDashboard } from "@/components/WeatherDashboard";
import { getTranslation } from "@/lib/translations";
import { getTextAdvice, ConversationMessage, getNvidiaTts } from "@/lib/apiClient";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WhatsAppStatus } from "@/components/WhatsAppStatus";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  condition?: string;
}

interface IWindow {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export default function Index() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [language, setLanguage] = useState("en");
  const [voiceSpeed, setVoiceSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLastUpdated, setWeatherLastUpdated] = useState<number | null>(null);

  // Chat state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isHindi = language === "hi";
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("agrovoice_muted") === "true");
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>("");
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [initialVoiceMessages, setInitialVoiceMessages] = useState<ChatMessage[]>([]);
  const [voiceContextId, setVoiceContextId] = useState<string>("");
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef("");
  const voiceMenuRef = useRef<HTMLDivElement>(null);

  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem("agrovoice_voice") || "mia");
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);



  // Available NVIDIA Magpie voices
  const femaleLabel: Record<string, string> = { en: 'Female', hi: 'महिला', ta: 'பெண்', te: 'మహిళ', mr: 'महिला' };
  const fl = femaleLabel[language] || 'Female';
  const voiceOptions = [
    { id: "mia", name: "Mia", label: `Mia (${fl})`, gender: 'female' },
    { id: "aria", name: "Aria", label: `Aria (${fl})`, gender: 'female' },
    { id: "sofia", name: "Sofia", label: `Sofia (${fl})`, gender: 'female' },
    { id: "louise", name: "Louise", label: `Louise (${fl})`, gender: 'female' },
    { id: "isabela", name: "Isabela", label: `Isabela (${fl})`, gender: 'female' },
  ];

  const t = getTranslation('home', language);
  const tVoice = getTranslation('voice', language);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      setIsWeatherLoading(true);
      // Try cache first
      try {
        const cached = await dbService.get('weather_cache', 'current');
        if (cached && (Date.now() - cached.lastUpdated < 3600000)) { // 1 hour cache
          setWeatherData(cached.data);
          setWeatherLastUpdated(cached.lastUpdated);
          setIsWeatherLoading(false);
          // don't return, fetch in background if possible or just use cache
          // for now, let's fetch to update if online
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
        // Save to cache
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

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-mode-change", handleOfflineModeChange);

    // Initial check
    const forced = localStorage.getItem('agro_force_offline') === 'true';
    setIsOnline(navigator.onLine && !forced);

    // Auto-Save / Sync on Launch
    const autoSave = localStorage.getItem("agro_auto_save") !== "false";
    if (navigator.onLine && !forced && autoSave) {
      syncService.syncAll();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-mode-change", handleOfflineModeChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("agrovoice_muted", String(isMuted));
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(event.target as Node)) {
        setShowVoiceMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleTabChange = (tab: NavTab) => {
    if (tab === "analyze") {
      setIsImageOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const { items: libraryItems, refresh: refreshLibrary } = useLibrary();
  const { history: chatHistory, fetchHistory: fetchChatHistory } = useChat();

  useEffect(() => {
    if (activeTab === 'home' && !isChatMode) {
      fetchChatHistory();
    }
  }, [activeTab, isChatMode]);

  const addMessage = (role: 'user' | 'assistant', content: string, condition?: string) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      condition
    };
    setChatMessages(prev => [...prev, newMsg]);
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

    // 1. Try Nvidia TTS First
    try {
      const cleanedText = cleanMarkdown(text);
      if (navigator.onLine) {
        const audioBlob = await getNvidiaTts(cleanedText, language);
        if (audioBlob) {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.onended = () => {
            setIsPlaying(false);
            setCurrentPlayingId(null);
            URL.revokeObjectURL(audioUrl);
          };
          audio.onerror = () => {
            // Fallback to browser TTS on playback error
            console.warn("Nvidia Audio Playback failed, falling back to edge");
            fallbackToEdgeTTS(cleanedText, messageId);
          };

          setTtsAudio(audio);
          setIsPlaying(true);
          if (messageId) setCurrentPlayingId(messageId);

          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn("Nvidia TTS failed, falling back to edge", e);
    }

    // 2. Fallback to Edge (Browser) TTS
    fallbackToEdgeTTS(cleanMarkdown(text), messageId);
  };

  const fallbackToEdgeTTS = (text: string, messageId?: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: Record<string, string> = {
        'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN'
      };
      utterance.lang = langMap[language] || 'en-IN';

      const voices = window.speechSynthesis.getVoices();
      const langCode = utterance.lang.split('-')[0];
      const bestVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(langCode));
      if (bestVoice) utterance.voice = bestVoice;

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
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.onended = () => { setIsPlaying(false); setCurrentPlayingId(null); };
      audio.onerror = () => speakText(text);
      setTtsAudio(audio);
      setIsPlaying(true);
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
        addMessage('assistant', result.advisory.recommendation, result.advisory.condition);
        setConversationHistory(prev => [
          ...prev,
          { role: 'user' as const, content: text },
          { role: 'assistant' as const, content: result.advisory!.recommendation }
        ].slice(-6));
        setTimeout(() => playResponse(result.advisory!.recommendation, result.audio), 300);
      }
    } catch (e) {
      console.error("Chat error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setIsChatMode(true);
    const text = textInput.trim();
    setTextInput("");
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
          setTextInput("");
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
        accumulatedTranscriptRef.current = "";

        recognition.onstart = () => setIsRecording(true);

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalChunk = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalChunk += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalChunk) {
            accumulatedTranscriptRef.current += finalChunk + " ";
          }
          setTextInput(accumulatedTranscriptRef.current + interimTranscript);
        };

        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
  };

  const handlePlayMessage = (msgId: string, content: string) => {
    if (currentPlayingId === msgId && isPlaying) {
      window.speechSynthesis?.cancel();
      if (ttsAudio) { ttsAudio.pause(); ttsAudio.currentTime = 0; }
      setIsPlaying(false);
      setCurrentPlayingId(null);
    } else {
      speakText(content, msgId);
    }
  };

  const exitChat = () => {
    setIsChatMode(false);
    setChatMessages([]);
    setConversationHistory([]);
    setConversationId("");
    setTextInput("");
    window.speechSynthesis?.cancel();
  };

  const getPlaceholderText = () => {
    const ph: Record<string, string> = {
      en: "Ask about your crops...",
      hi: "अपनी फसल के बारे में पूछें...",
      ta: "உங்கள் பயிர்களைப் பற்றி கேளுங்கள்...",
      te: "మీ పంటల గురించి అడగండి...",
      mr: "तुमच्या पिकांबद्दल विचारा..."
    };
    return ph[language] || ph.en;
  };

  const handleRecentQueryClick = (item: any) => {
    setIsChatMode(true);
    // Restore conversation ID if available to continue the thread
    if (item.conversationId) {
      setConversationId(item.conversationId);
    }

    let messages: ChatMessage[] = [];

    // Check if we have the full message history (grouped conversation)
    if (item.messages && Array.isArray(item.messages)) {
      messages = item.messages.flatMap((m: any) => [
        {
          id: `user_${m.id}`,
          role: 'user',
          content: m.query,
          timestamp: new Date(m.timestamp)
        },
        {
          id: `assistant_${m.id}`,
          role: 'assistant',
          content: m.response,
          timestamp: new Date(new Date(m.timestamp).getTime() + 1000), // add 1s ordering
          condition: undefined
        }
      ])
        .filter((msg) => msg.content && msg.content.trim() !== '') // Filter empty messages
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } else {
      // Fallback for legacy single items
      messages = [
        {
          id: `user_${item.id}`,
          role: 'user',
          content: item.query,
          timestamp: item.timestamp
        },
        {
          id: `assistant_${item.id}`,
          role: 'assistant',
          content: item.response,
          timestamp: new Date(item.timestamp.getTime() + 1000), // add 1s for ordering
          condition: undefined
        }
      ];
    }

    setChatMessages(messages);

    // Update conversation context so AI remembers what was said
    const historyContext = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })).slice(-10); // Keep last 10 turns for context

    setConversationHistory(historyContext);

    // Play audio of the LATEST response
    const latestResponse = messages.filter(m => m.role === 'assistant').pop();
    if (latestResponse) {
      setTimeout(() => {
        speakText(latestResponse.content, latestResponse.id);
      }, 500);
    }
  };


  const handleShareToChat = (analysis: any) => {
    setIsImageOpen(false);

    // Get translations for the current language
    const tLib = getTranslation('library', language);

    // Determine crop name — from DiseaseAnalysis or LibraryItem format
    const cropName = analysis.crop_identified || analysis.cropType || 'Plant';
    const diseaseName = analysis.disease_name || analysis.diseaseName || 'Unknown';

    // Get symptoms/treatment arrays (handle both formats)
    const symptomsArr: string[] = analysis.symptoms || analysis.symptoms || [];
    const treatmentArr: string[] = analysis.treatment_steps || analysis.treatment || [];

    const symptomsText = Array.isArray(symptomsArr) ? symptomsArr.slice(0, 3).join('; ') : String(symptomsArr);
    const treatmentText = Array.isArray(treatmentArr) ? treatmentArr.slice(0, 3).join('; ') : String(treatmentArr);

    // Also grab description if available
    const description = analysis.description || analysis.summary || '';

    // Build a rich context message that goes into the TEXT chatbox
    const contextLines = [
      `🌿 **${tLib.shareTitle || 'Plant Analysis Result'}**`,
      ``,
      `**${tLib.cropName || 'Crop'}:** ${cropName}`,
      `**${tLib.shareCondition || 'Condition'}:** ${diseaseName}`,
      `**${tLib.severity || 'Severity'}:** ${analysis.severity || 'N/A'}`,
      `**${tLib.confidence || 'Confidence'}:** ${analysis.confidence || 'N/A'}%`,
    ];

    if (description) contextLines.push(``, `**${tLib.details || 'Details'}:** ${description}`);
    if (symptomsText) contextLines.push(``, `**${tLib.symptoms || 'Symptoms'}:** ${symptomsText}`);
    if (treatmentText) contextLines.push(``, `**${tLib.treatment || 'Treatment'}:** ${treatmentText}`);
    contextLines.push(``, `_${tLib.askAnything || 'Ask me anything about this diagnosis!'}_`);

    const contextMessage = contextLines.join('\n');

    // Set up a new conversation with this context message in the CHATBOX
    const newMessages: ChatMessage[] = [
      {
        id: `context_${Date.now()}`,
        role: 'assistant',
        content: contextMessage,
        timestamp: new Date(),
        condition: analysis.severity
      }
    ];

    // Set conversation history so AI remembers the context
    const newConvId = `analysis_${Math.random().toString(36).substring(2, 9)}`;
    setConversationId(newConvId);
    setConversationHistory([
      { role: 'assistant' as const, content: `CONTEXT: User shared a plant analysis scan. Crop: ${cropName}. Condition: ${diseaseName}. Severity: ${analysis.severity}. Symptoms: ${symptomsText}. Treatment: ${treatmentText}. Description: ${description}` }
    ]);

    // Navigate to HOME and open the chatbox directly
    setActiveTab('home');
    setChatMessages(newMessages);
    setIsImageOpen(false); // Close the modal here explicitly

    // Slight delay to allow the dashboard to render before switching to chat mode
    // This prevents state updates from being swallowed during the transition
    setTimeout(() => {
      setIsChatMode(true);
    }, 100);

    toast.success(tLib.sentToChat || '✅ Analysis sent to chat!');
  };

  const handleMarketShare = (record: any) => {
    const tMarket = getTranslation('market', language);

    const contextMessage = [
      `📊 **${tMarket.shareTitle || 'Market Price Report'}**`,
      ``,
      `**${tMarket.commodity || 'Commodity'}:** ${record.commodity}`,
      `**${tMarket.market || 'Market'}:** ${record.market}, ${record.district} (${record.state})`,
      `**${tMarket.variety || 'Variety'}:** ${record.variety || 'FAQ'}`,
      `**${tMarket.modalPrice || 'Modal Price'}:** ₹${record.modal_price} per quintal`,
      `**${tMarket.priceRange || 'Price Range'}:** ₹${record.min_price} – ₹${record.max_price}`,
      `**${tMarket.updated || 'Updated'}:** ${record.arrival_date}`,
      ``,
      `_${tMarket.askMarket || 'Ask me about pricing trends, selling tips, or market advice!'}_`
    ].join('\n');

    const newConvId = `market_${Math.random().toString(36).substring(2, 9)}`;
    setConversationId(newConvId);
    setConversationHistory([
      { role: 'assistant' as const, content: `CONTEXT: User shared a market price report. Commodity: ${record.commodity}, Market: ${record.market} (${record.state}), Modal Price: ₹${record.modal_price} per quintal, Date: ${record.arrival_date}` }
    ]);

    setChatMessages([{
      id: `market_${Date.now()}`,
      role: 'assistant',
      content: contextMessage,
      timestamp: new Date()
    }]);

    setActiveTab('home');

    // Slight delay to allow the dashboard to render before switching to chat mode
    // This prevents state updates from being swallowed during the transition
    setTimeout(() => {
      setIsChatMode(true);
    }, 100);

    toast.success(tMarket.sentToChat || '✅ Market data sent to chat!');
  };

  // Unified render function for the Home screen (handles Dashboard & Chat Modes)
  const renderHomeScreen = () => {
    // 1. Gather all items for the dashboard (Recent Queries)
    const allItems = [
      ...libraryItems.map(item => ({
        id: item.id,
        query: language === "hi" ? item.diseaseNameHi : item.diseaseName,
        response: language === "hi" ? item.summaryHi : item.summary,
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
        messages: item.messages // Preserve full history
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const recentQueries = allItems.slice(0, 3);

    // 2. CHAT MODE: Return the chat interface
    if (isChatMode) {
      return (
        <div className="flex flex-col h-full bg-background pb-24 animate-in fade-in duration-500">
          {/* Chat Header - Glassmorphism */}
          <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-4 bg-background/60 dark:bg-background/80 backdrop-blur-apple border-b border-border/50 shadow-sm">
            <button
              onClick={exitChat}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted/30 border border-border/50 shadow-sm hover:bg-muted/80 transition-all active:scale-95 group"
            >
              <X size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <img src="/logo.svg" alt="AgroTalk" className="w-5 h-5" />
              </div>
              <h1 className="text-body font-bold text-foreground tracking-tight">
                AgroTalk <span className="text-primary font-black">AI</span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice Model Selector (Mini) */}
              <div className="relative" ref={voiceMenuRef}>
                <button
                  onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                  className={cn(
                    "flex items-center gap-1 px-2 h-9 rounded-lg border shadow-sm transition-all active:scale-95 text-[10px] font-bold uppercase tracking-wider",
                    showVoiceMenu
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/30 border-border/50 hover:bg-muted/60"
                  )}
                >
                  {selectedVoice}
                  <ChevronDown size={10} className={cn("transition-transform duration-300", showVoiceMenu && "rotate-180")} />
                </button>

                {showVoiceMenu && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-40 bg-card/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-200">
                    {voiceOptions.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoice(voice.id);
                          localStorage.setItem("agrovoice_voice", voice.id);
                          setShowVoiceMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-[11px] font-bold uppercase tracking-tight flex items-center gap-2 transition-colors",
                          selectedVoice === voice.id ? "text-primary" : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                        )}
                      >
                        {voice.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-95 group",
                  isMuted ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"
                )}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </header>

          {/* Chat Messages */}
          <ScrollArea ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
              {chatMessages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={cn("animate-fade-in", msg.role === 'user' ? "flex justify-end" : "flex justify-start")}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] animate-in slide-in-from-right-4 duration-500">
                      <div className="bg-primary text-white px-5 py-3 rounded-2xl rounded-tr-md shadow-md shadow-primary/20">
                        <p className="text-[16px] leading-relaxed font-medium">{msg.content}</p>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 px-1 opacity-60">
                        <span className="text-[10px] font-bold uppercase tracking-tighter">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[92%] animate-in slide-in-from-left-4 duration-500">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mt-1">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="relative bg-card/60 dark:bg-card/40 backdrop-blur-md rounded-2xl rounded-tl-md shadow-apple-sm border border-border/40 overflow-hidden">
                            <div className="px-5 py-4">
                              {msg.condition && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-3 rounded-md bg-primary/10 border border-primary/20">
                                  <img src="/logo.svg" alt="" className="w-2.5 h-2.5" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-primary">{getTranslation('common', language).analysis}</span>
                                </div>
                              )}
                              <div className="prose prose-sm dark:prose-invert text-foreground max-w-none leading-relaxed prose-p:my-1 prose-headings:mb-2 prose-headings:text-primary">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border/30">
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                onClick={() => handlePlayMessage(msg.id, msg.content)}
                                disabled={isMuted}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm",
                                  currentPlayingId === msg.id && isPlaying
                                    ? "bg-primary text-white"
                                    : "bg-background text-primary border border-primary/20 hover:bg-primary/5",
                                  isMuted && "opacity-40 cursor-not-allowed"
                                )}
                              >
                                {currentPlayingId === msg.id && isPlaying ? <><Pause className="w-3 h-3" /><span>Stop</span></> : <><Volume2 className="w-3 h-3" /><span>Listen</span></>}
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
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-3 pb-4">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <button
                onClick={handleMicClick}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-primary text-white shadow-green"
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
                      "w-full h-14 pl-5 pr-14 rounded-full",
                      "bg-card border-2 border-border",
                      "text-body placeholder:text-muted-foreground/60",
                      "focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                      "transition-all duration-200 shadow-apple-sm",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    disabled={isProcessing}
                  />
                  {textInput.trim() && (
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2",
                        "w-10 h-10 rounded-full",
                        "bg-[#76b900] text-white",
                        "flex items-center justify-center",
                        "hover:bg-[#5da600]",
                        "active:scale-95 transition-all duration-200",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <ArrowRight size={20} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      );
    }

    // 3. DASHBOARD MODE (Default)
    return (
      <div className="flex flex-col flex-1 pb-32 bg-background animate-in fade-in duration-700">
        {/* Modern Glass Header */}
        <header className="sticky top-0 z-40 px-5 py-4 bg-background/60 dark:bg-background/80 backdrop-blur-apple border-b border-border/50 transition-all duration-300">
          <div className="flex items-center justify-between max-w-lg mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white shadow-apple-sm flex items-center justify-center border border-border/50 group hover:scale-105 transition-all">
                <img src="/logo.svg" alt="AgroTalk" className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-body font-bold text-foreground leading-none tracking-tight">Agrotalk</h1>
                <ConnectionStatus isOnline={isOnline} language={language} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/call-agent')}
                className="flex items-center justify-center p-2 rounded-full bg-card border border-border/50 shadow-apple-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 w-10 h-10"
                aria-label="Call AI Agent"
              >
                <PhoneCall size={20} className="text-primary" />
              </button>
              <button
                onClick={() => setIsWhatsAppOpen(true)}
                className="flex items-center justify-center p-2 rounded-full bg-card border border-border/50 shadow-apple-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 w-10 h-10"
                aria-label="WhatsApp Bridge"
              >
                <MessageCircle size={20} className="text-[#25D366]" />
              </button>
              <LanguageSelector selectedLanguage={language} onLanguageChange={setLanguage} />
              <button className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground active:scale-90">
                <Bell size={18} />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground active:scale-90 overflow-hidden border border-border/50">
                <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=100&auto=format&fit=crop" alt="User" className="w-full h-full object-cover" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-5 py-6">
          {/* Weather Section - Card Style */}
          <div className="mb-8 animate-in slide-in-from-top-4 duration-500 delay-150">
            <WeatherDashboard
              data={weatherData}
              loading={isWeatherLoading}
              error={weatherError}
              language={language}
              lastUpdated={!isOnline ? weatherLastUpdated : null}
            />
          </div>

          {/* Compact Hero Section */}
          <div className="mb-6 animate-in slide-in-from-top-4 duration-500 delay-300">
            <div className="flex flex-col items-center text-center mb-4">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {t.greeting}, <span className="text-primary">{getTranslation('common', language).farmer}!</span>
              </h2>
              <p className="text-[12px] text-muted-foreground leading-none mt-1">
                {t.greetingSubtext}
              </p>
            </div>

            {/* Thin Quick Search Card */}
            <div className="relative group cross-fade">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[20px] blur-lg opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <form onSubmit={handleTextSubmit} className="relative">
                <div className="bg-card rounded-[18px] shadow-apple-sm border border-border/60 p-1 focus-within:border-primary/40 transition-all duration-300 group-hover:shadow-apple-md">
                  <div className="flex items-center">
                    <div className="pl-3 pr-1 text-primary">
                      <Search size={18} strokeWidth={2.5} />
                    </div>
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder={getPlaceholderText()}
                      className="flex-1 h-9 bg-transparent border-none text-[13px] focus:ring-0 placeholder:text-muted-foreground/50 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleMicClick}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90",
                        isRecording ? "bg-destructive text-white animate-pulse" : "text-primary hover:bg-primary/10"
                      )}
                    >
                      <Mic size={16} strokeWidth={2.5} />
                    </button>
                    {textInput.trim() && (
                      <button
                        type="submit"
                        className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 hover:scale-105 active:scale-90 transition-all ml-1"
                      >
                        <ArrowRight size={16} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Camera Button */}
          <button
            onClick={() => setIsImageOpen(true)}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-3xl bg-card border border-border shadow-apple-sm hover:shadow-apple hover:-translate-y-0.5 transition-all active:scale-95 mb-10"
          >
            <Camera size={22} className="text-primary" />
            <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">{t.scanCrop}</span>
          </button>

          {/* Recent Queries */}
          <section className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-body font-bold text-foreground tracking-tight">{t.recentQueries}</h2>
              {recentQueries.length > 0 && (
                <button
                  onClick={() => setActiveTab('library')}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity"
                >
                  {getTranslation('common', language).viewLibrary}
                </button>
              )}
            </div>
            <div className="space-y-4">
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
                <div className="p-10 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                  <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{getTranslation('common', language).noRecentQueries}</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {!isOnline && <OfflineBanner language={language} />}

      <main className={cn("flex-1 flex flex-col", !isOnline ? "pt-14" : "", isChatMode && activeTab === "home" ? "h-screen" : "")}>
        {activeTab === "home" && renderHomeScreen()}
        {activeTab === "library" && (
          <LibraryScreen
            weatherData={weatherData}
            isWeatherLoading={isWeatherLoading}
            onShareChat={(analysis) => {
              handleShareToChat(analysis);
            }}
          />
        )}
        {activeTab === "settings" && (
          <SettingsScreen language={language} onLanguageChange={setLanguage} voiceSpeed={voiceSpeed} onVoiceSpeedChange={setVoiceSpeed} />
        )}
        {activeTab === "market" && (
          <MarketPriceScreen
            language={language}
            isOnline={isOnline}
            onShareChat={handleMarketShare}
          />
        )}
      </main>


      {!isChatMode && <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} language={language} />}

      <ImageAnalysis
        isOpen={isImageOpen}
        onClose={() => { setIsImageOpen(false); refreshLibrary(); }}
        language={language}
        onShareChat={handleShareToChat}
      />

      <VoiceInteraction
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        language={language}
        initialMessages={initialVoiceMessages}
        initialConversationId={voiceContextId}
        weatherContext={weatherData ? {
          temp: weatherData.current.temperature_2m,
          condition: weatherData.current.weather_code,
          humidity: weatherData.current.relative_humidity_2m
        } : undefined}
      />

      <WhatsAppStatus isOpen={isWhatsAppOpen} onClose={() => setIsWhatsAppOpen(false)} />
    </div>
  );
}
