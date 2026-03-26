import { useState, useRef, useEffect } from "react";
import { X, Volume2, VolumeX, AlertTriangle, Send, Bot, User, Leaf, Play, Pause, RotateCcw, ArrowRight, ChevronDown, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { MicrophoneButton } from "./MicrophoneButton";
import { Button } from "./ui/button";
import { transcribeAndGetAdvice, getTextAdvice, ConversationMessage, getNvidiaTts } from "@/lib/apiClient";
import type { AgriculturalAdvisory } from "@/lib/apiClient";
import { getTranslation } from "@/lib/translations";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type VoiceState = "idle" | "recording" | "processing" | "response";

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const MIN_AUDIO_BYTES = 1000;
const RECORDER_TIMESLICE_MS = 250;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rawContent?: string;
  timestamp: Date;
  condition?: string;
}

interface VoiceInteractionProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  isIntegrated?: boolean;
  weatherContext?: {
    temp: number;
    condition: number;
    humidity: number;
  };
  initialMessages?: ChatMessage[];
  initialConversationId?: string;
}

export function VoiceInteraction({ isOpen, onClose, language, isIntegrated, weatherContext, initialMessages, initialConversationId }: VoiceInteractionProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [advisory, setAdvisory] = useState<AgriculturalAdvisory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [conversationId, setConversationId] = useState<string>(initialConversationId || "");
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("agrovoice_muted") === "true");
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem("agrovoice_voice") || "mia");
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [shouldForceEdge, setShouldForceEdge] = useState(false);
  const voiceMenuRef = useRef<HTMLDivElement>(null);

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


  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && conversationHistory.length === 0) {
      const history = initialMessages.map(m => ({
        role: m.role,
        content: m.content
      })).slice(-6);
      setConversationHistory(history);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (isOpen) {
      if (!conversationId) {
        const newId = initialConversationId || `chat_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        setConversationId(newId);

        const isMarket = newId.startsWith("market");
        const isAnalysis = newId.startsWith("analysis");
        setShouldForceEdge(isMarket || isAnalysis);

        if (isMarket || isAnalysis) {
          const marketPrompts: Record<string, string> = {
            en: "I've shared some market price data. Please summarize it and give me advice.",
            hi: "मैंने कुछ मंडी भाव डेटा साझा किया है। कृपया इसका सारांश दें और मुझे सलाह दें।",
            ta: "சில சந்தை விலை தரவை பகிர்ந்துள்ளேன். சுருக்கமாக சொல்லி ஆலோசனை தாருங்கள்.",
            te: "కొంత మార్కెట్ ధర డేటా పంచుకున్నాను. దయచేసి సారాంశం చెప్పి సలహా ఇవ్వండి.",
            mr: "मी काही बाजार भाव डेटा शेअर केला आहे. कृपया तयाचा सारांश द्या आणि मला सल्ला द्या.",
          };
          const analysisPrompts: Record<string, string> = {
            en: "I've shared a crop analysis. What should I do next?",
            hi: "मैंने एक फसल विश्लेषण साझा किया है। मुझे आगे क्या करना चाहिए?",
            ta: "பயிர் பகுப்பாய்வை பகிர்ந்துள்ளேன். அடுத்து என்ன செய்ய வேண்டும்?",
            te: "పంట విశ్లేషణను పంచుకున్నాను. తర్వాత ఏమి చేయాలి?",
            mr: "मी पीक विश्लेषण शेअर केले आहे. मी पुढे काय करावे?",
          };
          const prompt = isMarket
            ? (marketPrompts[language] || marketPrompts.en)
            : (analysisPrompts[language] || analysisPrompts.en);
          processResponse(prompt, true, true);
        }
      }
    }
  }, [isOpen]);


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
    localStorage.setItem("agrovoice_muted", String(isMuted));
    if (isMuted) {
      if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentPlayingId(null);
    }
  }, [isMuted, ttsAudio]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedMimeTypeRef = useRef<string>("audio/webm");
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const accumulatedTranscriptRef = useRef("");

  const t = getTranslation('voice', language);
  const tCommon = getTranslation('common', language);

  // Scroll to bottom when new messages arrive or state changes (processing)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, state]);

  useEffect(() => {
    if (isOpen && weatherContext) {
      const alerts: Record<string, { rain: string; heat: string; title: string }> = {
        en: { title: 'Weather Alert', rain: 'Warning: Rain detected. Postpone pesticide spraying.', heat: 'Heat Alert: Crops may need extra irrigation today.' },
        hi: { title: 'मौसम चेतावनी', rain: 'चेतावनी: बारिश की संभावना है। कीटनाशक छिड़काव स्थगित करें।', heat: 'गर्मी की चेतावनी: अतिरिक्त सिंचाई की आवश्यकता हो सकती है।' },
        ta: { title: 'வானிலை எச்சரிக்கை', rain: 'எச்சரிக்கை: மழை கண்டறியப்பட்டது. பூச்சிக்கொல்லி தெளிப்பை ஒத்திவையுங்கள்.', heat: 'வெப்ப எச்சரிக்கை: பயிர்களுக்கு இன்று கூடுதல் நீர்ப்பாசனம் தேவைப்படலாம்.' },
        te: { title: 'వాతావరణ హెచ్చరిక', rain: 'హెచ్చరిక: వర్షం గుర్తించబడింది. పురుగుమందు పిచికారీ వాయిదా వేయండి.', heat: 'వేడి హెచ్చరిక: పంటలకు ఈరోజు అదనపు నీటిపారుదల అవసరం కావచ్చు.' },
        mr: { title: 'हवामान इशारा', rain: 'इशारा: पाऊस आढळला. कीटकनाशक फवारणी पुढे ढकला.', heat: 'उष्णता इशारा: पिकांना आज अतिरिक्त सिंचन लागू शकते.' },
      };
      const a = alerts[language] || alerts.en;
      if (weatherContext.condition >= 50 && weatherContext.condition < 99) {
        setWeatherAlert(a.rain);
      } else if (weatherContext.temp > 35) {
        setWeatherAlert(a.heat);
      } else {
        setWeatherAlert(null);
      }
    }
  }, [isOpen, weatherContext, language]);

  function stopStreamTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
    }
  }

  const addMessage = (role: 'user' | 'assistant', content: string, condition?: string) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      rawContent: content,
      timestamp: new Date(),
      condition
    };
    setChatMessages(prev => [...prev, newMsg]);
  };

  const processResponse = async (text: string, isSilent: boolean = false, forceEdge: boolean = false) => {
    // Add user message to chat
    if (!isSilent) addMessage('user', text);
    setState("processing");

    try {
      const result = await getTextAdvice(text, language, weatherContext, conversationHistory, true, conversationId, selectedVoice, forceEdge);

      if (result.success && result.advisory) {
        setTranscript(result.transcript || text);
        setAdvisory(result.advisory);
        setState("response");

        // Add assistant message to chat
        addMessage('assistant', result.advisory.recommendation, result.advisory.condition);

        // Update conversation history for context
        setConversationHistory(prev => [
          ...prev,
          { role: 'user' as const, content: text },
          { role: 'assistant' as const, content: result.advisory!.recommendation }
        ].slice(-6));

        // Play TTS
        setTimeout(() => {
          playResponse(result.advisory!.recommendation, result.audio, forceEdge);
        }, 300);
      } else {
        setErrorMessage(result.error || "Failed");
        setState("idle");
      }
    } catch (e) {
      setErrorMessage("Connection error");
      setState("idle");
    }
  };

  const handleMicClick = async () => {
    if (state === "idle" || state === "response") {
      setErrorMessage(null);
      setTranscript("");
      setTextInput("");
      setAdvisory(null);
      stopStreamTracks();

      const WindowObj = window as unknown as IWindow;
      const Recognition = WindowObj.webkitSpeechRecognition || WindowObj.SpeechRecognition;

      if (Recognition) {
        console.log("🎙️ Using Browser Speech Recognition (Primary)");

        try {
          const recognition = new Recognition();
          const langMap: Record<string, string> = {
            'hi': 'hi-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'mr': 'mr-IN',
            'en': 'en-US'
          };
          recognition.lang = langMap[language] || 'en-US';
          recognition.continuous = true;
          recognition.interimResults = true;
          accumulatedTranscriptRef.current = "";

          recognition.onstart = () => setState("recording");

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

            // Show real-time feedback in the text input so user sees we are listening
            setTextInput(accumulatedTranscriptRef.current + interimTranscript);
          };

          recognition.onend = () => {
            console.log("🎙️ Speech recognition ended");
            setState(prev => {
              if (prev === "recording") {
                // If it ended while we thought we were still recording, 
                // it might mean the browser reached a silence timeout.
                // We'll process what we have if any.
                return "idle"; // handleMicClick will handle the rest if called, 
                // but here we just ensure we don't get stuck.
              }
              return prev;
            });
          };

          recognition.onerror = (e: any) => {
            console.warn("Browser Speech Error:", e);
            if (e.error === 'not-allowed') {
              setErrorMessage(t.micDenied);
            } else if (e.error === 'network') {
              setErrorMessage("Network error. Try checking connection.");
            } else if (e.error !== 'aborted') {
              setErrorMessage("Voice recognition failed. Try again.");
            }
            setState("idle");
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error(e);
          setErrorMessage("Voice start failed");
          setState("idle");
        }
        return;
      }

      // Fallback to MediaRecorder
      console.log("📡 Browser Speech missing. Falling back to Backend Whisper...");
      if (!navigator.onLine) {
        setErrorMessage("Offline speech not supported in this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        streamRef.current = stream;

        let mimeType = "audio/webm";
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";

        recordedMimeTypeRef.current = mimeType;
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeTypeRef.current });
          stopStreamTracks();

          if (audioBlob.size < MIN_AUDIO_BYTES) {
            setErrorMessage(t.noAudio);
            setState("idle");
            return;
          }

          setState("processing");
          const result = await transcribeAndGetAdvice(audioBlob, language, weatherContext, conversationHistory, true, conversationId);

          if (result.success && result.advisory) {
            setTranscript(result.transcript || "");
            setAdvisory(result.advisory);
            setState("response");
            setShowTranscript(false);

            addMessage('user', result.transcript || '');
            addMessage('assistant', result.advisory.recommendation, result.advisory.condition);

            setConversationHistory(prev => [
              ...prev,
              { role: 'user' as const, content: result.transcript || '' },
              { role: 'assistant' as const, content: result.advisory!.recommendation }
            ].slice(-6));

            playResponse(result.advisory.recommendation, result.audio);
          } else {
            setErrorMessage(result.error || t.serverError);
            setState("idle");
          }
        };

        mediaRecorder.start(RECORDER_TIMESLICE_MS);
        setState("recording");
      } catch (error) {
        console.error("Mic Error:", error);
        setErrorMessage(t.micDenied);
        setState("idle");
      }
      return;
    }

    if (state === "recording") {
      if (recognitionRef.current) {
        // For browser recognition (manual stop)
        const finalPayload = textInput.trim();
        recognitionRef.current.stop();
        stopStreamTracks();
        if (finalPayload) {
          await processResponse(finalPayload);
        } else {
          setState("idle");
        }
      } else if (mediaRecorderRef.current) {
        // For MediaRecorder fallback
        mediaRecorderRef.current.stop();
        // processing happens in mediaRecorder.onstop
      } else {
        stopStreamTracks();
        setState("idle");
      }
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const text = textInput.trim();
    setTextInput("");
    await processResponse(text);
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

  // Enhanced TTS with NVIDIA Cloud Backend
  const speakText = async (text: string, messageId?: string, force: boolean = false, forceEdge: boolean = false) => {
    if (isMuted && !force) return;

    // If forcing (e.g. manual play click), unmute automatically
    if (force && isMuted) {
      setIsMuted(false);
    }

    // Stop any current playback
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
    }

    try {
      setIsPlaying(true);
      if (messageId) setCurrentPlayingId(messageId);

      const cleanedText = cleanMarkdown(text);
      const audioBlob = await getNvidiaTts(cleanedText, language, forceEdge);

      if (!audioBlob) {
        console.warn("⚠️ NVIDIA TTS failed, no fallback enabled as per request.");
        setIsPlaying(false);
        setCurrentPlayingId(null);
        return;
      }

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
        URL.revokeObjectURL(audioUrl);
      };

      setTtsAudio(audio);
      audio.play().catch(e => {
        console.error("Playback error:", e);
        setIsPlaying(false);
        setCurrentPlayingId(null);
      });

    } catch (error) {
      console.error("TTS Error:", error);
      setIsPlaying(false);
      setCurrentPlayingId(null);
    }
  };

  const playResponse = (text: string, audioBase64?: string, forceEdge: boolean = false) => {
    if (isMuted) {
      console.log('🔇 Muted: Skipping audio playback');
      return;
    }
    if (audioBase64) {
      console.log('🔊 Playing natural TTS audio');
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      };
      audio.onerror = () => {
        console.warn('TTS audio failed');
        setIsPlaying(false);
        setCurrentPlayingId(null);
      };
      setTtsAudio(audio);
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      });
    } else {
      speakText(text, undefined, false, forceEdge);
    }
  };

  const handlePlayMessage = (msgId: string, content: string) => {
    if (currentPlayingId === msgId && isPlaying) {
      if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentPlayingId(null);
    } else {
      speakText(content, msgId, true, shouldForceEdge);
    }
  };

  if (!isOpen) return null;

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

  const getSuggestions = () => {
    const s: Record<string, string[]> = {
      en: ["Crop disease help", "Weather advice", "Pest control"],
      hi: ["फसल रोग सहायता", "मौसम सलाह", "कीट नियंत्रण"],
      ta: ["பயிர் நோய் உதவி", "வானிலை ஆலோசனை", "பூச்சி கட்டுப்பாடு"],
      te: ["పంట వ్యాధి సహాయం", "వాతావరణ సలహా", "పురుగు నియంత్రణ"],
      mr: ["पीक रोग मदत", "हवामान सल्ला", "कीड नियंत्रण"]
    };
    return s[language] || s.en;
  };

  return (
    <div className={cn(
      isIntegrated
        ? "flex flex-col h-full bg-gradient-to-b from-background via-background to-green-wash/30 pb-24"
        : "fixed inset-0 z-50 bg-gradient-to-b from-background via-background to-green-wash/30 animate-slide-in-right flex flex-col"
    )}>
      {/* Premium Glass Header */}
      <header className="relative flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />

        <button onClick={onClose} className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 border border-border/50 shadow-sm hover:bg-muted hover:border-primary/30 transition-all active:scale-95">
          <X size={18} className="text-muted-foreground" />
        </button>

        <div className="relative flex items-center gap-2">
          {/* Header text and icon removed per user request */}
        </div>

        {/* Voice Model Selector */}
        <div className="relative" ref={voiceMenuRef}>
          <button
            onClick={() => setShowVoiceMenu(!showVoiceMenu)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-10 rounded-xl border shadow-sm transition-all active:scale-95",
              showVoiceMenu
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-white/80 border-border/50 hover:bg-muted hover:border-primary/30"
            )}
          >
            <Volume2 size={14} className={showVoiceMenu ? "text-primary" : "text-primary"} />
            <span className={cn("text-xs font-medium capitalize", showVoiceMenu ? "text-primary" : "text-foreground")}>
              {selectedVoice}
            </span>
            <ChevronDown size={14} className={cn("text-muted-foreground transition-transform duration-200", showVoiceMenu && "rotate-180 text-primary")} />
          </button>

          {showVoiceMenu && (
            <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-white rounded-xl border border-border/50 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-3 py-2 border-b border-border/30 bg-muted/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {{
                    en: 'Select Voice', hi: 'आवाज़ चुनें', ta: 'குரல் தேர்ந்தெடு', te: 'గళం ఎంచుకోండి', mr: 'आवाज निवडा'
                  }[language] || 'Select Voice'}
                </span>
              </div>
              <div className="p-1">
                {voiceOptions.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => {
                      setSelectedVoice(voice.id);
                      localStorage.setItem("agrovoice_voice", voice.id);
                      setShowVoiceMenu(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 rounded-lg transition-colors",
                      selectedVoice === voice.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/80 hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full ring-2 ring-offset-1",
                      selectedVoice === voice.id ? "bg-primary ring-primary/30" : "bg-border ring-transparent"
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
            "relative w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95",
            isMuted
              ? "bg-destructive/10 border border-destructive/30 text-destructive"
              : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
          )}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      {/* Premium Chat Container */}
      <ScrollArea ref={chatContainerRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
          {/* Weather Alert */}
          {weatherAlert && chatMessages.length === 0 && (
            <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 flex items-start gap-3 animate-fade-in shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-800">{{
                  en: 'Weather Alert', hi: 'मौसम चेतावनी', ta: 'வானிலை எச்சரிக்கை', te: 'వాతావరణ హెచ్చరిక', mr: 'हवामान इशारा'
                }[language] || 'Weather Alert'}</h3>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">{weatherAlert}</p>
              </div>
            </div>
          )}

          {/* Premium Empty State */}
          {chatMessages.length === 0 && state === "idle" && (
            <div className="text-center py-16 animate-fade-in">
              <div className="relative w-36 h-36 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse-glow" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 animate-breathing" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white to-green-50 shadow-xl border border-primary/20 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
                  <Bot className="w-10 h-10 text-primary relative z-10" />
                </div>
                <div className="absolute top-2 right-6 w-2 h-2 rounded-full bg-primary animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute bottom-6 left-2 w-1.5 h-1.5 rounded-full bg-primary/70 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
              </div>

              <h2 className="text-xl font-bold text-foreground mb-2">
                {{
                  en: 'How can I help?',
                  hi: 'मैं कैसे मदद करूं?',
                  ta: 'நான் எப்படி உதவ?',
                  te: 'నేను ఎలా సహాయం చేయగలను?',
                  mr: 'मी कशी मदत करू?'
                }[language] || 'How can I help?'}
              </h2>
              <p className="text-body text-muted-foreground max-w-sm mx-auto mb-6">{t.tapToSpeak}</p>

              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {getSuggestions().map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => processResponse(suggestion)}
                    className="px-4 py-2 rounded-full bg-white/80 border border-primary/20 text-sm text-primary font-medium hover:bg-primary/10 hover:border-primary/40 transition-all active:scale-95 shadow-sm flex items-center gap-2"
                  >
                    <img src="/logo.svg" alt="" className="w-3 h-3 opacity-70" />
                    {suggestion}
                  </button>
                ))}
              </div>

              {errorMessage && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl mt-6 max-w-sm mx-auto">
                  <p className="text-footnote text-destructive font-medium" role="alert">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Premium Chat Bubbles */}
          {chatMessages.map((msg, index) => (
            <div
              key={msg.id}
              className={cn("animate-fade-in", msg.role === 'user' ? "flex justify-end" : "flex justify-start")}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[85%] group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-dark rounded-2xl rounded-br-md blur-sm opacity-30 group-hover:opacity-40 transition-opacity" />
                    <div className="relative bg-gradient-to-br from-primary to-primary-dark text-white px-5 py-3.5 rounded-2xl rounded-br-md shadow-lg shadow-primary/20">
                      <p className="text-body leading-relaxed">{msg.content}</p>
                    </div>
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
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {msg.condition && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-full bg-primary/10 border border-primary/20">
                          <Bot className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{msg.condition}</span>
                        </div>
                      )}

                      <div className="relative bg-white rounded-2xl rounded-tl-md shadow-sm border border-border/50 overflow-hidden group-hover:shadow-md group-hover:border-primary/20 transition-all">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

                        <div className="px-5 py-4">
                          <div className="prose prose-sm text-foreground max-w-none leading-relaxed prose-headings:text-primary prose-strong:text-primary-dark prose-li:marker:text-primary">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
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
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95",
                              currentPlayingId === msg.id && isPlaying
                                ? "bg-primary text-white shadow-md shadow-primary/30"
                                : "bg-white text-primary border border-primary/30 hover:bg-primary/10",
                              isMuted && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {currentPlayingId === msg.id && isPlaying ? (
                              <>
                                <Pause className="w-3 h-3" />
                                <span>{{
                                  en: 'Stop', hi: 'रोकें', ta: 'நிறுத்து', te: 'ఆపు', mr: 'थांबवा'
                                }[language] || 'Stop'}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>{{
                                  en: 'Listen', hi: 'सुनें', ta: 'கேளுங்கள்', te: 'వినండి', mr: 'ऐका'
                                }[language] || 'Listen'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Processing Indicator */}
          {state === "processing" && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 shadow-sm animate-pulse">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-md shadow-sm border border-border/50 px-5 py-4">
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

          {/* Recording Indicator */}
          {state === "recording" && (
            <div className="flex justify-end animate-fade-in">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 px-5 py-3.5 rounded-2xl rounded-br-md shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-50" />
                  </div>
                  <span className="text-sm text-primary font-semibold">{t.listening}</span>
                  <div className="flex items-center gap-0.5 h-4">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-primary rounded-full animate-pulse"
                        style={{ height: `${Math.random() * 12 + 8}px`, animationDelay: `${i * 100}ms`, animationDuration: '0.5s' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Premium Input Area */}
      <div className="border-t border-border/50 bg-white/80 backdrop-blur-xl p-3 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={handleMicClick}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                state === "recording"
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
                    "bg-white border-2 border-border",
                    "text-body placeholder:text-muted-foreground/60",
                    "focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                    "transition-all duration-200 shadow-apple-sm",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  disabled={state === "recording" || state === "processing"}
                />

                {textInput.trim() && (
                  <button
                    type="submit"
                    disabled={!textInput.trim() || state === "recording" || state === "processing"}
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

          {!isMuted && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Volume2 className="w-3 h-3 text-primary/60" />
              <span className="text-[10px] text-muted-foreground">
                {language === 'en' && "Voice: English"}
                {language === 'hi' && "आवाज़: हिंदी"}
                {language === 'ta' && "குரல்: தமிழ்"}
                {language === 'te' && "వాయిస్: తెలుగు"}
                {language === 'mr' && "आवाज: मराठी"}
              </span>
            </div>
          )}

          {chatMessages.length > 0 && state === "idle" && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setChatMessages([])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {language === 'hi' ? 'नई बातचीत' : language === 'ta' ? 'புதிய அரட்டை' : language === 'te' ? 'కొత్త చాట్' : language === 'mr' ? 'नवीन गप्पा' : 'New Chat'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
