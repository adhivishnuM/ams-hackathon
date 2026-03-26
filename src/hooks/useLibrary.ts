import { useState, useEffect } from "react";
import { toast } from "sonner";
import { dbService } from '@/services/db';

export interface LibraryItem {
    id: string;
    diseaseName: string;
    diseaseNameHi: string;
    diseaseNameTa?: string;
    diseaseNameTe?: string;
    diseaseNameMr?: string;
    cropType: string;
    cropTypeHi: string;
    cropTypeTa?: string;
    cropTypeTe?: string;
    cropTypeMr?: string;
    confidence: number;
    severity: "low" | "medium" | "high";
    timestamp: string;
    thumbnail: string;
    summary: string;
    summaryHi: string;
    summaryTa?: string;
    summaryTe?: string;
    summaryMr?: string;
    description?: string;
    descriptionHi?: string;
    descriptionTa?: string;
    descriptionTe?: string;
    descriptionMr?: string;
    symptoms?: string[];
    symptomsHi?: string[];
    symptomsTa?: string[];
    symptomsTe?: string[];
    symptomsMr?: string[];
    treatment?: string[];
    treatmentHi?: string[];
    treatmentTa?: string[];
    treatmentTe?: string[];
    treatmentMr?: string[];
    synced?: boolean;
}

const BACKEND_URL = "http://localhost:3001";

export function useLibrary() {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            // 1. Always load from IndexedDB first (instant, works offline)
            const localItems = await dbService.getAll('library_items') as LibraryItem[];
            if (localItems.length > 0) {
                setItems(localItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            }

            // 2. If online, fetch from backend and MERGE (not replace)
            if (navigator.onLine) {
                try {
                    const response = await fetch(`${BACKEND_URL}/library`);
                    const data = await response.json();
                    if (data.success) {
                        const serverItems: LibraryItem[] = data.data.map((item: LibraryItem) => ({
                            ...item,
                            thumbnail: item.thumbnail?.startsWith('/') ? `${BACKEND_URL}${item.thumbnail}` : item.thumbnail,
                            synced: true
                        }));

                        // Keep local-only items (not yet synced to server)
                        const serverIds = new Set(serverItems.map(i => i.id));
                        const localOnlyItems = localItems.filter(i => !serverIds.has(i.id));

                        const merged = [...serverItems, ...localOnlyItems]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                        setItems(merged);

                        // Update IndexedDB with server items (keep local-only items as-is)
                        const db = await dbService.getDB();
                        const tx = db.transaction('library_items', 'readwrite');
                        const store = tx.objectStore('library_items');
                        for (const item of serverItems) {
                            await store.put(item);
                        }
                        await tx.done;
                    }
                } catch (e) {
                    // Backend unreachable — local items already loaded above, nothing to do
                    console.warn("Backend sync skipped (offline or unreachable):", e);
                }
            }
        } catch (e) {
            console.error("Failed to fetch library items", e);
            toast.error("Failed to load history");
        } finally {
            setIsLoading(false);
        }
    };

    const addItem = async (item: Omit<LibraryItem, "id" | "timestamp">) => {
        const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const timestamp = new Date().toISOString();
        const newItem: LibraryItem = { ...item, id, timestamp, synced: false } as LibraryItem;

        // 1. Save to IndexedDB first — instant, works offline
        try {
            await dbService.put('library_items', newItem as any);
            setItems(prev => [newItem, ...prev]);
        } catch (e) {
            console.error("IndexedDB save failed", e);
            toast.error("Failed to save locally");
            return { item: newItem, isDuplicate: false };
        }

        // 2. Try to sync to backend (best-effort, non-blocking)
        if (navigator.onLine) {
            try {
                const response = await fetch(`${BACKEND_URL}/library`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                const data = await response.json();
                if (data.success) {
                    const synced: LibraryItem = {
                        ...newItem,
                        ...data.data,
                        thumbnail: data.data.thumbnail?.startsWith('/') ? `${BACKEND_URL}${data.data.thumbnail}` : (data.data.thumbnail || newItem.thumbnail),
                        synced: true
                    };
                    await dbService.put('library_items', synced as any).catch(() => {});
                    setItems(prev => prev.map(i => i.id === id ? synced : i));
                    return { item: synced, isDuplicate: false };
                }
            } catch (e) {
                console.warn("Backend sync failed, saved locally only:", e);
            }
        }

        return { item: newItem, isDuplicate: false };
    };

    const deleteItem = async (id: string) => {
        // Remove from local IndexedDB immediately
        try {
            await dbService.delete('library_items', id);
            setItems(prev => prev.filter((i) => i.id !== id));
        } catch (e) {
            console.error("Local delete failed", e);
        }

        // Try to remove from backend too
        if (navigator.onLine) {
            try {
                const response = await fetch(`${BACKEND_URL}/library/${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (!data.success) {
                    console.warn("Backend delete failed for", id);
                }
            } catch (e) {
                console.warn("Backend delete skipped (offline):", e);
            }
        }

        return true;
    };

    const updateItem = async (id: string, updates: Partial<LibraryItem>) => {
        // Update locally first
        try {
            const existing = await dbService.get('library_items', id) as LibraryItem | undefined;
            if (existing) {
                await dbService.put('library_items', { ...existing, ...updates } as any);
                setItems(prev => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
            }
        } catch (e) {
            console.error("Local update failed", e);
        }

        // Sync to backend
        if (navigator.onLine) {
            try {
                const response = await fetch(`${BACKEND_URL}/library/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });
                const data = await response.json();
                return data.success;
            } catch (e) {
                console.warn("Backend update skipped (offline):", e);
            }
        }

        return true;
    };

    return {
        items,
        isLoading,
        addItem,
        deleteItem,
        updateItem,
        refresh: fetchItems
    };
}
