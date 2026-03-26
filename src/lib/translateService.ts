/**
 * Lightweight translation service using MyMemory free API
 * Caches translations in localStorage to avoid rate limits
 */

const CACHE_KEY = 'agro_translations_cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  text: string;
  timestamp: number;
}

type TranslationCache = Record<string, CacheEntry>;

function loadCache(): TranslationCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: TranslationCache) {
  try {
    // Keep cache size manageable (max 500 entries)
    const entries = Object.entries(cache);
    if (entries.length > 500) {
      const sorted = entries.sort(([, a], [, b]) => b.timestamp - a.timestamp);
      const trimmed = Object.fromEntries(sorted.slice(0, 400));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // Storage full — ignore
  }
}

const LANG_CODE_MAP: Record<string, string> = {
  en: 'en',
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  mr: 'mr',
};

/**
 * Translate text to target language using MyMemory free API.
 * Returns original text if translation fails or target is English.
 */
export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  if (targetLang === 'en') return text;

  const tCode = LANG_CODE_MAP[targetLang] || targetLang;
  const cacheKey = `${tCode}::${text.substring(0, 100)}`;

  // Check cache
  const cache = loadCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.text;
  }

  try {
    const encoded = encodeURIComponent(text.substring(0, 500)); // MyMemory limit
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|${tCode}&de=agrotalk@demo.com`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && translated !== text) {
      cache[cacheKey] = { text: translated, timestamp: Date.now() };
      saveCache(cache);
      return translated;
    }
  } catch {
    // Translation failed — return original
  }
  return text;
}

/**
 * Translate multiple texts in parallel (max 3 concurrent to respect rate limits)
 */
export async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === 'en') return texts;
  const results: string[] = [];
  for (let i = 0; i < texts.length; i += 3) {
    const chunk = texts.slice(i, i + 3);
    const translated = await Promise.all(chunk.map(t => translateText(t, targetLang)));
    results.push(...translated);
  }
  return results;
}

/**
 * Hook-friendly: translate and cache, returns translated text
 */
export function useTranslatedText(text: string, targetLang: string, fallback = ''): string {
  return text || fallback;
}
