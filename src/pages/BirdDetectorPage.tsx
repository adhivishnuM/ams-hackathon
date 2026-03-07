import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX, Bird, Activity, Camera, Search, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTranslation } from '@/lib/translations';

type Mode = 'bird' | 'plant';
type SubMode = 'camera' | 'search';

interface Alert {
    id: string;
    timestamp: string;
    thumbnail: string;
    details: string;
    confidence: number;
    type?: 'bird' | 'plant';
}

export default function BirdDetectorPage() {
    const { language } = useApp();
    const [mode, setMode] = useState<Mode>('bird');
    const [subMode, setSubMode] = useState<SubMode>('camera');
    const [isMuted, setIsMuted] = useState(false);
    const [status, setStatus] = useState<'safe' | 'detected'>('safe');
    const [lastDetected, setLastDetected] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const tBird = getTranslation('bird', language);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setVideoFile(file);
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('http://localhost:8000/api/bird/upload', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
            setIsConnected(true);
        } catch (error) {
            console.error('Upload error:', error);
            setVideoFile(null);
            alert('Failed to upload video. Make sure the backend is running.');
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/bird/health`);
                if (res.ok) setIsConnected(true);
            } catch (e) {
                setIsConnected(false);
            }
        };
        const interval = setInterval(checkConnection, 2000);
        checkConnection();
        return () => clearInterval(interval);
    }, [mode]);

    useEffect(() => {
        if (mode !== 'bird' || !isConnected) return;
        const pollStatus = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/bird/status`);
                const data = await res.json();
                if (data.detected) {
                    setStatus('detected');
                    setLastDetected(new Date().toLocaleTimeString());
                    const isNewEvent = status !== 'detected';
                    if (isNewEvent && (Date.now() - (parseInt(alerts[0]?.id) || 0) > 2000)) {
                        const thumbnailSrc = data.thumbnail
                            ? `data:image/jpeg;base64,${data.thumbnail}`
                            : "https://images.unsplash.com/photo-1552728089-57bdde30ebd1?q=80&w=200&auto=format&fit=crop";
                        setAlerts(prev => [{
                            id: Date.now().toString(),
                            timestamp: new Date().toLocaleTimeString(),
                            thumbnail: thumbnailSrc,
                            details: tBird.birdDetected,
                            confidence: data.confidence || 0.95,
                            type: 'bird' as const
                        }, ...prev].slice(0, 50));
                    }
                    if (!isMuted && data.alert_active) playBuzzer();
                } else {
                    setStatus('safe');
                }
            } catch (e) { /* Ignore poll errors */ }
        };
        const interval = setInterval(pollStatus, 500);
        return () => clearInterval(interval);
    }, [isConnected, isMuted, mode, status, alerts, tBird]);

    const playBuzzer = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const currentTime = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(2000, currentTime);
        osc1.frequency.exponentialRampToValueAtTime(4000, currentTime + 0.15);
        gain1.gain.setValueAtTime(0.4, currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.55);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(currentTime);
        osc1.stop(currentTime + 0.6);
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <header className="px-6 py-5 sticky top-0 z-50 bg-background/60 backdrop-blur-2xl border-b border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-5 max-w-2xl mx-auto w-full">
                    <Link to="/" className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90 shadow-sm">
                        <ArrowLeft size={22} className="text-foreground" />
                    </Link>
                    <div className="flex flex-col items-center">
                        <h1 className="text-2xl font-black text-foreground tracking-tight uppercase italic leading-none">
                            {mode === 'bird' ? tBird.scarecrowAI : tBird.visionPro}
                        </h1>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(118,185,0,0.5)]", isConnected ? "bg-primary animate-pulse" : "bg-destructive")} />
                            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                                {isConnected ? tBird.neuralLinkActive : tBird.searchingServer}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 shadow-sm",
                            mode === 'bird' ? "border" : "invisible opacity-0 pointer-events-none",
                            isMuted ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-primary/10 border-primary/20 text-primary"
                        )}
                        disabled={mode !== 'bird'}
                    >
                        {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                    </button>
                </div>

                <div className="flex justify-center max-w-2xl mx-auto w-full">
                    <div className="bg-muted/50 backdrop-blur-md p-1.5 rounded-[24px] flex gap-1.5 border border-white/5 shadow-inner">
                        <button
                            onClick={() => setMode('bird')}
                            className={cn(
                                "h-11 px-8 rounded-full flex items-center justify-center gap-2.5 transition-all duration-400 font-black text-[11px] uppercase tracking-[0.15em]",
                                mode === 'bird' ? "bg-white dark:bg-zinc-100 text-primary shadow-xl scale-100" : "text-muted-foreground hover:text-foreground scale-95"
                            )}
                        >
                            <Bird size={18} strokeWidth={2.5} />
                            {tBird.birdScout}
                        </button>
                        <button
                            onClick={() => setMode('plant')}
                            className={cn(
                                "h-11 px-8 rounded-full flex items-center justify-center gap-2.5 transition-all duration-400 font-black text-[11px] uppercase tracking-[0.15em]",
                                mode === 'plant' ? "bg-white dark:bg-zinc-100 text-primary shadow-xl scale-100" : "text-muted-foreground hover:text-foreground scale-95"
                            )}
                        >
                            <Camera size={18} strokeWidth={2.5} />
                            {tBird.aiScan}
                        </button>
                    </div>
                </div>

                {mode === 'plant' && (
                    <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-muted/30 p-1 rounded-full flex gap-1 scale-90">
                            <button onClick={() => setSubMode('camera')} className={cn("w-10 h-8 rounded-full flex items-center justify-center transition-all", subMode === 'camera' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                                <Camera size={16} />
                            </button>
                            <button onClick={() => setSubMode('search')} className={cn("w-10 h-8 rounded-full flex items-center justify-center transition-all", subMode === 'search' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                                <Search size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1 px-5 pt-10 pb-32 w-full max-w-[1400px] mx-auto">
                {mode === 'bird' ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[65fr_35fr] gap-10 items-start">
                        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
                            <div className={cn(
                                "rounded-[32px] overflow-hidden bg-zinc-950 aspect-video relative shadow-2xl transition-all duration-500",
                                status === 'detected' ? "ring-8 ring-red-500/20 border-4 border-red-500 shadow-red-500/30" : "border border-white/10"
                            )}>
                                {!videoFile ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-6 bg-gradient-to-br from-zinc-900 to-black">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                            <div className="relative p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl">
                                                <Upload size={48} className="text-primary/70" />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-2xl font-black text-white tracking-tight uppercase">{tBird.uploadTacticalFeed}</h3>
                                            <p className="text-sm text-zinc-500 mt-2 max-w-[280px] font-medium">{tBird.uploadDesc}</p>
                                        </div>
                                        <label className="cursor-pointer px-10 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-primary/90 transition-all active:scale-95 shadow-2xl shadow-primary/30 ring-1 ring-white/20">
                                            <span>{tBird.deployUnit}</span>
                                            <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                ) : isUploading ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-4 bg-black/80 backdrop-blur-sm">
                                        <Activity size={48} className="animate-pulse text-primary drop-shadow-[0_0_15px_rgba(118,185,0,0.5)]" />
                                        <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">{tBird.calibratingOptics}</p>
                                    </div>
                                ) : (
                                    <img
                                        src='http://localhost:8000/api/bird/feed'
                                        alt="Bird Feed"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).src = `http://localhost:8000/api/bird/feed?t=${Date.now()}`; }}
                                    />
                                )}

                                <div className="absolute top-6 left-6 flex flex-col gap-3">
                                    <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full animate-ping bg-red-500" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{tBird.liveStream}</span>
                                    </div>
                                    {status === 'detected' && (
                                        <div className="px-3 py-1.5 rounded-xl bg-red-500 text-white border border-red-400 flex items-center gap-3 shadow-lg animate-bounce">
                                            <Bird size={14} className="animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tBird.targetSpotted}</span>
                                        </div>
                                    )}
                                </div>

                                {videoFile && !isUploading && (
                                    <button
                                        onClick={async () => {
                                            try { await fetch('http://localhost:8000/api/bird/reset', { method: 'POST' }); } catch (e) { }
                                            setVideoFile(null); setIsConnected(false); setStatus('safe'); setAlerts([]);
                                        }}
                                        className="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-black/60 text-white/70 hover:text-white hover:bg-black/80 border border-white/10 backdrop-blur-xl transition-all flex items-center justify-center z-10 shadow-xl"
                                    >
                                        <X size={24} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="h-[calc(100vh-280px)] xl:sticky xl:top-36 min-h-[500px] animate-in fade-in slide-in-from-right-4 duration-700 delay-200 fill-mode-both">
                            <div className="glass-card rounded-[32px] border border-white/10 shadow-2xl overflow-hidden h-full flex flex-col">
                                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5 flex-shrink-0">
                                    <h3 className="font-black text-foreground uppercase tracking-[0.2em] text-xs flex items-center gap-3">
                                        <Activity size={18} className="text-primary" />
                                        {tBird.incursionLogs}
                                    </h3>
                                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest">
                                        {alerts.length} {tBird.events}
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 px-4 py-2">
                                    <div className="space-y-4 py-4">
                                        {alerts.length > 0 ? alerts.map((alert, idx) => (
                                            <div
                                                key={alert.id}
                                                className="flex gap-5 p-4 rounded-[24px] hover:bg-white/5 transition-all group active:scale-[0.98] border border-transparent hover:border-white/5"
                                                style={{ animationDelay: `${idx * 100}ms` }}
                                            >
                                                <div className="w-24 h-18 rounded-[18px] bg-black/20 overflow-hidden flex-shrink-0 relative shadow-lg group-hover:shadow-primary/20 transition-all border border-white/5">
                                                    <img src={alert.thumbnail} alt="Alert" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg text-white bg-red-500 shadow-sm uppercase tracking-widest">
                                                            {(alert.confidence * 100).toFixed(0)}% {tBird.conf}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/60 font-black tracking-widest uppercase">{alert.timestamp}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                                        <span className="text-sm font-black text-foreground tracking-tight uppercase italic">{alert.details}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground/40 text-sm gap-6">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 blur-2xl rounded-full" />
                                                    <div className="relative w-20 h-20 rounded-full bg-card border border-white/10 flex items-center justify-center shadow-xl">
                                                        <Search size={32} className="opacity-20 translate-x-0.5" />
                                                    </div>
                                                </div>
                                                <div className="text-center px-8">
                                                    <p className="font-black uppercase tracking-[0.2em] text-[10px] mb-2 leading-none">{tBird.intelligenceRequired}</p>
                                                    <p className="text-xs font-medium leading-relaxed max-w-[200px] mx-auto opacity-60">{tBird.uploadFeedDesc}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-2xl mx-auto py-6 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
                        <div className="glass-card rounded-[40px] border border-white/10 shadow-2xl overflow-hidden p-2">
                            <ImageAnalysis isOpen={true} onClose={() => { }} language={language} variant="inline" />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
