import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CheckCircle, ChevronRight, LayoutGrid, Leaf, AlertCircle, Trash2, Edit2, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibrary, LibraryItem } from "@/hooks/useLibrary";
import { LibraryDetailView } from "@/pages/LibraryDetailPage";
import { toast } from "sonner";
import { getTranslation } from "@/lib/translations";
import { useOrders } from "@/hooks/useOrders";
import { useChat } from "@/hooks/useChat";
import { useApp } from "@/contexts/AppContext";
import { PackageOpen, MapPin, IndianRupee, Clock as ClockIcon, TrendingUp } from "lucide-react";

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

interface LibraryScreenProps {
  weatherData?: WeatherData | null;
  isWeatherLoading?: boolean;
  onShareChat?: (analysis: LibraryItem) => void;
}

type FilterType = "all" | "healthy" | "diseased" | "thisWeek";

export function LibraryScreen({ weatherData, isWeatherLoading, onShareChat }: LibraryScreenProps) {
  const { items, deleteItem, updateItem } = useLibrary();
  const navigate = useNavigate();
  const { language, setIsChatMode, setChatMessages, setConversationHistory, setConversationId } = useApp();
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const { history: chatHistory, isLoading: chatLoading } = useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisease, setEditDisease] = useState("");
  const [editCrop, setEditCrop] = useState("");
  const [activeTab, setActiveTab] = useState<"scans" | "orders" | "chats">("scans");

  const { orders } = useOrders();

  const tLib = getTranslation('library', language);
  const isHindi = language === 'hi';

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

  const openChatConversation = (item: any) => {
    setIsChatMode(true);
    if (item.conversationId) setConversationId(item.conversationId);

    const messages = item.messages && Array.isArray(item.messages)
      ? item.messages.flatMap((m: any) => [
          { id: `user_${m.id}`, role: 'user' as const, content: m.query, timestamp: new Date(m.timestamp), condition: undefined },
          { id: `assistant_${m.id}`, role: 'assistant' as const, content: m.response, timestamp: new Date(new Date(m.timestamp).getTime() + 1000), condition: undefined }
        ]).filter((msg: any) => msg.content?.trim())
          .sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime())
      : [
          { id: `user_${item.id}`, role: 'user' as const, content: item.query, timestamp: new Date(item.timestamp), condition: undefined },
          { id: `assistant_${item.id}`, role: 'assistant' as const, content: item.response, timestamp: new Date(new Date(item.timestamp).getTime() + 1000), condition: undefined }
        ];

    setChatMessages(messages);
    setConversationHistory(messages.map((m: any) => ({ role: m.role, content: m.content })).slice(-10));
    navigate('/');
  };

  const formatChatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: tLib.filterAll },
    { id: "healthy", label: tLib.healthy },
    { id: "diseased", label: tLib.issues },
    { id: "thisWeek", label: tLib.filterWeek },
  ];

  return (
    <div className="flex flex-col flex-1 bg-background pb-32 animate-in fade-in duration-700">
      <header className="sticky top-0 z-40 bg-background/60 dark:bg-background/80 backdrop-blur-apple border-b border-border/50 transition-all duration-300">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-apple-sm">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-display-sm font-black text-foreground leading-tight tracking-tight">{tLib.title}</h1>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                {stats.total} {tLib.recordsFound}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-muted/30 border border-border/50 backdrop-blur-md">
              <span className="text-[11px] font-black uppercase tracking-widest text-primary">{language}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-6 lg:px-12 py-8 space-y-8">
        {/* Top Tabs */}
        <div className="max-w-2xl mx-auto flex p-1.5 bg-muted/40 rounded-[32px] border border-border/40 animate-in fade-in zoom-in-95 duration-700 delay-200 shadow-apple-sm backdrop-blur-sm">
          <button
            onClick={() => setActiveTab("scans")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-[28px] text-[15px] font-black uppercase tracking-wide transition-all duration-500",
              activeTab === "scans"
                ? "bg-white text-primary shadow-apple-md border border-border/10 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <LayoutGrid size={18} className={activeTab === "scans" ? "animate-pulse" : ""} />
            {isHindi ? "स्कैन" : "Scans"}
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-[28px] text-[15px] font-black uppercase tracking-wide transition-all duration-500",
              activeTab === "chats"
                ? "bg-white text-primary shadow-apple-md border border-border/10 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <MessageSquare size={18} className={activeTab === "chats" ? "animate-pulse" : ""} />
            {isHindi ? "चैट" : "Chats"}
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-[28px] text-[15px] font-black uppercase tracking-wide transition-all duration-500",
              activeTab === "orders"
                ? "bg-white text-primary shadow-apple-md border border-border/10 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <PackageOpen size={18} className={activeTab === "orders" ? "animate-pulse" : ""} />
            {isHindi ? "ऑर्डर" : "Orders"}
          </button>
        </div>

        {activeTab === "chats" ? (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-3">
            {chatLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Loading chats...</p>
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 text-primary/40" />
                </div>
                <h3 className="text-headline font-bold text-foreground mb-2">No Chats Yet</h3>
                <p className="text-body text-muted-foreground max-w-[240px]">Your AI conversations will appear here.</p>
              </div>
            ) : (
              chatHistory.map((item) => {
                const lastMsg = item.messages?.filter(m => m.response?.trim()).pop();
                const preview = lastMsg?.response || item.response || '';
                const query = lastMsg?.query || item.query || '';
                return (
                  <div
                    key={item.id}
                    onClick={() => openChatConversation(item)}
                    className="group bg-card rounded-[20px] border border-border/60 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm active:scale-[0.99] transition-all"
                  >
                    <div className="p-4 space-y-2">
                      {/* User bubble */}
                      <div className="flex justify-end">
                        <div className="bg-primary text-white text-[12px] font-medium px-3 py-1.5 rounded-2xl rounded-br-sm max-w-[85%] line-clamp-1">
                          {query}
                        </div>
                      </div>
                      {/* AI bubble */}
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                          <img src="/logo.svg" alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="bg-muted/50 text-muted-foreground text-[11px] px-3 py-1.5 rounded-2xl rounded-tl-sm flex-1 line-clamp-2 leading-relaxed">
                          {preview.replace(/\*\*/g, '').replace(/\*/g, '') || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Clock size={10} />
                        <span>{formatChatTime(item.timestamp)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase">
                        {item.messages?.length ?? 1} msg{(item.messages?.length ?? 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "scans" ? (
          <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-up-8 duration-700 delay-300">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/50 dark:bg-card/50 backdrop-blur-md rounded-[32px] border border-border/40 text-center shadow-apple-sm group hover:scale-[1.02] transition-all duration-500">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <Leaf className="w-6 h-6 text-primary" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{tLib.total}</p>
                <p className="text-display-sm font-black text-foreground">{stats.total}</p>
              </div>
              <div className="p-6 bg-white/50 dark:bg-card/50 backdrop-blur-md rounded-[32px] border border-border/40 text-center shadow-apple-sm group hover:scale-[1.02] transition-all duration-500">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4 border border-destructive/20 group-hover:bg-destructive/20 transition-colors">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{tLib.issues}</p>
                <p className="text-display-sm font-black text-destructive">{stats.diseases}</p>
              </div>
              <div className="p-6 bg-white/50 dark:bg-card/50 backdrop-blur-md rounded-[32px] border border-border/40 text-center shadow-apple-sm group hover:scale-[1.02] transition-all duration-500">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4 border border-green-500/20 group-hover:bg-green-500/20 transition-colors">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{tLib.healthy}</p>
                <p className="text-display-sm font-black text-green-500">{stats.healthy}</p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-6">
              <div className="relative group max-w-2xl mx-auto w-full">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder={tLib.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full h-16 pl-14 pr-14 rounded-[28px] bg-white/60 dark:bg-card/60 backdrop-blur-md border border-border/40",
                    "text-body font-medium placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:border-primary/50 focus:ring-8 focus:ring-primary/5",
                    "transition-all duration-500 shadow-apple-sm"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground transition-all hover:bg-muted/60"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-2.5">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-6 py-3 rounded-full text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300",
                      activeFilter === filter.id
                        ? "bg-primary text-white shadow-apple-md scale-[1.05]"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 animate-in fade-in duration-700 delay-500">
            {filteredItems.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => setSelectedItem(analysis)}
                className="group relative bg-card rounded-[28px] border border-border/60 shadow-apple-sm hover:shadow-apple-lg hover:border-primary/30 transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.98]"
              >
                <div className="flex h-44 sm:h-44">
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
        </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            {/* orders tab */}
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <PackageOpen className="w-10 h-10 text-primary/40" />
                </div>
                <h3 className="text-headline font-bold text-foreground mb-2">No Active Orders</h3>
                <p className="text-body text-muted-foreground max-w-[240px]">Orders placed via the Call Agent will appear here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {orders.map((order) => (
                  <div key={order.id} className="bg-card rounded-[32px] border border-border/60 shadow-apple-lg overflow-hidden relative">
                    {/* Header line */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-green-400 to-emerald-600"></div>
                    
                    <div className="p-6 space-y-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                            <TrendingUp className="w-6 h-6 text-green-500" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-0.5">Verified B2B Lead</p>
                            <h3 className="text-title-2 font-black text-foreground tracking-tight">{order.crop}</h3>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          <span className="text-[10px] font-black uppercase text-green-500 tracking-wider flex items-center gap-1">
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                            <IndianRupee size={12} className="text-primary"/> Est. Market Rate
                          </p>
                          <p className="text-subhead font-black tracking-tight text-foreground">{order.price_estimate}</p>
                        </div>
                        <div className="bg-muted/40 p-4 rounded-2xl border border-border/50">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                            <PackageOpen size={12} className="text-primary"/> Quantity Requested
                          </p>
                          <p className="text-subhead font-black tracking-tight text-foreground">{order.quantity}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-muted-foreground" />
                          <p className="text-caption font-medium text-muted-foreground">Location: <span className="font-bold text-foreground">{order.location}</span></p>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 flex items-center gap-1">
                          <ClockIcon size={12} />
                          {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Library Detail Modal — overlay on current page, sidebar stays visible */}
      {selectedItem && (
        <div className="fixed inset-0 z-[39] bg-background overflow-y-auto animate-in slide-in-from-right duration-300">
          <LibraryDetailView
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            language={language}
            asModal
          />
        </div>
      )}
    </div>
  );
}
