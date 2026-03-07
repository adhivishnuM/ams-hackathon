import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AgroTalkDB extends DBSchema {
    market_data: {
        key: string;
        value: {
            id: string; // state_district_market_commodity
            state: string;
            district: string;
            market: string;
            commodity: string;
            modal_price: string;
            min_price: string;
            max_price: string;
            arrival_date: string;
            timestamp: number;
        };
        indexes: { 'by-commodity': string };
    };
    chat_history: {
        key: string;
        value: {
            id: string;
            conversationId: string;
            role: 'user' | 'assistant';
            content: string;
            timestamp: number; // Stored as timestamp for easier sorting
            type: 'text' | 'voice';
            condition?: string;
        };
        indexes: { 'by-conversation': string, 'by-timestamp': number };
    };
    library_items: {
        key: string;
        value: {
            id: string;
            diseaseName: string;
            diseaseNameHi: string;
            cropType: string;
            cropTypeHi: string;
            confidence: number;
            severity: string;
            timestamp: string;
            thumbnail: string; // Base64 or Blob URL
            summary: string;
            summaryHi: string;
            synced: boolean; // True if synced with backend
        };
        indexes: { 'by-timestamp': string };
    };
    recent_queries: {
        key: string;
        value: {
            id: string;
            query: string;
            response: string;
            timestamp: number;
            conversationId?: string;
        };
        indexes: { 'by-timestamp': number };
    };
    weather_cache: {
        key: string;
        value: {
            id: 'current';
            data: any;
            lastUpdated: number;
        };
    };
    ai_cache: {
        key: string; // hash of query
        value: {
            key: string; // Required for keyPath
            query: string;
            response: string;
            timestamp: number;
        };
    };
}

const DB_NAME = 'agrotalk-db';
const DB_VERSION = 1;

export const dbService = {
    dbPromise: null as Promise<IDBPDatabase<AgroTalkDB>> | null,

    async getDB() {
        if (!this.dbPromise) {
            this.dbPromise = openDB<AgroTalkDB>(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    // Market Data Store
                    const marketStore = db.createObjectStore('market_data', { keyPath: 'id' });
                    marketStore.createIndex('by-commodity', 'commodity');

                    // Chat History Store
                    const chatStore = db.createObjectStore('chat_history', { keyPath: 'id' });
                    chatStore.createIndex('by-conversation', 'conversationId');
                    chatStore.createIndex('by-timestamp', 'timestamp');

                    // Library Store
                    const libraryStore = db.createObjectStore('library_items', { keyPath: 'id' });
                    libraryStore.createIndex('by-timestamp', 'timestamp');

                    // Recent Queries Store
                    const queryStore = db.createObjectStore('recent_queries', { keyPath: 'id' });
                    queryStore.createIndex('by-timestamp', 'timestamp');

                    // Weather Cache Store
                    db.createObjectStore('weather_cache', { keyPath: 'id' });

                    // AI Cache Store
                    db.createObjectStore('ai_cache', { keyPath: 'key' });
                },
            });
        }
        return this.dbPromise;
    },

    // --- Generic Helpers ---

    async put<StoreName extends keyof AgroTalkDB>(storeName: StoreName, value: AgroTalkDB[StoreName]['value']) {
        const db = await this.getDB();
        return db.put(storeName, value);
    },

    async get<StoreName extends keyof AgroTalkDB>(storeName: StoreName, key: AgroTalkDB[StoreName]['key']) {
        const db = await this.getDB();
        return db.get(storeName, key);
    },

    async getAll<StoreName extends keyof AgroTalkDB>(storeName: StoreName) {
        const db = await this.getDB();
        return db.getAll(storeName);
    },

    async getAllFromIndex<StoreName extends keyof AgroTalkDB>(
        storeName: StoreName,
        indexName: keyof AgroTalkDB[StoreName]['indexes'],
        query?: IDBValidKey | IDBKeyRange
    ) {
        const db = await this.getDB();
        return db.getAllFromIndex(storeName, indexName as any, query);
    },

    async delete<StoreName extends keyof AgroTalkDB>(storeName: StoreName, key: AgroTalkDB[StoreName]['key']) {
        const db = await this.getDB();
        return db.delete(storeName, key);
    },

    async clear(storeName: keyof AgroTalkDB) {
        const db = await this.getDB();
        return db.clear(storeName);
    }
};
