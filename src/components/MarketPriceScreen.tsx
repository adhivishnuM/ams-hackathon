import React, { useState, useEffect } from 'react';
import { Search, MapPin, TrendingUp, Calendar, ArrowRight, RefreshCw, ShoppingBag, Brain, Loader2, ChevronDown, ChevronUp, X, Filter, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { getTranslation } from '@/lib/translations';
import { getNvidiaTts } from '@/lib/apiClient';
import { mandiService, type MandiPriceRecord } from '@/services/mandiService';

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
                setPrices(prev => {
                    const existingKeys = new Set(prev.map(p => `${p.market}-${p.commodity}-${p.variety}`));
                    const newRecords = normalizedRecords.filter(p => !existingKeys.has(`${p.market}-${p.commodity}-${p.variety}`));
                    return [...prev, ...newRecords];
                });
                setOriginalPrices(prev => {
                    const existingKeys = new Set(prev.map(p => `${p.market}-${p.commodity}-${p.variety}`));
                    const newRecords = normalizedRecords.filter(p => !existingKeys.has(`${p.market}-${p.commodity}-${p.variety}`));
                    return [...prev, ...newRecords];
                });
                setOffset(currentOffset);
            } else {
                setPrices(normalizedRecords);
                setOriginalPrices(normalizedRecords);
                setOffset(0);
            }

            setHasMore(normalizedRecords.length === itemsPerPage);
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

            // 2. If locally found more than 3, just use them for now to be fast
            if (localMatches.length > 3) {
                if (prices !== originalPrices) {
                    setPrices(originalPrices);
                }
                return;
            }

            // 3. Otherwise, search the Database (API)
            setIsSearchingOnline(true);
            try {
                // Try to be smart: if it's two words, maybe it's "Crop Location"
                const parts = searchQuery.split(' ');
                let fetchFilters = { q: searchQuery };

                const data = await mandiService.fetchPrices(50, 0, { q: searchQuery });
                let records = data.records || [];

                // If q search return nothing and it's a single word, try it as a commodity filter
                if (records.length === 0 && !searchQuery.includes(' ')) {
                    const exactData = await mandiService.fetchPrices(50, 0, { commodity: searchQuery });
                    if (exactData.records && exactData.records.length > 0) {
                        records = exactData.records;
                    }
                }

                if (records.length > 0) {
                    const normalized = records.map(normalizeRecord);
                    setPrices(normalized);
                } else if (localMatches.length === 0) {
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
            const apiUrl = import.meta.env.VITE_API_URL || 'https://ams-hackathon.onrender.com';
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
        const matchesSearch = p.commodity.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.market.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.district.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesState = selectedState === 'all' || p.state === selectedState;

        const price = parseInt(p.modal_price);
        const matchesPrice = maxPrice === 0 || price <= maxPrice;

        return matchesSearch && matchesState && matchesPrice;
    });

    // Extract unique states for filter from original dataset
    const states = Array.from(new Set(originalPrices.map(p => p.state))).sort();

    // Find max price for range
    const absoluteMaxPrice = Math.max(...originalPrices.map(p => parseInt(p.modal_price) || 0), 0);

    return (
        <div className="flex flex-col flex-1 pb-32 animate-fade-in">
            {/* Premium Header */}
            <header className="px-6 pt-10 pb-6 max-w-lg mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-display font-black text-foreground tracking-tight">{t.title}</h1>
                        </div>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest opacity-70">{t.subtitle}</p>
                    </div>
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
                </div>

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
            </header>

            {/* Main Content */}
            <main className="px-5 max-w-lg mx-auto w-full">
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
                    <div className="space-y-6 pb-12">
                        {filteredPrices.map((record, index) => {
                            const id = `${record.market}-${record.commodity}-${record.modal_price}`;
                            const analysis = analyses[id];

                            return (
                                <div
                                    key={`${record.market}-${record.commodity}-${index}`}
                                    className="group relative bg-card rounded-apple-xl border border-border shadow-apple-sm hover:shadow-apple-md transition-all duration-300 overflow-hidden"
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
                                                <h3 className="text-display font-black text-foreground leading-tight tracking-tight">
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

                        {/* Load More Button */}
                        {hasMore && !searchQuery && (
                            <div className="pt-4 flex justify-center">
                                <button
                                    onClick={() => loadPrices(false, true)}
                                    className="px-12 py-5 rounded-[24px] bg-primary text-white font-black text-xs uppercase tracking-widest shadow-apple-md hover:shadow-apple-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center border border-white/20 min-w-[200px]"
                                >
                                    {t.loadMore}
                                </button>
                            </div>
                        )}

                        {!hasMore && filteredPrices.length > 0 && !searchQuery && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border">
                                    <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                                        <img src="/logo.svg" alt="AgroTalk" className="w-2.5 h-2.5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.seenAllPrices}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
