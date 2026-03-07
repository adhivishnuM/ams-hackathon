import { useState, useEffect } from "react";
import { toast } from "sonner";
import { dbService } from '@/services/db';
import { syncService } from '@/services/syncService';

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
    timestamp: string; // ISO string for storage
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
            // 1. Load from DB
            const localItems = await dbService.getAll('library_items');
            if (localItems.length > 0) {
                setItems(localItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            }

            if (navigator.onLine) {
                const response = await fetch(`${BACKEND_URL}/library`);
                const data = await response.json();
                if (data.success) {
                    const itemsWithFullUrls = data.data.map((item: LibraryItem) => ({
                        ...item,
                        thumbnail: item.thumbnail.startsWith('/') ? `${BACKEND_URL}${item.thumbnail}` : item.thumbnail
                    }));
                    setItems(itemsWithFullUrls);

                    // Update Cache
                    const tx = (await dbService.getDB()).transaction('library_items', 'readwrite');
                    const store = tx.objectStore('library_items');
                    for (const item of itemsWithFullUrls) {
                        await store.put(item);
                    }
                    await tx.done;
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
        try {
            const response = await fetch(`${BACKEND_URL}/library`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const data = await response.json();
            if (data.success) {
                const newItem = {
                    ...data.data,
                    thumbnail: data.data.thumbnail.startsWith('/') ? `${BACKEND_URL}${data.data.thumbnail}` : data.data.thumbnail
                };
                setItems(prev => [newItem, ...prev]);
                return { item: newItem, isDuplicate: false };
            }
        } catch (e) {
            console.error("Failed to add library item", e);
            toast.error("Failed to save to server");
        }
        return { item: null, isDuplicate: false };
    };

    const deleteItem = async (id: string) => {
        try {
            const response = await fetch(`${BACKEND_URL}/library/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                setItems(prev => prev.filter((i) => i.id !== id));
                return true;
            }
        } catch (e) {
            console.error("Failed to delete library item", e);
            toast.error("Failed to delete from server");
        }
        return false;
    };

    const updateItem = async (id: string, updates: Partial<LibraryItem>) => {
        try {
            const response = await fetch(`${BACKEND_URL}/library/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await response.json();
            if (data.success) {
                setItems(prev => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
                return true;
            }
        } catch (e) {
            console.error("Failed to update library item", e);
            toast.error("Failed to update server");
        }
        return false;
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
