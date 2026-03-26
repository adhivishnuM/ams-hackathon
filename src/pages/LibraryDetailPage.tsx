import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Search, CheckCircle, AlertCircle, Share2, ShoppingCart, Phone, Wind, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLibrary, LibraryItem } from '@/hooks/useLibrary';
import { useApp } from '@/contexts/AppContext';
import { getTranslation } from '@/lib/translations';
import { getRecommendations } from '@/data/products';
import { Button } from '@/components/ui/button';

interface LibraryDetailViewProps {
    item: LibraryItem;
    onClose: () => void;
    language: string;
    asModal?: boolean;
}

export function LibraryDetailView({ item, onClose, language, asModal = false }: LibraryDetailViewProps) {
    const { setIsChatMode, setChatMessages, setConversationHistory } = useApp();
    const tLib = getTranslation('library', language);

    const getLocalizedField = (field: 'diseaseName' | 'cropType' | 'summary' | 'description') => {
        const langSuffix = { hi: 'Hi', ta: 'Ta', te: 'Te', mr: 'Mr' }[language] || '';
        const localizedKey = `${field}${langSuffix}` as keyof LibraryItem;
        const localizedValue = item[localizedKey] as string;
        return localizedValue || (item[field] as string) || '';
    };

    const getLocalizedArray = (field: 'symptoms' | 'treatment') => {
        const langSuffix = { hi: 'Hi', ta: 'Ta', te: 'Te', mr: 'Mr' }[language] || '';
        const localizedKey = `${field}${langSuffix}` as keyof LibraryItem;
        return (item[localizedKey] as string[] | undefined) || (item[field] as string[] | undefined);
    };

    const handleShareToChat = () => {
        setIsChatMode(true);
        const isLocal = ['hi', 'ta', 'te', 'mr'].includes(language);
        const cropName = isLocal ? (item.cropTypeHi || item.cropType) : item.cropType;
        const diseaseName = isLocal ? (item.diseaseNameHi || item.diseaseName) : item.diseaseName;
        const symptoms = getLocalizedArray('symptoms');
        const treatment = getLocalizedArray('treatment');
        const contextText = `${tLib.shareSubject}: ${cropName}\n${tLib.shareCondition}: ${diseaseName}\n${tLib.shareSymptoms}: ${symptoms?.join(", ")}\n${tLib.shareTreatment}: ${treatment?.join(", ")}`;
        setChatMessages(prev => [...prev, {
            id: `context_${Date.now()}`, role: 'assistant',
            content: `**${tLib.shareTitle}**\n\n${contextText}`,
            timestamp: new Date(), condition: item.severity
        }]);
        setConversationHistory(prev => [...prev, {
            role: 'assistant' as const,
            content: `CONTEXT: User shared a ${item.cropType} analysis showing ${item.diseaseName}. Severity: ${item.severity}.`
        }].slice(-10));
        onClose();
    };

    const diseaseName = getLocalizedField('diseaseName');
    const description = getLocalizedField('description') || getLocalizedField('summary');
    const symptoms = getLocalizedArray('symptoms');
    const treatment = getLocalizedArray('treatment');
    const recommendations = item.severity !== 'low' ? getRecommendations(diseaseName, symptoms || []) : [];

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/50 px-5 py-4 flex items-center gap-4">
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors active:scale-90"
                >
                    {asModal ? <X size={18} /> : <ArrowLeft size={18} />}
                </button>
                <div>
                    <h1 className="text-[15px] font-black text-foreground tracking-tight">AI Diagnostic</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">ID: {item.id.slice(0, 8)}</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
                {/* Image */}
                <div className="relative rounded-[28px] overflow-hidden border-2 border-border/50 aspect-video shadow-apple">
                    <img src={item.thumbnail} className="w-full h-full object-cover" alt="Diagnostic View" />
                    <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-[11px] font-black text-primary uppercase">{item.confidence}% {tLib.accuracy}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">{tLib.detectedIssue}</p>
                        <h3 className="text-[18px] font-black text-white">{diseaseName}</h3>
                    </div>
                </div>

                {/* Severity */}
                <div className={cn(
                    "p-4 rounded-[20px] flex items-center gap-4 border",
                    item.severity === "low"
                        ? "bg-primary/5 border-primary/20 text-primary"
                        : "bg-destructive/5 border-destructive/20 text-destructive"
                )}>
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0",
                        item.severity === "low" ? "bg-primary text-white" : "bg-destructive text-white"
                    )}>
                        {item.severity === "low" ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                    </div>
                    <div>
                        <p className="text-body font-black uppercase tracking-tight">
                            {item.severity === "low" ? tLib.stableCondition : tLib.criticalAttention}
                        </p>
                        <p className="text-[11px] font-bold opacity-70">{tLib.severityAssessment} {item.severity.toUpperCase()}</p>
                    </div>
                </div>

                {/* Summary */}
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Bot size={16} className="text-primary" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.summary}</h4>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-[20px] border border-border/50 text-[14px] leading-relaxed text-muted-foreground font-medium">
                        {description}
                    </div>
                </section>

                {/* Symptoms */}
                {symptoms && symptoms.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Search size={16} className="text-primary" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.symptomsDetected}</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {symptoms.map((s, i) => (
                                <div key={i} className="flex gap-3 items-start bg-card p-4 rounded-2xl border border-border/40 shadow-sm">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                                        {i + 1}
                                    </div>
                                    <p className="text-[13px] font-bold text-foreground leading-tight mt-0.5">{s}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Treatment */}
                {treatment && treatment.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Wind size={16} className="text-primary" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.expertTreatment}</h4>
                        </div>
                        <div className="bg-slate-900 rounded-[24px] p-5 space-y-4 border border-white/5">
                            {treatment.map((t, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                        <CheckCircle size={14} />
                                    </div>
                                    <p className="text-slate-300 text-[14px] font-medium leading-relaxed flex-1">{t}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recommended Products */}
                {recommendations.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={16} className="text-primary" />
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Recommended Products</h4>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-sm">Sponsored</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {recommendations.map(product => (
                                <div key={product.id} className="flex gap-4 p-4 rounded-[18px] border border-primary/20 bg-primary/5">
                                    <div className="w-16 h-16 rounded-xl bg-white overflow-hidden shrink-0 border border-border/50 flex items-center justify-center">
                                        <img src={product.image} className="w-full h-full object-contain p-1" alt={product.name} />
                                    </div>
                                    <div className="flex flex-col justify-between flex-1">
                                        <div>
                                            <p className="text-[9px] font-black uppercase text-primary tracking-wider">{product.brand}</p>
                                            <h5 className="text-[14px] font-bold text-foreground leading-tight">{product.name}</h5>
                                            <p className="text-[13px] font-black text-foreground mt-0.5">₹{product.price}</p>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => window.open(`https://wa.me/919999999999?text=I want to order ${product.name}`, '_blank')}
                                                className="flex-1 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-[11px] font-bold uppercase py-2 rounded-xl transition-all"
                                            >
                                                Buy Now
                                            </button>
                                            <button
                                                onClick={() => window.open(`tel:${product.phoneOrder}`)}
                                                className="w-10 flex items-center justify-center bg-card border border-border/60 hover:border-primary rounded-xl active:scale-95 transition-all"
                                            >
                                                <Phone size={14} className="text-primary" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10 border-t border-border/20">
                <div className="max-w-2xl mx-auto">
                    <Button
                        className="w-full h-14 rounded-[20px] bg-primary text-white font-black text-[14px] uppercase tracking-widest shadow-sm"
                        onClick={handleShareToChat}
                    >
                        <Share2 className="mr-3 h-5 w-5" />
                        {tLib.expertConsultation}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function LibraryDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { items } = useLibrary();
    const { language } = useApp();

    const item = items.find(i => i.id === id);

    if (!item) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <p className="text-muted-foreground">Scan not found</p>
                <Button onClick={() => navigate('/library')} variant="outline">Back to Library</Button>
            </div>
        );
    }

    return <LibraryDetailView item={item} onClose={() => navigate('/library')} language={language} />;
}
