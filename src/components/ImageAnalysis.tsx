import { useState, useRef, useEffect } from "react";
import { X, Camera, Upload, Volume2, VolumeX, CheckCircle, AlertCircle, Loader2, RotateCcw, BookmarkPlus, Share2, Search, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { analyzeImage, DiseaseAnalysis } from "@/lib/visionAnalysis";
import { getNvidiaTts } from "@/lib/apiClient";
import { useLibrary } from "@/hooks/useLibrary";
import { toast } from "sonner";
import { getTranslation, type SupportedLanguage } from "@/lib/translations";

type AnalysisState = "camera" | "uploading" | "analyzing" | "result";

interface ImageAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  onShareChat?: (analysis: DiseaseAnalysis) => void;
  variant?: "overlay" | "inline";
}

export function ImageAnalysis({ isOpen, onClose, language, onShareChat, variant = "overlay" }: ImageAnalysisProps) {

  const [state, setState] = useState<AnalysisState>("camera");
  const [analysisStep, setAnalysisStep] = useState<"crop" | "disease">("crop");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DiseaseAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("agrovoice_muted") === "true");
  const { addItem } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isHindi = language === "hi";
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  const t = getTranslation('image', language);
  const tCommon = getTranslation('common', language);

  const handleShareToChat = () => {
    if (analysisResult && onShareChat) {
      onShareChat(analysisResult);
      onClose();
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
    };
  }, []);

  const performAnalysis = async (file: File) => {
    setState("uploading");
    setErrorMessage("");
    setAnalysisResult(null);
    setAnalysisStep("crop");

    try {
      await new Promise(r => setTimeout(r, 400));
      setState("analyzing");

      const stepTimer = setTimeout(() => setAnalysisStep("disease"), 1200);
      // Pass language to analyzeImage
      const visionResult = await analyzeImage(file, "nvidia", language);
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

      // Auto-save logic is handled by the user explicitly or we can double check settings
      // For now, we'll let the user save manually or call saveToLibrary() here if we want auto-save default
      // But to avoid duplication with the manual button, let's just leave it manual or call the shared function
      saveToLibrary(visionResult.analysis, visionResult.processed_image);

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
        const audioBlob = await getNvidiaTts(text, language, true);
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
        ? "fixed inset-0 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300"
        : "w-full h-full relative"
    )}>
      {/* Header - Only for overlay mode */}
      {variant === "overlay" && (
        <div className="p-4 flex items-center justify-between border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full">
            <X className="w-6 h-6" />
          </Button>
          <div className="text-center">
            <h2 className="text-headline font-bold text-foreground">{t.title}</h2>
            <p className="text-caption text-muted-foreground">{t.aiPowered}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMutedChange(!isMuted)}
            className="rounded-full"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Button>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", variant === "overlay" ? "pb-20" : "")}>
        {state === "camera" && (
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
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
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
                          {language === "hi" ? "अनुवाद" : language === "ta" ? "மொழிபெயர்" : language === "te" ? "అనువాదం" : language === "mr" ? "भाषांतर" : "Translate"}
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
