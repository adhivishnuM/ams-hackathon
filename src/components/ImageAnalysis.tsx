import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, Volume2, VolumeX, CheckCircle, AlertCircle, Loader2, RotateCcw, BookmarkPlus, Share2, Search, Languages, ShoppingCart, Bird, Leaf, ArrowLeft, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { analyzeImage, detectBirds, DiseaseAnalysis, BirdDetectionResult } from "@/lib/visionAnalysis";
import { getNvidiaTts } from "@/lib/apiClient";
import { useLibrary } from "@/hooks/useLibrary";
import { toast } from "sonner";
import { getTranslation, type SupportedLanguage } from "@/lib/translations";
import { getRecommendations } from "@/data/products";

type AnalysisState = "camera" | "uploading" | "analyzing" | "result";
type AnalysisMode = "plant" | "bird";

const PYTHON_API = "http://localhost:8000";

interface ImageAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  onShareChat?: (analysis: DiseaseAnalysis) => void;
  variant?: "overlay" | "inline";
}

export function ImageAnalysis({ isOpen, onClose, language, onShareChat, variant = "overlay" }: ImageAnalysisProps) {

  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("plant");
  const [birdResult, setBirdResult] = useState<BirdDetectionResult | null>(null);
  const [birdLiveActive, setBirdLiveActive] = useState(false);
  const [birdLiveStatus, setBirdLiveStatus] = useState<{ detected: boolean; confidence: number } | null>(null);
  const birdStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<AnalysisState>("camera");
  const [analysisStep, setAnalysisStep] = useState<"crop" | "disease">("crop");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DiseaseAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("agrovoice_muted") === "true");
  const [scarecrowEnabled, setScarecrowEnabled] = useState(true);
  const [alertLog, setAlertLog] = useState<{ time: string; confidence: number }[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastDetectedRef = useRef(false);
  const { addItem } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Scarecrow buzzer — plays scary alarm sound via Web Audio API
  const playBuzzerSound = () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.7, now);
      masterGain.connect(ctx.destination);

      // Layer 1: Rapid alarm sweep (hawk-like screech)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.15);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.45);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.6);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.4, now);
      g1.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc1.connect(g1);
      g1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Layer 2: Deep rumble for urgency
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(80, now);
      osc2.frequency.exponentialRampToValueAtTime(40, now + 0.6);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.3, now);
      g2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc2.connect(g2);
      g2.connect(masterGain);
      osc2.start(now);
      osc2.stop(now + 0.6);

      // Layer 3: Sharp click pulses
      for (let i = 0; i < 4; i++) {
        const noise = ctx.createOscillator();
        noise.type = 'square';
        noise.frequency.setValueAtTime(2400, now + i * 0.15);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.2, now + i * 0.15);
        ng.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.08);
        noise.connect(ng);
        ng.connect(masterGain);
        noise.start(now + i * 0.15);
        noise.stop(now + i * 0.15 + 0.08);
      }
    } catch (e) {
      console.warn('Audio context failed:', e);
    }
  };
  const isHindi = language === "hi";
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  const t = getTranslation('image', language);
  const tCommon = getTranslation('common', language);

  const handleShareToChat = () => {
    if (analysisResult && onShareChat) {
      onShareChat(analysisResult);
      toast.success(language === "hi" ? "चैट बॉक्स में भेज दिया गया!" : "Sent to chat!");
    }
  };

  // Helper to get localized content from the AI result
  const getContent = (enField: keyof DiseaseAnalysis, localizedField?: string) => {
    if (!analysisResult) return "";
    if (language === "en") return analysisResult[enField];

    // Check for language-specific key (e.g., description_ta, description_hi)
    const specificKey = `${String(enField)}_${language}` as keyof DiseaseAnalysis;
    if (analysisResult[specificKey]) return analysisResult[specificKey];

    // Check for generic localized key
    const genericKey = `${String(enField)}_localized` as keyof DiseaseAnalysis;
    if (analysisResult[genericKey]) return analysisResult[genericKey];

    // Fallback to English
    return analysisResult[enField];
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewImage(result);
        setOriginalImage(result);
        performAnalysis(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast.error(isHindi ? "कैमरा एक्सेस नहीं मिला" : "Camera access denied");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Use the actual video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPreviewImage(dataUrl);

        // Create a file from the blob to use existing analysis logic
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            performAnalysis(file);
          }
        }, 'image/jpeg', 0.9);
      }
      stopCamera();
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopBirdLive();
      audioCtxRef.current?.close();
    };
  }, []);

  // Scarecrow: trigger buzzer on new detection
  useEffect(() => {
    if (birdLiveStatus?.detected && !lastDetectedRef.current) {
      // Bird just detected!
      lastDetectedRef.current = true;
      if (scarecrowEnabled) {
        playBuzzerSound();
        // Schedule repeat every 2s while still detected
        const interval = setInterval(() => {
          if (lastDetectedRef.current && scarecrowEnabled) {
            playBuzzerSound();
          } else {
            clearInterval(interval);
          }
        }, 2200);
        setTimeout(() => clearInterval(interval), 8000); // Max 8s of buzzing
      }
      // Log detection
      setAlertLog(prev => [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), confidence: birdLiveStatus.confidence },
        ...prev.slice(0, 9)
      ]);
    } else if (!birdLiveStatus?.detected) {
      lastDetectedRef.current = false;
    }
  }, [birdLiveStatus?.detected, scarecrowEnabled]);

  const startBirdLive = () => {
    setBirdLiveActive(true);
    // Poll status every 600ms
    birdStatusIntervalRef.current = setInterval(async () => {
      try {
        const s = await fetch(`${PYTHON_API}/api/bird/status`);
        const sd = await s.json();
        setBirdLiveStatus({ detected: sd.detected, confidence: Math.round(sd.confidence * 100) });
      } catch {}
    }, 600);
  };

  const stopBirdLive = () => {
    if (birdStatusIntervalRef.current) {
      clearInterval(birdStatusIntervalRef.current);
      birdStatusIntervalRef.current = null;
    }
    setBirdLiveActive(false);
    setBirdLiveStatus(null);
    fetch(`${PYTHON_API}/api/bird/reset`, { method: 'POST' }).catch(() => {});
  };

  const uploadBirdVideo = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${PYTHON_API}/api/bird/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        startBirdLive();
      } else {
        toast.error('Upload failed: ' + data.message);
      }
    } catch {
      toast.error('Could not reach bird detection backend');
    }
  };

  const performAnalysis = async (file: File) => {
    setState("uploading");
    setErrorMessage("");
    setAnalysisResult(null);
    setBirdResult(null);
    setAnalysisStep("crop");

    try {
      await new Promise(r => setTimeout(r, 400));
      setState("analyzing");

      if (analysisMode === "bird") {
        const result = await detectBirds(file);
        setBirdResult(result);
        setState("result");
        return;
      }

      const stepTimer = setTimeout(() => setAnalysisStep("disease"), 1200);
      const visionResult = await analyzeImage(file, language);
      clearTimeout(stepTimer);

      if (!visionResult.success || !visionResult.analysis) {
        setErrorMessage(visionResult.error || "Analysis failed");
        setState("result");
        return;
      }

      setAnalysisResult(visionResult.analysis);
      if (visionResult.processed_image) {
        setPreviewImage(visionResult.processed_image);
      }
      setState("result");
      saveToLibrary(visionResult.analysis, previewImage);

    } catch (error) {
      setErrorMessage("Connection issue. Ensure backend is running.");
      setState("result");
    }
  };

  const saveToLibrary = async (result = analysisResult, image = previewImage) => {
    if (!result || !image) return;

    const newItem = {
      // English
      diseaseName: result.disease_name,
      cropType: result.crop_identified || "Unknown",
      summary: result.description,
      description: result.description,
      symptoms: result.symptoms,
      treatment: result.treatment_steps,
      // Hindi
      diseaseNameHi: result.disease_name_hindi,
      cropTypeHi: result.crop_identified_hindi || result.crop_identified || "अज्ञात",
      summaryHi: result.description_hindi,
      descriptionHi: result.description_hindi,
      symptomsHi: result.symptoms_hindi,
      treatmentHi: result.treatment_steps_hindi,
      // Tamil
      diseaseNameTa: result.disease_name_tamil,
      cropTypeTa: result.crop_identified_tamil,
      summaryTa: result.description_tamil,
      descriptionTa: result.description_tamil,
      symptomsTa: result.symptoms_tamil,
      treatmentTa: result.treatment_steps_tamil,
      // Telugu
      diseaseNameTe: result.disease_name_telugu,
      cropTypeTe: result.crop_identified_telugu,
      summaryTe: result.description_telugu,
      descriptionTe: result.description_telugu,
      symptomsTe: result.symptoms_telugu,
      treatmentTe: result.treatment_steps_telugu,
      // Marathi
      diseaseNameMr: result.disease_name_marathi,
      cropTypeMr: result.crop_identified_marathi,
      summaryMr: result.description_marathi,
      descriptionMr: result.description_marathi,
      symptomsMr: result.symptoms_marathi,
      treatmentMr: result.treatment_steps_marathi,
      // Common
      confidence: result.confidence,
      severity: result.severity,
      thumbnail: image,
    };

    const { item: savedItem, isDuplicate } = await addItem(newItem);
    setIsSaved(true);

    // Only show toast if triggered manually (i.e. analysisResult is already set) 
    // or if we want to confirm auto-save. Let's just confirm save.
    if (isDuplicate) {
      // toast.info(language === 'hi' ? "पहले से मौजूद" : "Already saved");
    } else if (savedItem) {
      toast.success(language === 'hi' ? "सहेजा गया" : "Saved to Library");
    }
  };

  const resetAnalysis = () => {
    stopCamera();
    setState("camera");
    setPreviewImage(null);
    setOriginalImage(null);
    setAnalysisResult(null);
    setBirdResult(null);
    setErrorMessage("");
    setIsSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const speakAdvice = async () => {
    if (isMuted) {
      toast.info(language === 'hi' ? "आवाज बंद है। सुनने के लिए अनम्यूट करें।" : "Audio is muted. Unmute to hear advice.");
      return;
    }

    if (!analysisResult) return;

    // Use localized content for speech
    const name = getContent('disease_name') as string;
    const desc = getContent('description') as string;
    const text = `${name}. ${desc}`;

    // 1. Try Nvidia TTS First
    try {
      if (navigator.onLine) {
        const audioBlob = await getNvidiaTts(text, language, undefined, true);
        if (audioBlob) {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn("Nvidia TTS failed, falling back to edge", e);
    }

    // 2. Fallback to Edge
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);

      // Map app language codes to TTS codes
      const langMap: Record<string, string> = {
        'hi': 'hi-IN',
        'ta': 'ta-IN',
        'te': 'te-IN',
        'mr': 'mr-IN',
        'kn': 'kn-IN',
        'bn': 'bn-IN',
        'ml': 'ml-IN',
        'pa': 'pa-IN',
        'gu': 'gu-IN',
        'en': 'en-US'
      };

      utterance.lang = langMap[language] || 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleClose = () => {
    stopCamera();
    resetAnalysis();
    onClose();
  };

  // Helper for static labels
  const getSectionTitle = (section: string) => {
    if (language === 'en') return section;

    const titles: Record<string, Record<string, string>> = {
      "How it was formed": {
        "hi": "यह कैसे बना",
        "ta": "இது எப்படி உருவானது",
        "te": "ఇది ఎలా ఏర్పడింది",
        "mr": "ते कसे तयार झाले"
      },
      "Treatment Plan": {
        "hi": "उपचार योजना",
        "ta": "சிகிச்சை திட்டம்",
        "te": "చికిత్స ప్రణాళిక",
        "mr": "उपचार योजना"
      },
      "Prevention Tips": {
        "hi": "रोकथाम युक्तियाँ",
        "ta": "தடுப்பு குறிப்புகள்",
        "te": "నివారణ చిట్కాలు",
        "mr": "प्रतिबंधात्मक उपाय"
      }
    };

    return titles[section]?.[language] || section;
  };

  const handleTranslate = async () => {
    if (!analysisResult || isTranslating) return;

    setIsTranslating(true);
    try {
      // Build the content to translate
      const contentToTranslate = {
        disease_name: analysisResult.disease_name,
        description: analysisResult.description,
        symptoms: analysisResult.symptoms,
        treatment_steps: analysisResult.treatment_steps,
        prevention_tips: analysisResult.prevention_tips,
        organic_options: analysisResult.organic_options
      };

      // Map language codes to names
      const langNames: Record<string, string> = {
        en: "English",
        hi: "Hindi",
        ta: "Tamil",
        te: "Telugu",
        mr: "Marathi"
      };

      const targetLang = langNames[language] || "English";

      // Call OpenRouter API for translation
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [
            {
              role: "user",
              content: `Translate the following plant disease analysis to ${targetLang}. Maintain the same structure and return ONLY a JSON object with the translated content:\n\n${JSON.stringify(contentToTranslate, null, 2)}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error("Translation failed");

      const data = await response.json();
      const translatedContent = JSON.parse(data.choices[0].message.content);

      // Update analysis result with translated content
      setAnalysisResult({
        ...analysisResult,
        ...translatedContent
      });

      setIsTranslated(true);
      toast.success(language === "hi" ? "अनुवाद पूर्ण!" : "Translation complete!");
    } catch (error) {
      console.error("Translation error:", error);
      toast.error(language === "hi" ? "अनुवाद विफल" : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  if (!isOpen && variant === "overlay") return null;

  const handleMutedChange = (newMuted: boolean) => {
    setIsMuted(newMuted);
    localStorage.setItem("agrovoice_muted", String(newMuted));
    if (!newMuted) speakAdvice();
    else window.speechSynthesis.cancel();
  };

  return (
    <div className={cn(
      "bg-background flex flex-col",
      variant === "overlay"
        ? "fixed inset-0 z-[39] animate-in fade-in slide-in-from-bottom-4 duration-300"
        : "min-h-screen"
    )}>
      {/* Header - shown in both modes */}
      <div className="border-b bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full">
            {variant === "overlay" ? <X className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
          </Button>
          <div className="text-center">
            <h2 className="text-headline font-bold text-foreground">{t.title}</h2>
            <p className="text-caption text-muted-foreground">{t.aiPowered}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleMutedChange(!isMuted)} className="rounded-full">
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Button>
        </div>
        {/* Mode switcher tabs */}
        <div className="flex mx-4 mb-3 p-1 bg-muted rounded-xl gap-1">
          <button
            onClick={() => { setAnalysisMode("plant"); resetAnalysis(); stopBirdLive(); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200",
              analysisMode === "plant"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Leaf size={15} />
            Plant Scan
          </button>
          <button
            onClick={() => { setAnalysisMode("bird"); resetAnalysis(); stopCamera(); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200",
              analysisMode === "bird"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bird size={15} />
            Bird Detect
          </button>
        </div>
      </div>

      <div className={cn("flex-1 overflow-y-auto", variant === "overlay" ? "pb-20" : "")}>
        {state === "camera" && analysisMode === "bird" && (
          <div className="flex-1 bg-[#050505] flex items-center justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-1000">
              
              {birdLiveActive ? (
                /* ── Floating Video Player: Active Surveillance ── */
                <div className="relative group">
                  {/* The Main Player Frame */}
                  <div className="relative aspect-video w-full bg-black rounded-[32px] sm:rounded-[48px] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                    
                    {/* Digital Grid & Scanlines */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none z-10" style={{ 
                      backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                      backgroundSize: '40px 40px' 
                    }} />
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-20">
                       <div className="w-full h-[1px] bg-white animate-scanline shadow-[0_0_10px_white]" />
                    </div>

                    {/* Video Feed */}
                    <img
                      src={`${PYTHON_API}/api/bird/feed`}
                      alt="Surveillance Feed"
                      className={cn(
                        "w-full h-full object-cover transition-all duration-1000",
                        birdLiveStatus?.detected && "scale-[1.03] saturate-[1.2] brightness-[1.1]"
                      )}
                    />

                    {/* TOP OVERLAYS: Status & Meta */}
                    <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-start z-30 pointer-events-none">
                      <div className="flex flex-col gap-2 pointer-events-auto">
                        <div className={cn(
                          "px-4 py-2 rounded-2xl flex items-center gap-2.5 backdrop-blur-xl border transition-all duration-500",
                          birdLiveStatus?.detected 
                            ? "bg-red-600/20 border-red-500/40 shadow-[0_0_20px_rgba(220,38,38,0.2)]" 
                            : "bg-black/60 border-white/10"
                        )}>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            birdLiveStatus?.detected ? "bg-red-500 animate-pulse-fast" : "bg-emerald-500 animate-pulse"
                          )} />
                          <span className={cn(
                            "text-[11px] font-black uppercase tracking-[0.2em]",
                            birdLiveStatus?.detected ? "text-red-500" : "text-emerald-500"
                          )}>
                            {birdLiveStatus?.detected ? "Bird Alert • Detected" : "System Clear • Scanning"}
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                           <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
                              <span className="text-[10px] font-mono text-white/40 uppercase">REC • 8080/SURV</span>
                           </div>
                           <button 
                             onClick={() => {
                               const el = document.getElementById('bird-upload-floating');
                               if (el) (el as HTMLInputElement).click();
                             }}
                             className="bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer pointer-events-auto group"
                           >
                              <Upload size={12} className="text-white/40 group-hover:text-white" />
                              <span className="text-[10px] font-mono text-white/40 uppercase group-hover:text-white">Upload</span>
                           </button>
                           <input id="bird-upload-floating" type="file" className="hidden" accept="video/*" onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) uploadBirdVideo(file);
                           }} />
                        </div>
                      </div>

                      {birdLiveStatus?.detected && (
                        <div className="px-6 py-3 rounded-2xl bg-red-600 text-white font-black text-sm animate-pulse-fast shadow-[0_0_40px_rgba(220,38,38,0.6)] border border-red-400/50 flex items-center gap-3">
                          <AlertCircle size={18} />
                          {birdLiveStatus.confidence}% ACCURACY
                        </div>
                      )}
                    </div>

                    {/* BOTTOM OVERLAYS: Coordinate Data */}
                    <div className="absolute bottom-0 inset-x-0 p-8 flex justify-between items-end z-30 pointer-events-none">
                       <div className="font-mono text-[10px] text-white/30 space-y-1">
                          <p>COORD: 34.0522° N, 118.2437° W</p>
                          <p>ALT: 142M | AZIMUTH: 182°</p>
                       </div>
                       <div className="font-mono text-[10px] text-white/30 text-right space-y-1">
                          <p>{new Date().toLocaleTimeString()} UTC</p>
                          <p>ENGINE: YOLO V8 • 45FPS</p>
                       </div>
                    </div>

                    {/* Alert Toast Overlay */}
                    {birdLiveStatus?.detected && scarecrowEnabled && (
                       <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center z-40 pointer-events-none">
                          <div className="px-10 py-5 bg-red-600/10 backdrop-blur-md border border-red-500/30 rounded-full animate-in zoom-in-50 duration-300">
                             <p className="text-red-500 font-black text-lg tracking-[0.4em] uppercase animate-pulse">
                               🔊 HIGH-FREQUENCY ALARM ACTIVE
                             </p>
                          </div>
                       </div>
                    )}
                  </div>

                  {/* FLOATING ACTION BAR: Integrated Controls */}
                  <div className="mt-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                    
                    {/* Left Actions: Toggle & History */}
                    <div className="flex items-center gap-4 bg-white/[0.03] backdrop-blur-md border border-white/10 p-2 rounded-[28px]">
                       <div className="flex items-center gap-4 px-4 py-2 border-r border-white/10">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white/80 uppercase">Auto-Scare</span>
                            <span className="text-[9px] text-white/30 uppercase">Trigger</span>
                          </div>
                          <button
                            onClick={() => setScarecrowEnabled(s => !s)}
                            className={cn(
                              'relative w-12 h-6.5 rounded-full transition-all duration-500 shadow-inner overflow-hidden',
                              scarecrowEnabled ? 'bg-red-600' : 'bg-white/10'
                            )}
                          >
                            <div className={cn(
                              'absolute top-1 w-4.5 h-4.5 bg-white rounded-full shadow-lg transition-all duration-500 ease-in-out',
                              scarecrowEnabled ? 'left-6.5' : 'left-1'
                            )} />
                          </button>
                       </div>

                       <div className="flex items-center gap-3 px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white/80 uppercase">AI Confidence</span>
                            <span className="text-[9px] text-white/30 uppercase">Scan Integrity</span>
                          </div>
                          <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700', birdLiveStatus?.detected ? 'bg-red-500' : 'bg-emerald-500')}
                              style={{ width: `${birdLiveStatus?.confidence ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[13px] font-mono font-black text-white tracking-tighter w-8">
                            {birdLiveStatus?.confidence ?? 0}%
                          </span>
                       </div>
                    </div>

                    {/* Primary Actions: Trigger & Close */}
                    <div className="flex items-center gap-4">
                       <button
                         onClick={playBuzzerSound}
                         className={cn(
                           "px-10 py-5 rounded-[28px] border-2 flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.97] group shadow-xl",
                           birdLiveStatus?.detected 
                             ? "bg-red-600 border-red-400 text-white animate-pulse" 
                             : "bg-white text-black border-transparent hover:bg-white/90"
                         )}
                       >
                         <VolumeX size={20} className={birdLiveStatus?.detected ? "animate-bounce" : ""} />
                         <span className="text-[14px] font-black uppercase tracking-[0.1em]">SCARE BIRDS NOW</span>
                       </button>

                       <button
                        onClick={stopBirdLive}
                        className="w-16 h-16 rounded-[28px] bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all duration-500 group"
                        title="Close Surveillance"
                      >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-500" />
                      </button>
                    </div>
                  </div>

                  {/* FLOATING LOG PANEL (Toggleable or persistent) */}
                  <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-[32px] p-6 backdrop-blur-sm">
                       <div className="flex items-center justify-between mb-6">
                          <h4 className="text-[12px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
                             <Terminal size={14} /> Detection History
                          </h4>
                          <span className="text-[10px] font-mono text-white/20 uppercase">{alertLog.length} Records</span>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                          {alertLog.length === 0 ? (
                            <div className="col-span-2 flex flex-col items-center justify-center py-10 opacity-20">
                               <p className="text-[11px] uppercase font-bold tracking-widest">Awaiting First Detection...</p>
                            </div>
                          ) : (
                            alertLog.map((alert, i) => (
                              <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl flex items-center justify-between group hover:bg-white/[0.05] transition-colors">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                       <Bird size={16} className="text-red-500" />
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-[11px] text-white/90 font-mono">{alert.time}</span>
                                       <span className="text-[9px] text-white/30 uppercase font-black">Intruder detected</span>
                                    </div>
                                 </div>
                                 <span className="text-[14px] font-black text-red-500/80">{alert.confidence}%</span>
                              </div>
                            ))
                          )}
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-[32px] p-6 flex flex-col justify-between">
                       <div>
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Protection Stats</p>
                          <h4 className="text-headline text-white font-black">24h ACTIVE MONITORING</h4>
                       </div>
                       <div className="mt-8 flex justify-between items-end">
                          <div>
                             <p className="text-[32px] font-black text-white leading-none">99.8%</p>
                             <p className="text-[10px] uppercase font-bold text-white/40 mt-1">Uptime</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[32px] font-black text-primary leading-none">{alertLog.length}</p>
                             <p className="text-[10px] uppercase font-bold text-white/40 mt-1">Scares Today</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Floating Video Player: Idle State ── */
                <div className="relative aspect-video w-full bg-[#0a0a0a] rounded-[32px] sm:rounded-[48px] overflow-hidden border border-white/10 flex flex-col items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.5)]">
                  {/* Digital Grid Overlay */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none z-10" style={{ 
                    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '40px 40px' 
                  }} />
                  
                  <div className="flex flex-col items-center justify-center gap-8 text-white relative z-20 animate-in fade-in zoom-in-95 duration-1000">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse shadow-[0_0_60px_rgba(255,255,255,0.05)]">
                        <Bird size={56} className="text-white/20" />
                      </div>
                      <div className="absolute -top-1 -right-1 px-3 py-1 rounded-lg bg-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg ring-4 ring-[#0a0a0a]">Offline</div>
                    </div>
                    
                    <div className="text-center px-10">
                      <h2 className="text-[40px] font-black text-white uppercase tracking-tighter leading-none mb-4">YOLO v8 Surveillance</h2>
                      <p className="text-[13px] text-white/30 uppercase tracking-[0.4em] font-mono">Detection Engine • Secure Channel Alpha</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 mt-4 w-full max-w-lg px-6">
                      <button
                        onClick={startBirdLive}
                        className="flex-1 py-6 rounded-[32px] bg-white text-black font-black uppercase tracking-widest text-[14px] hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                      >
                        Live Surveillance
                      </button>
                      <button
                        onClick={() => {
                          const el = document.getElementById('bird-upload-main-idle');
                          if (el) (el as HTMLInputElement).click();
                        }}
                        className="flex-1 py-6 rounded-[32px] bg-white/5 border border-white/20 text-white font-black uppercase tracking-widest text-[14px] hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                      >
                        <Upload size={20} />
                        Upload Video
                      </button>
                      <input id="bird-upload-main-idle" type="file" className="hidden" accept="video/*" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) uploadBirdVideo(file);
                       }} />
                    </div>
                  </div>

                  {/* Aesthetic Footer Meta */}
                  <div className="absolute bottom-8 flex gap-10 opacity-20 filter grayscale">
                      <span className="text-[10px] font-mono text-white tracking-[0.3em]">SURV_ALPH_8080</span>
                      <span className="text-[10px] font-mono text-white tracking-[0.3em] uppercase">Ready for Deployment</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {state === "camera" && analysisMode === "plant" && (
          <div className="flex flex-col items-center justify-center p-6 min-h-[60vh] animate-fade-in">
            {/* Upload/Camera Area */}
            <div
              className={cn(
                "relative w-full max-w-sm aspect-[4/3] rounded-apple-lg border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all",
                isCameraActive ? "border-primary shadow-apple-lg" : "border-primary bg-background hover:bg-green-wash hover:border-primary/70 cursor-pointer"
              )}
              onClick={() => !isCameraActive && fileInputRef.current?.click()}
            >
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none border-2 border-white/30 m-6 rounded-apple border-dashed" />
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-wash flex items-center justify-center mb-4">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-body font-medium text-muted-foreground text-center px-4">
                    {t.positionLeaf}
                  </p>
                  <p className="text-caption text-muted-foreground mt-2">
                    JPG, PNG (max 10MB)
                  </p>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="w-full max-w-sm mt-8 space-y-3">
              {isCameraActive ? (
                <>
                  <Button
                    onClick={capturePhoto}
                    className="w-full h-14 text-body font-bold rounded-apple bg-primary hover:bg-primary/90 shadow-green active:scale-[0.98] transition-all"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-white mr-2" />
                    {isHindi ? "फोटो खींचें" : "Snap Photo"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={stopCamera}
                    className="w-full h-12 text-muted-foreground font-medium"
                  >
                    {tCommon.cancel || (isHindi ? "रद्द करें" : "Cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={startCamera}
                    className="w-full h-14 text-body font-semibold rounded-apple bg-primary hover:bg-primary/90 shadow-green active:scale-[0.98] transition-all"
                  >
                    <Camera className="mr-2 h-5 w-5" /> {t.takePhoto}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-14 text-body font-semibold rounded-apple border-2 border-border hover:bg-green-wash hover:border-primary/50 active:scale-[0.98] transition-all"
                  >
                    <Upload className="mr-2 h-5 w-5 text-primary" /> {t.uploadPhoto}
                  </Button>
                </>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={handleFileSelect}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>
        )}

        {(state === "uploading" || state === "analyzing") && (
          <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in zoom-in-95 duration-500">
            {/* Scanning Animation Container - Reduced size */}
            <div className="relative w-[200px] aspect-square rounded-apple-lg overflow-hidden border-2 border-primary/20 shadow-green bg-black/5">
              {/* Preview Image */}
              {previewImage && (
                <img
                  src={previewImage}
                  alt="Scanning..."
                  className="w-full h-full object-cover opacity-90 scale-105"
                />
              )}

              {/* Scan Line Overlay - Fixed height and animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_20px_rgba(118,185,0,0.8)] animate-scan-line z-20" />

              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />

              {/* Grid Overlay for "High Tech" feel */}
              <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 pointer-events-none" />
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-title font-bold text-foreground">
                {state === "uploading" ? t.preparingScan : t.scanningPlant}
              </h3>
              <p className="text-subhead text-muted-foreground animate-pulse">
                {state === "uploading" ? t.optimizingImage : t.identifyingIssues}
              </p>
            </div>
          </div>
        )}

        {/* ── Bird detection result ── */}
        {state === "result" && birdResult && (
          <div className="p-6 animate-in fade-in slide-up duration-500">
            <div className={cn(
              "rounded-2xl overflow-hidden border-2 shadow-apple-lg",
              birdResult.detected ? "border-primary/40 bg-green-wash" : "border-muted bg-muted/30"
            )}>
              {/* Thumbnail */}
              {birdResult.thumbnail && (
                <img src={`data:image/jpeg;base64,${birdResult.thumbnail}`} alt="Detection" className="w-full h-48 object-cover" />
              )}
              {previewImage && !birdResult.thumbnail && (
                <img src={previewImage} alt="Scanned" className="w-full h-48 object-cover" />
              )}

              <div className="p-5 space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    birdResult.detected ? "bg-primary text-white shadow-green" : "bg-muted text-muted-foreground"
                  )}>
                    <Bird size={22} />
                  </div>
                  <div>
                    <p className="text-[17px] font-bold text-foreground">
                      {birdResult.detected ? "Bird Detected!" : "No Bird Found"}
                    </p>
                    {birdResult.detected && (
                      <p className="text-[13px] text-primary font-semibold">{birdResult.confidence}% confidence</p>
                    )}
                  </div>
                </div>

                <p className="text-[14px] text-muted-foreground">{birdResult.message}</p>

                {/* Confidence bar */}
                {birdResult.detected && (
                  <div>
                    <div className="flex justify-between text-[12px] text-muted-foreground mb-1">
                      <span>Detection confidence</span>
                      <span className="font-bold text-primary">{birdResult.confidence}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${birdResult.confidence}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={resetAnalysis} variant="outline" className="w-full mt-4 rounded-xl h-12">
              <RotateCcw className="mr-2 h-4 w-4" /> Scan Another
            </Button>
          </div>
        )}

        {state === "result" && analysisResult && (
          <div className="animate-in fade-in sli-up duration-700">
            {previewImage && (
              <div className="w-full bg-black/5 border-b border-border/50 p-6 flex flex-col items-center">
                <div className="relative group w-full max-w-[280px] aspect-square rounded-apple-xl overflow-hidden border-2 border-primary shadow-green mb-4">
                  <img
                    src={previewImage}
                    alt="Analysis Result"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-md px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5 shadow-apple-sm text-primary-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {analysisResult.crop_identified || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                <div className="bg-background/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-apple-sm">
                  <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <img src="/logo.svg" alt="AI Analyzed" className="w-3.5 h-3.5" />
                    AI Analyzed Image
                  </div>
                </div>
              </div>
            )}

            {analysisResult && (
              <div className="p-5 space-y-6 relative z-10">
                {/* Status Banner */}
                <div className={cn(
                  "p-4 rounded-apple-lg flex items-center gap-3 shadow-apple",
                  (analysisResult.disease_name.toLowerCase().includes('healthy') || analysisResult.severity === 'low' || analysisResult.is_healthy)
                    ? "bg-green-wash border border-primary/20"
                    : "bg-destructive/10 border border-destructive/20"
                )}>
                  {(analysisResult.disease_name.toLowerCase().includes('healthy') || analysisResult.severity === 'low' || analysisResult.is_healthy) ? (
                    <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      "text-headline font-black tracking-tight",
                      (analysisResult.disease_name.toLowerCase().includes('healthy') || analysisResult.severity === 'low' || analysisResult.is_healthy) ? "text-primary" : "text-destructive"
                    )}>
                      {(analysisResult.disease_name.toLowerCase().includes('healthy') || analysisResult.severity === 'low' || analysisResult.is_healthy) ? t.healthy : t.diseaseDetected}
                    </p>
                    <p className="text-subhead font-bold text-muted-foreground">
                      {getContent('disease_name') as string}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        speakAdvice();
                      }}
                      className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-primary/80 hover:text-primary transition-colors"
                    >
                      <Volume2 size={12} className="fill-current" />
                      {t.hearAdvice || (language === 'hi' ? "सलाह सुनें" : "Listen")}
                    </button>

                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSaved}
                    onClick={() => saveToLibrary()}
                    className={cn("rounded-full h-10 w-10 shrink-0", isSaved && "text-primary")}
                  >
                    <BookmarkPlus className={cn("w-5 h-5", isSaved && "fill-current")} />
                  </Button>
                </div>

                {/* Confidence & Severity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-muted/40 rounded-apple-lg border border-border text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{t.confidence}</p>
                    <p className="text-title font-black text-foreground">{analysisResult.confidence}%</p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-apple-lg border text-center shadow-sm",
                    analysisResult.severity === 'high'
                      ? "bg-destructive/5 border-destructive/20"
                      : "bg-green-wash border-primary/20"
                  )}>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{t.severity}</p>
                    <p className={cn(
                      "text-title font-black",
                      analysisResult.severity === 'high' ? "text-destructive" : "text-primary"
                    )}>
                      {analysisResult.severity === 'high' ? t.high : (analysisResult.severity === 'medium' ? t.medium : t.low)}
                    </p>
                  </div>
                </div>

                {/* 3. How it was formed (Description) */}
                <div className="space-y-3 pb-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                    {getSectionTitle("How it was formed")}
                  </p>
                  <div className="p-5 bg-muted/30 rounded-apple-lg border border-border">
                    <p className="text-subhead text-muted-foreground leading-relaxed">
                      {getContent('description') as string}
                    </p>
                  </div>
                </div>

                {/* Symptoms (Separate Cards) */}
                {analysisResult.symptoms && analysisResult.symptoms.length > 0 && (
                  <div className="space-y-3 pb-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                      {t.symptoms}
                    </p>
                    <div className="space-y-2.5">
                      {(getContent('symptoms') as string[]).map((s, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-background rounded-apple border border-border shadow-sm">
                          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-caption font-black text-primary flex-shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-subhead font-medium text-foreground/80">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. How we can recover (Treatment Steps) */}
                {analysisResult.treatment_steps && analysisResult.treatment_steps.length > 0 && (
                  <div className="space-y-3 pb-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                      {getSectionTitle("Treatment Plan")}
                    </p>
                    <div className="bg-slate-900 p-6 rounded-apple-xl space-y-5 shadow-xl">
                      {(getContent('treatment_steps') as string[]).map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-caption font-black text-primary-foreground flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-subhead text-slate-200 leading-relaxed font-medium">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Organic Options */}
                {analysisResult.organic_options && analysisResult.organic_options.length > 0 && (
                  <div className="space-y-3 pb-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                      {t.organic}
                    </p>
                    <div className="p-4 bg-green-wash rounded-apple-lg border border-primary/20 space-y-3 shadow-sm">
                      {(getContent('organic_options') as string[]).map((opt, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-subhead text-foreground font-medium">{opt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. How we can prevent (Prevention Tips) */}
                {analysisResult.prevention_tips && analysisResult.prevention_tips.length > 0 && (
                  <div className="space-y-3 pb-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">
                      {getSectionTitle("Prevention Tips")}
                    </p>
                    <div className="p-4 bg-muted/30 rounded-apple-lg border border-border space-y-3">
                      {(getContent('prevention_tips') as string[]).map((tip, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                          <p className="text-subhead text-muted-foreground leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Products Affiliate Feature */}
                {!analysisResult.is_healthy && analysisResult.severity !== 'low' && (
                  <section className="space-y-4 pt-4 border-t border-border/40 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={18} className="text-primary" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Recommended Products</h4>
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-sm">AgroStore Affiliate</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {getRecommendations(getContent('disease_name') as string, getContent('symptoms') as string[] || []).map(product => (
                        <div key={product.id} className="flex gap-4 p-4 rounded-3xl border border-primary/20 bg-primary/5 shadow-apple-sm hover:shadow-apple-md transition-all active:scale-[0.98]">
                          <div className="w-20 h-20 rounded-2xl bg-primary/10 overflow-hidden shrink-0 border border-primary/20 shadow-sm flex items-center justify-center p-2">
                            <img
                              src={product.image}
                              className="w-full h-full object-contain"
                              alt={product.name}
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                const parent = el.parentElement;
                                if (parent && !parent.querySelector('.img-fallback')) {
                                  const icon = document.createElement('span');
                                  icon.className = 'img-fallback text-2xl';
                                  icon.textContent = '🌿';
                                  parent.appendChild(icon);
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-col justify-between flex-1">
                            <div>
                              <p className="text-[10px] font-black uppercase text-primary tracking-wider">{product.brand}</p>
                              <h5 className="text-subhead font-bold text-foreground leading-tight line-clamp-2">{product.name}</h5>
                              <p className="text-body font-black text-foreground mt-1">₹{product.price}</p>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button 
                                onClick={() => window.open(`https://wa.me/919999999999?text=I want to order ${product.name} for my affected ${analysisResult.crop_identified}`, '_blank')} 
                                className="flex-1 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-[11px] font-black uppercase tracking-wide py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all shadow-green-sm"
                              >
                                Buy Now
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  {language !== "en" && !isTranslated && (
                    <Button
                      variant="outline"
                      className="flex-1 h-12 rounded-apple border-2 gap-2 active:scale-[0.98]"
                      onClick={handleTranslate}
                      disabled={isTranslating}
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {language === "hi" ? "अनु" : "..."}
                        </>
                      ) : (
                        <>
                          <Languages size={18} />
                          {language === "hi" ? "अनुवाद" : language === "ta" ? "மொழிபெயர்" : language === "te" ? "అనువాదం" : language === "mr" ? "மொழிபெயர்ப்பு" : "Translate"}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-apple border-2 gap-2 active:scale-[0.98]"
                    onClick={handleShareToChat}
                  >
                    <Share2 size={18} />
                    {tCommon.share}
                  </Button>
                  <Button
                    onClick={resetAnalysis}
                    className="flex-1 h-12 rounded-apple bg-primary hover:bg-primary/90 gap-2 active:scale-[0.98]"
                  >
                    <Camera size={18} />
                    {t.scanAnother}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
