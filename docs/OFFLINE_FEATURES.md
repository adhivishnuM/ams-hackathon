# Offline-First Architecture & Capabilities Documentation

This document serves as the technical reference for the Offline-First implementation in AgroTalk Assist. It details the architecture, data synchronization strategies, and the "Local Wisdom" AI engine designed to provide uninterrupted agricultural support in low-connectivity environments.

## 1. Architectural Overview

AgroTalk Assist adopts an **Offline-First** approach, prioritizing local data availability and resilience. The application is built as a Progressive Web App (PWA) with a Service Worker for asset caching and IndexedDB for persistent data storage.

### Core Principles
- **Local Data Priority**: All critical data (market prices, chat history, library items) is stored locally and served from IndexedDB first.
- **Background Synchronization**: Data is fetched from the backend and synchronized with the local database silently in the background when connectivity is available.
- **Graceful Degradation**: Features that require active internet (like real-time AI inference) failover to a lightweight, local rule-based engine ("Local Wisdom") or cached responses.
- **Response Caching**: AI responses and TTS audio are cached for replay when the same or similar queries are asked offline.

---

## 2. Progressive Web App (PWA) Implementation

The application leverages `vite-plugin-pwa` to provide a robust offline experience.

- **Service Worker**: Uses `workbox` strategies to cache static assets (JS, CSS, Images) and API responses where appropriate.
- **App Manifest**: Configured for installability on Android, iOS, and Desktop, feeling like a native application.
- **Caching Strategy**:
  - **Stale-While-Revalidate**: For dynamic data like market prices, ensuring users see cached content instantly while updates are fetched in the background.
  - **Network First**: For critical API calls where freshness is paramount, falling back to cache if the network fails.

---

## 3. Local Data Persistence (IndexedDB)

We utilize `idb` to interact with IndexedDB, providing a structured NoSQL-like storage mechanism within the browser. The database schema is defined in `src/services/db.ts`.

### Schema Design

| Store Name       | Purpose                                                    | Key Strategy |
| :---             | :---                                                       | :--- |
| `market_data`  | Stores Mandi prices fetched from Data.gov.in.              | Composite key (state_district_market_commodity) |
| `chat_history` | Persists conversation logs for context continuity.         | Append-only with Sync |
| `library_items`| Stores history of plant disease analysis and diagnoses.    | Object Store (ID -> Analysis Data) |
| `recent_queries`| Caches user search history for quick access.               | Limit 10 (FIFO) |
| `weather_cache` | Stores the last successful weather API response.           | Single Entry ('current') |
| `ai_cache`     | Stores previous AI responses for exact query matching.     | Hash(Query) -> Response |

---

## 4. Data Synchronization (syncService.ts)

The `SyncService` manages data consistency between the backend server and the local IndexedDB.

### Synchronization Flow
1.  **On App Launch (Online)**:
    -   Triggers a background fetch for `library`, `chat_history`, and `market_data`.
    -   Uses `Promise.allSettled` to continue even if some syncs fail.
    -   Updates IndexedDB with the latest data from the server.
    -   All API calls have **10-15 second timeouts** to prevent hangs.
2.  **On User Action (Create/Update)**:
    -   **Optimistic UI**: Updates the local state immediately.
    -   **Write-Through**: Saves to IndexedDB instantly.
    -   **Sync**: Attempts to push changes to the backend API.
    -   *(Future)* **Queue**: If offline, actions are queued for retry when online.
3.  **On App Launch (Offline)**:
    -   Serves all data directly from IndexedDB with zero network latency.
    -   Displays "Last Updated" timestamps where relevant (e.g., Weather, Market Prices).

### Market Data Pre-fetching
Popular commodities (Tomato, Onion, Potato, Wheat, Rice) are proactively synced on app launch, caching top 10 records per commodity for offline access.

---

## 5. "Local Wisdom" AI Engine

To maintain utility without internet, `src/lib/apiClient.ts` implements a multi-tier fallback logic called "Local Wisdom".

### Offline Query Resolution Flow

When the app detects an offline state (`!navigator.onLine` or forced offline mode):

```
A. Weather Queries     -> Check weather_cache in IndexedDB
B. Market Price Queries -> Direct user to Mandi tab with cached prices
C. Cached AI Response   -> Check ai_cache for previously asked questions
D. Local Wisdom Match   -> Fuzzy keyword search in offline_knowledge.json (2756+ entries)
E. Fallback Message     -> Localized "I'm offline" message
```

### Knowledge Base

| Source | Location | Entries | Languages |
|--------|----------|---------|-----------|
| Primary JSON | `src/data/offline_knowledge.json` | 100+ crop-specific Q&A | en, hi, ta, te, mr |
| Legacy TypeScript | `src/data/localWisdom.ts` | 6 common topics | en, hi, ta, te, mr |

### Smart Keyword Matching
Queries are scored by the number of matching keywords. For example, "tomato blight" will match the specific "Tomato Early Blight" entry rather than generic "tomato" advice.

---

## 6. Response & Audio Caching

### AI Response Cache (syncService.ts)
- **On API Success**: AI responses are hashed and stored in `ai_cache` IndexedDB store.
- **Offline Lookup**: Before using Local Wisdom, checks for cached responses to the same/similar query.
- **Expiry**: Cached responses are valid for 7 days.

### TTS Audio Cache (ttsCacheService.ts)
- **Storage**: localStorage with Base64-encoded audio.
- **Capacity**: LRU eviction at 20 entries (~1-2MB total).
- **Expiry**: 7-day TTL with automatic cleanup.
- **Offline Playback**: When offline, cached TTS audio is returned with responses.

---

## 7. User Experience Enhancements

- **Offline Banner**: A non-intrusive banner appears when the connection is lost (`src/components/OfflineBanner.tsx`).
- **Input Handling**: Voice input is disabled or clearly marked as limited in offline mode.
- **Transparency**: UI elements indicate when data is "Cached" or "Live".
- **Audio Playback**: Previously heard responses can play audio offline via TTS cache.

---

## 8. Testing & Verification

To verify the offline capabilities:

1.  **Initial Load**: Open the app with an internet connection to populate the cache and IndexedDB.
2.  **Ask Some Questions**: Query the AI about crops/diseases to populate the AI and TTS caches.
3.  **Go Offline**: Enable "Offline" mode in browser DevTools or disconnect Wi-Fi.
4.  **Verify**:
    -   Refresh the page -> App should load via Service Worker.
    -   Check Library -> Previous analyses should appear with timestamps.
    -   Ask "Weather" -> Should show cached weather data with "Last updated" time.
    -   Ask about "Tomato Blight" -> Should receive a response from Local Wisdom.
    -   Re-ask a previously asked question -> Should get cached response WITH audio playback.
