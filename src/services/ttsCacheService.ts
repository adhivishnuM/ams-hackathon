/**
 * TTS Audio Cache Service
 * 
 * Caches TTS audio responses for offline playback.
 * Uses localStorage with LRU eviction to manage storage limits.
 */

const CACHE_PREFIX = 'agro_tts_';
const MAX_CACHE_ENTRIES = 20; // Limit to ~20 audio clips (typically 50-100KB each)
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedAudio {
    audio: string; // Base64 encoded audio
    timestamp: number;
    language: string;
}

/**
 * Generate a hash key for the text
 */
function hashText(text: string): string {
    const normalized = text.toLowerCase().trim().slice(0, 100); // First 100 chars only
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${CACHE_PREFIX}${Math.abs(hash).toString(36)}`;
}

/**
 * Get all TTS cache keys
 */
function getAllCacheKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keys.push(key);
        }
    }
    return keys;
}

/**
 * Evict oldest entries if cache is full
 */
function evictOldEntries(): void {
    const keys = getAllCacheKeys();

    if (keys.length < MAX_CACHE_ENTRIES) return;

    // Parse all entries and sort by timestamp
    const entries: { key: string; timestamp: number }[] = [];

    for (const key of keys) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            entries.push({ key, timestamp: data.timestamp || 0 });
        } catch {
            // Invalid entry, mark for removal
            entries.push({ key, timestamp: 0 });
        }
    }

    // Sort by timestamp ascending (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest entries to make room (keep only MAX - 5 entries)
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES + 5);
    for (const entry of toRemove) {
        localStorage.removeItem(entry.key);
    }
}

/**
 * Clean up expired entries
 */
function cleanupExpired(): void {
    const keys = getAllCacheKeys();
    const now = Date.now();

    for (const key of keys) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '{}') as CachedAudio;
            if (now - data.timestamp > MAX_CACHE_AGE_MS) {
                localStorage.removeItem(key);
            }
        } catch {
            localStorage.removeItem(key);
        }
    }
}

export const ttsCacheService = {
    /**
     * Cache TTS audio for a given text
     */
    cacheAudio(text: string, audioBase64: string, language: string = 'en'): void {
        if (!text || !audioBase64) return;

        // Skip very short or very long audio (likely errors or too large)
        if (audioBase64.length < 1000 || audioBase64.length > 500000) return;

        try {
            // Cleanup expired first
            cleanupExpired();

            // Evict old entries if needed
            evictOldEntries();

            const key = hashText(text);
            const data: CachedAudio = {
                audio: audioBase64,
                timestamp: Date.now(),
                language
            };

            localStorage.setItem(key, JSON.stringify(data));
            console.log(`🔊 Cached TTS audio for: "${text.slice(0, 30)}..."`);
        } catch (error) {
            // localStorage might be full - evict more aggressively
            console.warn('TTS cache storage failed, clearing old entries');
            const keys = getAllCacheKeys();
            // Remove half of entries
            keys.slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k));
        }
    },

    /**
     * Get cached audio for a given text
     */
    getCachedAudio(text: string): string | null {
        if (!text) return null;

        try {
            const key = hashText(text);
            const stored = localStorage.getItem(key);

            if (!stored) return null;

            const data = JSON.parse(stored) as CachedAudio;

            // Check expiry
            if (Date.now() - data.timestamp > MAX_CACHE_AGE_MS) {
                localStorage.removeItem(key);
                return null;
            }

            console.log(`🔊 Found cached TTS audio for: "${text.slice(0, 30)}..."`);
            return data.audio;
        } catch {
            return null;
        }
    },

    /**
     * Clear all TTS cache
     */
    clearCache(): void {
        const keys = getAllCacheKeys();
        keys.forEach(key => localStorage.removeItem(key));
        console.log(`🗑️ Cleared ${keys.length} cached TTS entries`);
    },

    /**
     * Get cache statistics
     */
    getStats(): { count: number; totalSize: number } {
        const keys = getAllCacheKeys();
        let totalSize = 0;

        for (const key of keys) {
            const item = localStorage.getItem(key);
            if (item) totalSize += item.length;
        }

        return { count: keys.length, totalSize };
    }
};
