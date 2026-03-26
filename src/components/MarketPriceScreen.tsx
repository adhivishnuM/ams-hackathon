import React, { useState, useEffect } from 'react';
import { Search, MapPin, TrendingUp, Calendar, ArrowRight, RefreshCw, ShoppingBag, Brain, Loader2, ChevronDown, ChevronUp, X, Filter, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { getTranslation } from '@/lib/translations';
import { useApp } from '@/contexts/AppContext';
import { getNvidiaTts } from '@/lib/apiClient';
import { mandiService, type MandiPriceRecord } from '@/services/mandiService';
import { useOrders } from '@/hooks/useOrders';
import { storeProducts, type StoreProduct } from '@/data/storeProducts';
import { toast } from 'sonner';
import { Store, ShoppingCart, Sprout, FlaskConical, Zap, Wrench, Truck } from 'lucide-react';

const ProductImage = ({ product, className }: { product: StoreProduct, className: string }) => {
    const [error, setError] = useState(false);

    if (error) {
        const icons: Record<string, any> = {
            'Seeds': <Sprout className="w-12 h-12 text-emerald-500" />,
            'Fertilizers': <FlaskConical className="w-12 h-12 text-blue-500" />,
            'Pesticides': <Zap className="w-12 h-12 text-orange-500" />,
            'Farming Tools': <Wrench className="w-12 h-12 text-slate-500" />,
            'Machinery': <Truck className="w-12 h-12 text-indigo-500" />,
        };
        const colors: Record<string, string> = {
            'Seeds': 'bg-emerald-50',
            'Fertilizers': 'bg-blue-50',
            'Pesticides': 'bg-orange-50',
            'Farming Tools': 'bg-slate-50',
            'Machinery': 'bg-indigo-50',
        };

        return (
            <div className={cn("w-full h-full flex items-center justify-center", colors[product.category] || 'bg-muted', className)}>
                {icons[product.category] || <ShoppingBag className="w-12 h-12 text-muted-foreground" />}
            </div>
        );
    }

    return (
        <img 
            src={product.image} 
            className={cn("h-full object-contain group-hover:scale-110 transition-transform duration-500", className)} 
            alt={product.name}
            onError={() => setError(true)}
        />
    );
};

interface MarketPriceScreenProps {
    language: string;
    isOnline: boolean;
    onShareChat?: (record: MandiPriceRecord) => void;
}

export const MarketPriceScreen: React.FC<MarketPriceScreenProps> = ({ language, isOnline, onShareChat }) => {
    const [prices, setPrices] = useState<MandiPriceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Deep Search State
    const [originalPrices, setOriginalPrices] = useState<MandiPriceRecord[]>([]);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);

    // AI Analysis State
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analyses, setAnalyses] = useState<Record<string, string>>({});
    const [expandedAnalyses, setExpandedAnalyses] = useState<Record<string, boolean>>({});
    const [loadingAnalyses, setLoadingAnalyses] = useState<Record<string, boolean>>({});
    const [analysisStatus, setAnalysisStatus] = useState<Record<string, string>>({});

    // Pagination State
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 20;

    // Filtering State
    const [selectedState, setSelectedState] = useState<string>('all');
    const [maxPrice, setMaxPrice] = useState<number>(0);
    const [showFilters, setShowFilters] = useState(false);

    // Agro Store State
    const [activeTab, setActiveTab] = useState<'mandi' | 'store'>('mandi');
    const [storeSearch, setStoreSearch] = useState('');
    const [activeStoreCategory, setActiveStoreCategory] = useState('All');
    const { addOrder } = useOrders();
    const { setIsChatMode, setTextInput, setChatMessages } = useApp();

    const t = getTranslation('market', language);

    // Robust Data Normalization
    const normalizeRecord = (record: MandiPriceRecord): MandiPriceRecord => {
        const toTitleCase = (val: any) => {
            if (!val) return '';
            return String(val).trim()
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        };

        const cleanWhitespace = (val: any) => {
            if (val === null || val === undefined) return '';
            return String(val).replace(/\s+/g, ' ').trim();
        };

        return {
            ...record,
            commodity: toTitleCase(cleanWhitespace(record.commodity)),
            market: toTitleCase(cleanWhitespace(record.market)),
            district: toTitleCase(cleanWhitespace(record.district)),
            state: toTitleCase(cleanWhitespace(record.state)),
            variety: cleanWhitespace(record.variety),
            min_price: cleanWhitespace(record.min_price),
            max_price: cleanWhitespace(record.max_price),
            modal_price: cleanWhitespace(record.modal_price)
        };
    };

    const loadPrices = async (isRefresh = false, isLoadMore = false) => {
        try {
            if (isRefresh) {
                setIsRefreshing(true);
                setOffset(0);
            } else if (isLoadMore) {
                // No separate loader
            } else {
                setLoading(true);
            }

            const currentOffset = isRefresh ? 0 : (isLoadMore ? offset + itemsPerPage : 0);
            const fetchFilters: any = {};
            if (selectedState !== 'all') fetchFilters.state = selectedState;
            // If we have a searchQuery and it's a "Deep Search" trigger, it might already be handled by the effect,
            // but for standard loadMore when a search is active, we should include it.
            if (searchQuery.trim()) fetchFilters.q = searchQuery;

            const data = await mandiService.fetchPrices(itemsPerPage, currentOffset, fetchFilters);

            const normalizedRecords = (data.records || []).map(normalizeRecord);

            if (isLoadMore) {
                // Compute deduplication eagerly so we know how many new records were actually added
                const existingKeys = new Set(prices.map(p => `${p.market}-${p.commodity}-${p.variety}`));
                const newRecords = normalizedRecords.filter(p => !existingKeys.has(`${p.market}-${p.commodity}-${p.variety}`));
                setPrices(prev => [...prev, ...newRecords]);
                setOriginalPrices(prev => [...prev, ...newRecords]);
                setOffset(currentOffset);
                // If API returned a full page but 0 were actually new, we've reached the end
                setHasMore(newRecords.length > 0 && normalizedRecords.length === itemsPerPage);
            } else {
                setPrices(normalizedRecords);
                setOriginalPrices(normalizedRecords);
                setOffset(0);
                setHasMore(normalizedRecords.length === itemsPerPage);
            }
            setError(null);
        } catch (err) {
            console.error("Load prices failed", err);
            setError(t.error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadPrices(true);
    }, [selectedState]);

    // Deep Search Logic (Debounced)
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!searchQuery.trim()) {
                if (prices.length !== originalPrices.length) {
                    setPrices(originalPrices);
                }
                return;
            }

            // 1. Check local matches
            const query = searchQuery.toLowerCase();
            const localMatches = originalPrices.filter(p =>
                p.commodity.toLowerCase().includes(query) ||
                p.market.toLowerCase().includes(query) ||
                p.district.toLowerCase().includes(query) ||
                p.state.toLowerCase().includes(query)
            );

            // 2. If locally found more than 3, just show those filtered results — fast path
            if (localMatches.length > 3) {
                setPrices(localMatches);
                return;
            }

            // 3. Otherwise, search via API
            setIsSearchingOnline(true);
            try {
                // State name alias map — handles common concatenated/abbreviated forms
                const STATE_ALIASES: Record<string, string> = {
                    'tamilnadu': 'Tamil Nadu', 'tn': 'Tamil Nadu', 'tamilnad': 'Tamil Nadu',
                    'maharashtra': 'Maharashtra', 'maha': 'Maharashtra',
                    'andhra': 'Andhra Pradesh', 'andhrapradesh': 'Andhra Pradesh', 'ap': 'Andhra Pradesh',
                    'telangana': 'Telangana', 'ts': 'Telangana',
                    'karnataka': 'Karnataka', 'kk': 'Karnataka',
                    'kerala': 'Kerala', 'kl': 'Kerala',
                    'gujarat': 'Gujarat', 'gj': 'Gujarat',
                    'rajasthan': 'Rajasthan', 'rj': 'Rajasthan',
                    'uttarpradesh': 'Uttar Pradesh', 'up': 'Uttar Pradesh',
                    'madhyapradesh': 'Madhya Pradesh', 'mp': 'Madhya Pradesh',
                    'westbengal': 'West Bengal', 'wb': 'West Bengal',
                    'punjab': 'Punjab', 'pb': 'Punjab',
                    'haryana': 'Haryana', 'hr': 'Haryana',
                    'himachalpradesh': 'Himachal Pradesh', 'hp': 'Himachal Pradesh',
                    'odisha': 'Odisha', 'orissa': 'Odisha',
                    'bihar': 'Bihar', 'jharkhand': 'Jharkhand',
                    'chhattisgarh': 'Chhattisgarh', 'assam': 'Assam',
                };

                const resolveState = (raw: string): string | null => {
                    const lower = raw.toLowerCase().replace(/\s+/g, '');
                    if (STATE_ALIASES[lower]) return STATE_ALIASES[lower];
                    const lowerSpaced = raw.toLowerCase();
                    if (STATE_ALIASES[lowerSpaced]) return STATE_ALIASES[lowerSpaced];
                    const match = states.find(s => s.toLowerCase() === raw.toLowerCase() || s.toLowerCase().replace(/\s+/g, '') === lower);
                    return match || null;
                };

                // Parse "carrot tamilnadu" or "carrot, Tamil Nadu" into commodity + optional state
                const cleanQuery = searchQuery.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                const parts = cleanQuery.split(' ');
                const commodityTerm = parts[0];

                // Use q= (broad search) as primary — avoids exact-filter empty-result cascades
                let fetchFilters: any = { q: commodityTerm };

                // Try to find a state in the remaining parts
                if (parts.length >= 2) {
                    const candidates = [
                        parts.slice(1).join(' '),
                        parts.slice(-1).join(' '),
                        parts.slice(-2).join(' '),
                    ];
                    for (const candidate of candidates) {
                        const resolved = resolveState(candidate);
                        if (resolved) {
                            fetchFilters.state = resolved;
                            break;
                        }
                    }
                }

                console.log('🔍 Deep search filters:', fetchFilters);
                const data = await mandiService.fetchPrices(50, 0, fetchFilters);
                const records = data.records || [];

                if (records.length > 0) {
                    const normalized = records.map(normalizeRecord);
                    // Only keep records that actually relate to the search term
                    const term = commodityTerm.toLowerCase();
                    const relevant = normalized.filter(p =>
                        p.commodity.toLowerCase().includes(term) ||
                        p.market.toLowerCase().includes(term) ||
                        p.district.toLowerCase().includes(term) ||
                        p.state.toLowerCase().includes(term)
                    );
                    setPrices(relevant.length > 0 ? relevant : normalized);
                } else {
                    setPrices([]);
                }
            } catch (err) {
                console.error("Deep search failed", err);
            } finally {
                setIsSearchingOnline(false);
            }

        }, 800);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, originalPrices]);

    const getAIAnalysis = async (record: MandiPriceRecord) => {
        const id = `${record.market}-${record.commodity}-${record.modal_price}`;
        if (analyses[id]) return;

        setLoadingAnalyses(prev => ({ ...prev, [id]: true }));
        setAnalysisStatus(prev => ({ ...prev, [id]: t.connectingToAI }));

        try {
            const apiUrl = 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/market/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mandiData: record, language, stream: true })
            });

            if (!response.body) throw new Error("ReadableStream not supported.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.trim().slice(6));
                            if (data.type === 'status') {
                                setAnalysisStatus(prev => ({ ...prev, [id]: data.message }));
                            } else if (data.type === 'result') {
                                setAnalyses(prev => ({ ...prev, [id]: data.analysis }));
                            } else if (data.type === 'error') {
                                setAnalysisStatus(prev => ({ ...prev, [id]: t.analysisFailed }));
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (err) {
            console.error("AI Analysis failed", err);
            setAnalysisStatus(prev => ({ ...prev, [id]: t.failedConnect }));
        } finally {
            setLoadingAnalyses(prev => ({ ...prev, [id]: false }));
            setAnalysisStatus(prev => ({ ...prev, [id]: "" }));
        }
    };

    const toggleAnalysis = (record: MandiPriceRecord) => {
        const id = `${record.market}-${record.commodity}-${record.modal_price}`;

        if (!expandedAnalyses[id] && !analyses[id]) {
            getAIAnalysis(record);
        }

        setExpandedAnalyses(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };



    const filteredPrices = prices.filter(p => {
        const searchParts = searchQuery.toLowerCase().replace(/,/g, ' ').split(' ').filter(s => s.trim());
        const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
        
        const matchesSearch = searchParts.length === 0 || searchParts.every(part => {
            const nPart = normalize(part);
            return normalize(p.commodity).includes(nPart) ||
                   normalize(p.market).includes(nPart) ||
                   normalize(p.district).includes(nPart) ||
                   normalize(p.state).includes(nPart);
        });

        const matchesState = selectedState === 'all' || p.state === selectedState;

        const price = parseInt(p.modal_price) || 0;
        const matchesPrice = maxPrice === 0 || price <= maxPrice;

        return matchesSearch && matchesState && matchesPrice;
    });

    // Extract unique states for filter from original dataset
    const states = Array.from(new Set(originalPrices.map(p => p.state))).sort();

    // Find max price for range
    const absoluteMaxPrice = Math.max(...originalPrices.map(p => parseInt(p.modal_price) || 0), 0);

    // Store Derived State
    const storeCategories = ['All', ...Array.from(new Set(storeProducts.map(p => p.category)))];
    const filteredStoreProducts = storeProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(storeSearch.toLowerCase()) || p.brand.toLowerCase().includes(storeSearch.toLowerCase());
        const matchesCat = activeStoreCategory === 'All' || p.category === activeStoreCategory;
        return matchesSearch && matchesCat;
    });

    const handleBuyProduct = (product: StoreProduct) => {
        addOrder({
            id: `ord_${Date.now()}`,
            crop: product.name,
            quantity: "1 Unit",
            location: "Home Delivery",
            price_estimate: `₹${product.price}`,
            status: "Processing Order",
            buyer_name: "AgroTalk Supply",
            timestamp: Date.now()
        });
        toast.success("Order Placed!", { description: "View in Library -> Agent Orders" });
    };

    const handleAskAI = (product: StoreProduct) => {
        setIsChatMode(true);
        setTextInput(`Tell me more about ${product.name} from ${product.brand}. How should I use it for my crops?`);
        // Force a scroll to chat or similar logic if needed, but setIsChatMode should be enough if the layout listens to it.
    };

    return (
        <div className="flex flex-col flex-1 pb-32 animate-fade-in">
            {/* Premium Header */}
            <header className="px-6 lg:px-8 pt-8 pb-6 w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-display font-black text-foreground tracking-tight mb-0.5">
                            {activeTab === 'store' ? 'Agro Store' : t.title}
                        </h1>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                            {activeTab === 'store' ? `${filteredStoreProducts.length} products available` : t.subtitle}
                        </p>
                    </div>
                    {activeTab === 'mandi' && (
                        <button
                            onClick={() => loadPrices(true)}
                            disabled={isRefreshing}
                            className={cn(
                                "w-12 h-12 rounded-2xl bg-card border border-border text-primary flex items-center justify-center transition-all active:scale-90 shadow-apple-sm hover:shadow-apple-md",
                                isRefreshing && "animate-spin"
                            )}
                        >
                            <RefreshCw size={20} />
                        </button>
                    )}
                </div>

                {/* Top Tabs */}
                <div className="flex p-1 bg-muted/40 rounded-[28px] border border-border/50 shadow-apple-sm mb-6">
                  <button
                    onClick={() => setActiveTab("mandi")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 rounded-[24px] text-body font-bold transition-all duration-300",
                      activeTab === "mandi" ? "bg-card text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <TrendingUp size={18} />
                    Live Mandi
                  </button>
                  <button
                    onClick={() => setActiveTab("store")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 rounded-[24px] text-body font-bold transition-all duration-300",
                      activeTab === "store" ? "bg-primary text-white shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Store size={18} />
                    Agro Store
                  </button>
                </div>

                {activeTab === 'mandi' && (
                  <>
                {/* Search Bar */}
                <div className="relative mb-6 group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        {isSearchingOnline ? (
                            <Loader2 className="text-primary animate-spin" size={20} />
                        ) : (
                            <Search className="text-muted-foreground transition-colors group-focus-within:text-primary" size={20} />
                        )}
                    </div>
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-16 pl-12 pr-12 rounded-2xl bg-card border border-border shadow-apple-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-body font-bold"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Filter Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all active:scale-95 font-black text-[10px] uppercase tracking-widest",
                            showFilters || selectedState !== 'all' || maxPrice !== 0
                                ? "bg-primary text-white border-primary shadow-apple-md"
                                : "bg-card border-border text-muted-foreground hover:border-primary/30 shadow-apple-sm"
                        )}
                    >
                        <Filter size={16} />
                        {t.filters}
                        {(selectedState !== 'all' || maxPrice !== 0) && (
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse ml-1" />
                        )}
                    </button>

                    {(selectedState !== 'all' || maxPrice !== 0 || searchQuery !== '') && (
                        <button
                            onClick={() => {
                                setSelectedState('all');
                                setMaxPrice(0);
                                setSearchQuery('');
                            }}
                            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all active:scale-95 shadow-apple-sm"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Expanded Filters UI */}
                {showFilters && (
                    <div className="mt-4 p-6 rounded-3xl bg-card border border-border shadow-apple-md animate-in slide-in-from-top-4 fade-in duration-300 overflow-hidden relative">

                        <div className="space-y-8 relative">
                            {/* State Filter */}
                            <div>
                                <label className="text-[10px] font-black uppercase text-primary mb-4 block tracking-[0.2em]">{t.state}</label>
                                <div className="flex flex-wrap gap-2.5">
                                    <button
                                        onClick={() => setSelectedState('all')}
                                        className={cn(
                                            "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                                            selectedState === 'all'
                                                ? "bg-primary text-white shadow-apple-sm"
                                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        {t.allRegions}
                                    </button>
                                    {states.slice(0, 8).map(state => (
                                        <button
                                            key={state}
                                            onClick={() => setSelectedState(state)}
                                            className={cn(
                                                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                                                selectedState === state
                                                    ? "bg-primary text-white shadow-apple-sm"
                                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            {state}
                                        </button>
                                    ))}
                                    {states.length > 8 && (
                                        <div className="relative group/select">
                                            <select
                                                value={states.includes(selectedState) ? selectedState : 'all'}
                                                onChange={(e) => setSelectedState(e.target.value)}
                                                className="appearance-none px-5 py-2.5 pr-8 rounded-xl text-[10px] font-black uppercase tracking-widest bg-muted/50 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-none cursor-pointer"
                                            >
                                                <option value="all">More...</option>
                                                {states.slice(8).map(state => (
                                                    <option key={state} value={state}>{state}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Price Range Filter */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-[10px] font-black uppercase text-primary block tracking-[0.2em]">{t.maxPriceRange}</label>
                                    <span className="text-xs font-black text-primary bg-primary/10 px-4 py-1.5 rounded-full ring-1 ring-primary/20">₹{maxPrice === 0 ? absoluteMaxPrice : maxPrice}</span>
                                </div>
                                <div className="px-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max={absoluteMaxPrice}
                                        step="100"
                                        value={maxPrice === 0 ? absoluteMaxPrice : maxPrice}
                                        onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between text-[10px] font-black text-muted-foreground/50 mt-3 px-1">
                                        <span>₹0</span>
                                        <span>₹{absoluteMaxPrice}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                  </>
                )}
            </header>

            {/* Main Content */}
            <main className="px-5 lg:px-8 w-full">
                {activeTab === 'mandi' ? (
                  <>
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-48 rounded-apple-lg bg-card border border-border animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="p-8 text-center bg-destructive/5 rounded-apple border border-destructive/20 text-destructive">
                        <p className="font-semibold">{error}</p>
                        <button
                            onClick={() => loadPrices()}
                            className="mt-4 px-6 py-2 bg-destructive text-destructive-foreground rounded-full text-sm font-bold"
                        >
                            {t.retry}
                        </button>
                    </div>
                ) : filteredPrices.length === 0 ? (
                    <div className="p-12 text-center bg-muted/50 rounded-apple-lg border border-dashed border-border">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-subhead text-muted-foreground font-medium">
                            {isSearchingOnline ? t.checkingGlobal : t.noData}
                        </p>
                    </div>
                ) : (
                    <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredPrices.map((record, index) => {

                            const id = `${record.market}-${record.commodity}-${record.modal_price}`;
                            const analysis = analyses[id];

                            return (
                                <div
                                    key={`${record.market}-${record.commodity}-${index}`}
                                    className="group relative bg-card rounded-[40px] border border-border shadow-apple-sm hover:shadow-apple-md transition-all duration-300 overflow-hidden"
                                >
                                    {/* Prominent Header Section with Crop Name */}
                                    <div className="p-6 bg-transparent border-b border-border/30">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                                        {(() => {
                                                            const commodity = record.commodity.toLowerCase();
                                                            const fruits = ['grape', 'apple', 'banana', 'mango', 'orange', 'papaya', 'pomegranate', 'watermelon', 'lemon', 'lime', 'pineapple', 'mousambi'];
                                                            const vegetables = ['brinjal', 'tomato', 'potato', 'onion', 'cabbage', 'cauliflower', 'carrot', 'beans', 'peas', 'ladyfinger', 'okra', 'bhindi', 'capsicum', 'cucumber', 'chilli', 'ginger', 'garlic'];
                                                            const grains = ['wheat', 'rice', 'paddy', 'maize', 'corn', 'bajra', 'jowar'];

                                                            if (fruits.some(f => commodity.includes(f))) return t.categoryFruit;
                                                            if (vegetables.some(v => commodity.includes(v))) return t.categoryVegetable;
                                                            if (grains.some(g => commodity.includes(g))) return t.categoryGrain;
                                                            return t.categoryCommodity;
                                                        })()}
                                                    </span>
                                                </div>
                                                <h3 className="text-title-lg font-black text-foreground leading-tight tracking-tight line-clamp-1 overflow-hidden">
                                                    {record.commodity}
                                                </h3>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-black shadow-apple-sm">
                                                    ₹{record.modal_price}
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground">{t.perQuintal}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 pt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary">
                                                    <MapPin size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-black text-muted-foreground leading-none mb-1">{t.market}</p>
                                                    <p className="text-caption font-bold text-foreground leading-none">{record.market}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary">
                                                    <Calendar size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-black text-muted-foreground leading-none mb-1">{t.updated}</p>
                                                    <p className="text-caption font-bold text-foreground leading-none">{record.arrival_date}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="px-6 py-5 bg-muted/20">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 rounded-2xl bg-card border border-border/50">
                                                <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">{t.priceRange}</p>
                                                <p className="text-subhead font-black tracking-tight text-foreground">
                                                    ₹{record.min_price} <span className="text-muted-foreground/30 mx-1">/</span> ₹{record.max_price}
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-card border border-border/50">
                                                <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">{t.variety}</p>
                                                <p className="text-subhead font-black tracking-tight text-foreground truncate">
                                                    {record.variety || t.faq}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <button
                                                onClick={() => toggleAnalysis(record)}
                                                className={cn(
                                                    "h-12 flex-1 rounded-2xl border flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-apple-sm",
                                                    expandedAnalyses[id]
                                                        ? "bg-secondary border-secondary text-white"
                                                        : "bg-card border-border text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                {loadingAnalyses[id] ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <img src="/logo.svg" alt="AI Analysis" className={cn("w-[18px] h-[18px]", expandedAnalyses[id] ? "brightness-0 invert" : "")} />
                                                )}
                                                <span>{getTranslation('common', language).analysis}</span>
                                            </button>

                                            <button
                                                onClick={() => onShareChat?.(record)}
                                                className="h-12 flex-1 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-apple hover:shadow-apple-md active:scale-95 transition-all"
                                            >
                                                {t.shareTitle}
                                                <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Insight Drawer (Inside Card) */}
                                    {expandedAnalyses[id] && (
                                        <div className="px-6 pb-6 bg-muted/20 animate-in slide-in-from-top-4 duration-300">
                                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Brain size={16} className="text-primary" />
                                                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">{t.aiAdvice}</span>
                                                </div>
                                                {analysis ? (
                                                    <>
                                                        <div className="prose prose-sm prose-primary max-w-none text-caption leading-relaxed text-foreground font-medium mb-4 
                                                            prose-a:text-primary prose-a:font-black prose-a:underline prose-a:underline-offset-4 prose-a:decoration-primary/30 hover:prose-a:decoration-primary
                                                            prose-strong:text-foreground prose-strong:font-black
                                                            prose-p:mb-3 last:prose-p:mb-0">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {analysis}
                                                            </ReactMarkdown>
                                                        </div>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    if (navigator.onLine) {
                                                                        const audioBlob = await getNvidiaTts(analysis, language, undefined, true);
                                                                        if (audioBlob) {
                                                                            const audioUrl = URL.createObjectURL(audioBlob);
                                                                            const audio = new Audio(audioUrl);
                                                                            audio.onended = () => URL.revokeObjectURL(audioUrl);
                                                                            await audio.play();
                                                                            return;
                                                                        }
                                                                    }
                                                                } catch (err) {
                                                                    console.warn("TTS failed", err);
                                                                }
                                                                const utterance = new SpeechSynthesisUtterance(analysis);
                                                                const langMap: Record<string, string> = { 'en': 'en-IN', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN' };
                                                                utterance.lang = langMap[language] || 'en-IN';
                                                                window.speechSynthesis.cancel();
                                                                window.speechSynthesis.speak(utterance);
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border text-[10px] font-black text-primary uppercase tracking-widest shadow-apple-sm hover:shadow-apple active:scale-95 transition-all"
                                                        >
                                                            <Volume2 size={14} />
                                                            {t.listenNow}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-3 py-2">
                                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                        <span className="text-[10px] font-bold text-muted-foreground animate-pulse">
                                                            {analysisStatus[id] || t.analyzing}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>

                        {/* Load More Button — outside grid */}
                        {hasMore && !searchQuery && (
                            <div className="py-6 flex justify-center">
                                <button
                                    onClick={() => loadPrices(false, true)}
                                    className="px-8 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                                >
                                    {t.loadMore}
                                </button>
                            </div>
                        )}

                        {!hasMore && filteredPrices.length > 0 && !searchQuery && (
                            <div className="py-6 text-center">
                                <p className="text-xs text-muted-foreground">{t.seenAllPrices}</p>
                            </div>
                        )}
                    </>
                )}
                  </>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                      {/* Store Search */}
                      <div className="relative mb-5">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                          <input
                              type="text"
                              placeholder="Search products, brands..."
                              value={storeSearch}
                              onChange={(e) => setStoreSearch(e.target.value)}
                              className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card border border-border shadow-apple-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-body font-bold"
                          />
                      </div>

                      {/* Store Categories Filter */}
                      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide -mx-5 px-5">
                          {storeCategories.map(cat => {
                              const catIcons: Record<string, any> = {
                                  'All': <ShoppingBag size={13} />, 'Fertilizers': <FlaskConical size={13} />,
                                  'Pesticides': <Zap size={13} />, 'Seeds': <Sprout size={13} />,
                                  'Farming Tools': <Wrench size={13} />, 'Machinery': <Truck size={13} />,
                              };
                              return (
                                  <button
                                      key={cat}
                                      onClick={() => setActiveStoreCategory(cat)}
                                      className={cn(
                                          "flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-[11px] font-black uppercase tracking-widest transition-all border",
                                          activeStoreCategory === cat
                                              ? "bg-primary text-white border-primary shadow-apple-sm"
                                              : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                      )}
                                  >
                                      {catIcons[cat] || <ShoppingBag size={13} />}
                                      {cat}
                                  </button>
                              );
                          })}
                      </div>

                      {/* Products — single-column cards for clarity */}
                      <div className="space-y-4 pb-8">
                          {filteredStoreProducts.map(product => (
                              <div
                                  key={product.id}
                                  className="bg-card rounded-3xl border border-border/60 shadow-apple-sm hover:shadow-apple-md transition-all duration-300 overflow-hidden group"
                              >
                                  <div className="flex gap-0">
                                      {/* Image panel */}
                                      <div className="w-36 shrink-0 bg-gradient-to-br from-white to-muted/30 flex items-center justify-center p-4 relative">
                                          <ProductImage product={product} className="w-full h-28 object-contain" />
                                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[9px] font-black uppercase tracking-widest text-primary border border-primary/10 shadow-sm">
                                              {product.brand}
                                          </div>
                                      </div>

                                      {/* Content panel */}
                                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                          {/* Top row */}
                                          <div>
                                              <div className="mb-2">
                                                  <span className={cn(
                                                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                      product.category === 'Fertilizers' ? 'bg-blue-50 text-blue-600' :
                                                      product.category === 'Pesticides' ? 'bg-orange-50 text-orange-600' :
                                                      product.category === 'Seeds' ? 'bg-emerald-50 text-emerald-600' :
                                                      product.category === 'Machinery' ? 'bg-indigo-50 text-indigo-600' :
                                                      'bg-muted text-muted-foreground'
                                                  )}>
                                                      {product.category}
                                                  </span>
                                              </div>
                                              <h3 className="text-[15px] font-bold text-foreground leading-snug mb-1.5">
                                                  {product.name}
                                              </h3>
                                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                  {product.description}
                                              </p>
                                          </div>

                                          {/* Bottom row — price + buy */}
                                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                                              <div>
                                                  <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-0.5">Price</p>
                                                  <p className="text-[22px] font-black text-foreground leading-none tracking-tight">₹{product.price}</p>
                                              </div>
                                              <button
                                                  onClick={() => handleBuyProduct(product)}
                                                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-apple-sm"
                                              >
                                                  <ShoppingCart size={14} />
                                                  Buy Now
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>

                      {filteredStoreProducts.length === 0 && (
                          <div className="text-center py-16">
                              <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                  <ShoppingCart className="w-8 h-8 text-muted-foreground/40" />
                              </div>
                              <p className="text-subhead font-bold text-foreground mb-1">No products found</p>
                              <p className="text-caption text-muted-foreground">Try a different search or category.</p>
                          </div>
                      )}
                  </div>
                )}
            </main>
        </div>
    );
};
