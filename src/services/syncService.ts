import { dbService } from './db';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Utility: Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

export const syncService = {
    // Sync all data on app launch
    async syncAll() {
        if (!navigator.onLine) {
            console.log('📴 Offline - skipping sync');
            return;
        }

        console.log('🔄 Starting background sync...');
        try {
            // Use Promise.allSettled to continue even if some fail
            const results = await Promise.allSettled([
                this.syncMarketData(),
                this.syncChatHistory(),
                this.syncLibrary(),
                this.syncRecentQueries()
            ]);

            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.warn(`⚠️ ${failed.length} sync tasks failed`);
            }
            console.log('✅ Background sync completed');
        } catch (error) {
            console.error('❌ Background sync failed:', error);
        }
    },

    async syncMarketData() {
        try {
            // Pre-fetch popular commodities for offline cache
            const commodities = ['Tomato', 'Onion', 'Potato', 'Wheat', 'Rice'];

            for (const commodity of commodities) {
                try {
                    const response = await fetchWithTimeout(
                        `${API_BASE_URL}/market/prices?commodity=${encodeURIComponent(commodity)}`,
                        {},
                        8000 // 8 second timeout per commodity
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && Array.isArray(data.data)) {
                            const db = await dbService.getDB();
                            const tx = db.transaction('market_data', 'readwrite');
                            const store = tx.objectStore('market_data');

                            for (const item of data.data.slice(0, 10)) { // Cache top 10 per commodity
                                const id = `${item.state}_${item.district}_${item.market}_${item.commodity}`.replace(/\s/g, '_');
                                await store.put({
                                    ...item,
                                    id,
                                    timestamp: Date.now()
                                });
                            }
                            await tx.done;
                        }
                    }
                } catch (e) {
                    // Silent fail per commodity - continue with others
                }
            }
            console.log('📥 Market data synced');
        } catch (error) {
            console.error('Sync Market Data error:', error);
        }
    },

    async syncChatHistory() {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/chat`, {}, 15000);
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const tx = (await dbService.getDB()).transaction('chat_history', 'readwrite');
                const store = tx.objectStore('chat_history');

                for (const item of data.data) {
                    // If it's a grouped conversation (modern format)
                    if (item.messages && Array.isArray(item.messages)) {
                        for (const msg of item.messages) {
                            await store.put({
                                id: msg.id || `${item.id}_${Date.now()}`,
                                conversationId: item.conversationId,
                                role: 'user',
                                content: msg.query,
                                timestamp: new Date(msg.timestamp).getTime(),
                                type: 'text'
                            });
                            await store.put({
                                id: `${msg.id}_response` || `${item.id}_response_${Date.now()}`,
                                conversationId: item.conversationId,
                                role: 'assistant',
                                content: msg.response,
                                timestamp: new Date(msg.timestamp).getTime() + 1000,
                                type: 'text'
                            });
                        }
                    }
                    // Legacy/Simple format
                    else {
                        await store.put({
                            id: `user_${item.id}`,
                            conversationId: item.conversationId || 'default',
                            role: 'user',
                            content: item.query,
                            timestamp: new Date(item.timestamp).getTime(),
                            type: item.type || 'text'
                        });
                        await store.put({
                            id: `assistant_${item.id}`,
                            conversationId: item.conversationId || 'default',
                            role: 'assistant',
                            content: item.response,
                            timestamp: new Date(item.timestamp).getTime() + 1000,
                            type: 'text'
                        });
                    }
                }
                await tx.done;
                console.log('📥 Chat history synced');
            }
        } catch (error) {
            console.error('Sync Chat History error:', error);
        }
    },

    async syncLibrary() {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/library`, {}, 15000);
            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const tx = (await dbService.getDB()).transaction('library_items', 'readwrite');
                const store = tx.objectStore('library_items');

                for (const item of data.data) {
                    await store.put({
                        ...item,
                        timestamp: item.timestamp,
                        synced: true
                    });
                }
                await tx.done;
                console.log('📥 Library synced');
            }
        } catch (error) {
            console.error('Sync Library error:', error);
        }
    },

    async syncRecentQueries() {
        // Recent queries are derived from chat history, no separate sync needed
    },

    // Cache AI response for offline replay
    async cacheAIResponse(queryHash: string, query: string, response: string) {
        try {
            await dbService.put('ai_cache', {
                key: queryHash,
                query,
                response,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to cache AI response:', error);
        }
    },

    // Get cached AI response
    async getCachedAIResponse(queryHash: string): Promise<string | null> {
        try {
            const cached = await dbService.get('ai_cache', queryHash);
            if (cached) {
                // Check if cache is less than 7 days old
                const weekMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - cached.timestamp < weekMs) {
                    return cached.response;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    },

    // Simple hash function for query caching
    hashQuery(query: string): string {
        const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `q_${Math.abs(hash).toString(36)}`;
    }
};
