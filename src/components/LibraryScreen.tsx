import { useState } from "react";
import { Search, X, CheckCircle, Clock, ChevronRight, LayoutGrid, Leaf, AlertCircle, Trash2, Edit2, Share2, Bot, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useLibrary, LibraryItem } from "@/hooks/useLibrary";
import { toast } from "sonner";
import { getTranslation } from "@/lib/translations";
import { WeatherDashboard } from "./WeatherDashboard";

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

interface LibraryScreenProps {
  language: string;
  weatherData?: WeatherData | null;
  isWeatherLoading?: boolean;
  onShareChat?: (analysis: LibraryItem) => void;
}

type FilterType = "all" | "healthy" | "diseased" | "thisWeek";

export function LibraryScreen({ language, weatherData, isWeatherLoading, onShareChat }: LibraryScreenProps) {
  const { items, deleteItem, updateItem } = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisease, setEditDisease] = useState("");
  const [editCrop, setEditCrop] = useState("");

  const tLib = getTranslation('library', language);

  const getLocalizedField = (item: LibraryItem, field: 'diseaseName' | 'cropType' | 'summary' | 'description') => {
    const langSuffix = { hi: 'Hi', ta: 'Ta', te: 'Te', mr: 'Mr' }[language] || '';
    const localizedKey = `${field}${langSuffix}` as keyof LibraryItem;
    const localizedValue = item[localizedKey] as string;
    if (localizedValue) return localizedValue;

    return (item[field] as string) || '';
  };

  const getLocalizedArray = (item: LibraryItem, field: 'symptoms' | 'treatment') => {
    const langSuffix = { hi: 'Hi', ta: 'Ta', te: 'Te', mr: 'Mr' }[language] || '';
    const localizedKey = `${field}${langSuffix}` as keyof LibraryItem;
    return (item[localizedKey] as string[] | undefined) || (item[field] as string[] | undefined);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return tLib.today;
    if (days === 1) return tLib.yesterday;
    return `${days} ${tLib.days} ${tLib.ago}`;
  };

  const getFilteredItems = () => {
    return items.filter((item) => {
      const name = getLocalizedField(item, 'diseaseName').toLowerCase();
      const crop = getLocalizedField(item, 'cropType').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchSearch = name.includes(query) || crop.includes(query);

      if (activeFilter === "all") return matchSearch;
      if (activeFilter === "healthy") {
        return matchSearch && (name.includes('healthy') || name.includes('स्वस्थ') || name.includes('निरोगी') || item.severity === 'low');
      }
      if (activeFilter === "diseased") {
        return matchSearch && !(name.includes('healthy') || name.includes('स्वस्थ') || name.includes('निरोगी') || item.severity === 'low');
      }
      if (activeFilter === "thisWeek") {
        const itemDate = new Date(item.timestamp);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return matchSearch && itemDate > oneWeekAgo;
      }
      return matchSearch;
    });
  };

  const filteredItems = getFilteredItems();

  const stats = {
    total: items.length,
    diseases: items.filter(i => i.severity !== "low").length,
    healthy: items.filter(i => i.severity === "low").length,
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(tLib.confirmDelete)) {
      deleteItem(id);
      toast.success(tLib.deleted);
    }
  };

  const startEdit = (item: LibraryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(item.id);
    setEditDisease(getLocalizedField(item, 'diseaseName'));
    setEditCrop(getLocalizedField(item, 'cropType'));
  };

  const saveEdit = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const langSuffix = { hi: 'Hi', ta: 'Ta', te: 'Te', mr: 'Mr' }[language];
    if (langSuffix) {
      updateItem(id, { [`diseaseName${langSuffix}`]: editDisease, [`cropType${langSuffix}`]: editCrop });
    } else {
      updateItem(id, { diseaseName: editDisease, cropType: editCrop });
    }
    setEditingId(null);
    toast.success(tLib.updated);
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: tLib.filterAll },
    { id: "healthy", label: tLib.healthy },
    { id: "diseased", label: tLib.issues },
    { id: "thisWeek", label: tLib.filterWeek },
  ];

  return (
    <div className="flex flex-col flex-1 bg-background pb-32 animate-in fade-in duration-700">
      <header className="sticky top-0 z-40 px-5 py-4 bg-background/60 dark:bg-background/80 backdrop-blur-apple border-b border-border/50 transition-all duration-300">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-body font-bold text-foreground leading-none tracking-tight">{tLib.title}</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {stats.total} {tLib.recordsFound}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-muted/30 border border-border/50">
              <span className="text-[10px] font-black uppercase tracking-tight text-foreground">{language}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-6 space-y-8">
        <div className="animate-in slide-in-from-top-4 duration-500 delay-150">
          <WeatherDashboard
            data={weatherData as any}
            loading={isWeatherLoading || false}
            error={null}
            language={language}
            compact={true}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 animate-in fade-in duration-700 delay-300">
          <div className="p-4 bg-card rounded-[24px] border border-border/50 text-center shadow-apple-sm">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{tLib.total}</p>
            <p className="text-headline font-black text-foreground">{stats.total}</p>
          </div>
          <div className="p-4 bg-card rounded-[24px] border border-border/50 text-center shadow-apple-sm">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{tLib.issues}</p>
            <p className="text-headline font-black text-destructive">{stats.diseases}</p>
          </div>
          <div className="p-4 bg-card rounded-[24px] border border-border/50 text-center shadow-apple-sm">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{tLib.healthy}</p>
            <p className="text-headline font-black text-green-500">{stats.healthy}</p>
          </div>
        </div>

        <div className="space-y-4 animate-in fade-in duration-700 delay-450">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder={tLib.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full h-14 pl-12 pr-12 rounded-[24px] bg-card border-2 border-border/60",
                "text-body placeholder:text-muted-foreground/50",
                "focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
                "transition-all duration-300 shadow-apple-sm"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-subhead font-bold whitespace-nowrap transition-all active:scale-95",
                  activeFilter === filter.id
                    ? "bg-primary text-white border border-primary"
                    : "bg-card border border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-headline font-bold text-foreground mb-2">{tLib.emptyTitle}</h3>
            <p className="text-body text-muted-foreground max-w-[240px]">{tLib.emptySubtitle}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-700 delay-500">
            {filteredItems.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => setSelectedItem(analysis)}
                className="group relative bg-card rounded-[32px] border border-border/60 shadow-apple-sm hover:shadow-apple-lg hover:border-primary/30 transition-all duration-500 overflow-hidden cursor-pointer active:scale-[0.98]"
              >
                <div className="flex h-44 sm:h-48">
                  <div className="w-1/3 relative h-full overflow-hidden">
                    <img
                      src={analysis.thumbnail}
                      alt={getLocalizedField(analysis, 'diseaseName')}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card"></div>
                  </div>

                  <div className="w-2/3 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            analysis.severity === 'low' ? "bg-primary" : "bg-destructive"
                          )} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            {getLocalizedField(analysis, 'cropType')} • {formatTime(analysis.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => startEdit(analysis, e)}
                            className="p-1.5 rounded-lg bg-muted/40 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(analysis.id, e)}
                            className="p-1.5 rounded-lg bg-muted/40 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-headline font-black text-foreground line-clamp-1 tracking-tight mb-2">
                        {getLocalizedField(analysis, 'diseaseName')}
                      </h3>

                      <p className="text-subhead text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {getLocalizedField(analysis, 'summary').replace(/\*\*/g, '')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${analysis.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-primary uppercase">{analysis.confidence}% {tLib.accuracy}</span>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground/40 group-hover:text-primary transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={() => setSelectedItem(null)}
          />
          <div className="relative w-full max-w-lg bg-card rounded-t-[40px] border-t border-border/50 shadow-2xl animate-in slide-in-from-bottom-full duration-500 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-4 mb-2 opacity-50"></div>

            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-headline font-black text-foreground tracking-tight">AI Diagnostic</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                    ID: {selectedItem.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground border border-border/50 transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 pb-32">
              <div className="relative rounded-[32px] overflow-hidden border-2 border-border/50 aspect-video shadow-apple">
                <img src={selectedItem.thumbnail} className="w-full h-full object-cover" alt="Diagnostic View" />
                <div className="absolute top-4 right-4 glass px-4 py-2 rounded-2xl flex items-center gap-2 border border-white/20">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[12px] font-black text-primary uppercase">{selectedItem.confidence}% {tLib.accuracy}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">{tLib.detectedIssue}</p>
                  <h3 className="text-title-md font-black text-white">{getLocalizedField(selectedItem, 'diseaseName')}</h3>
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-[24px] flex items-center gap-4 border",
                selectedItem.severity === "low"
                  ? "bg-primary/5 border-primary/20 text-primary"
                  : "bg-destructive/5 border-destructive/20 text-destructive"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                  selectedItem.severity === "low" ? "bg-primary text-white" : "bg-destructive text-white"
                )}>
                  {selectedItem.severity === "low" ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <p className="text-body font-black uppercase tracking-tight">
                    {selectedItem.severity === "low" ? tLib.stableCondition : tLib.criticalAttention}
                  </p>
                  <p className="text-[11px] font-bold opacity-70">
                    {tLib.severityAssessment} {selectedItem.severity.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-primary" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.summary}</h4>
                  </div>
                  <div className="p-5 bg-muted/30 rounded-[24px] border border-border/50 text-[14px] leading-relaxed text-muted-foreground font-medium">
                    {getLocalizedField(selectedItem, 'description') || getLocalizedField(selectedItem, 'summary')}
                  </div>
                </section>

                {getLocalizedArray(selectedItem, 'symptoms') && getLocalizedArray(selectedItem, 'symptoms')!.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Search size={16} className="text-primary" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.symptomsDetected}</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {getLocalizedArray(selectedItem, 'symptoms')!.map((s, i) => (
                        <div key={i} className="flex gap-3 items-start bg-card p-4 rounded-2xl border border-border/40 shadow-apple-sm">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                            {i + 1}
                          </div>
                          <p className="text-[13px] font-bold text-foreground leading-tight mt-1">{s}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {getLocalizedArray(selectedItem, 'treatment') && getLocalizedArray(selectedItem, 'treatment')!.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Wind size={16} className="text-primary" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">{tLib.expertTreatment}</h4>
                    </div>
                    <div className="bg-slate-900 dark:bg-black rounded-[32px] p-6 space-y-4 shadow-2xl border border-white/5">
                      {getLocalizedArray(selectedItem, 'treatment')!.map((t, i) => (
                        <div key={i} className="flex gap-4 group">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <CheckCircle size={14} />
                          </div>
                          <p className="text-slate-300 text-[14px] font-medium leading-relaxed flex-1">{t}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-card via-card to-transparent pt-10 border-t border-border/20">
              <div className="flex gap-4">
                <Button
                  className="flex-1 h-16 rounded-[24px] bg-primary text-white font-black text-[14px] uppercase tracking-widest shadow-apple-md hover:scale-[1.02] active:scale-95 transition-all"
                  onClick={() => {
                    if (onShareChat && selectedItem) {
                      onShareChat(selectedItem);
                      setSelectedItem(null);
                    }
                  }}
                >
                  <Share2 className="mr-3 h-5 w-5" />
                  {tLib.expertConsultation}
                </Button>
                <Button
                  variant="ghost"
                  className="w-16 h-16 rounded-[24px] bg-muted/30 border border-border/50 text-muted-foreground"
                  onClick={() => setSelectedItem(null)}
                >
                  <ChevronRight className="rotate-90 h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
