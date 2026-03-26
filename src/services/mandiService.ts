/**
 * Service for fetching real-time mandi prices from Data.gov.in
 * Routes through the Node backend proxy to avoid CORS and protect the API key.
 */

export interface MandiPriceRecord {
    state: string;
    district: string;
    market: string;
    commodity: string;
    variety: string;
    grade: string;
    arrival_date: string;
    min_price: string;
    max_price: string;
    modal_price: string;
    timestamp?: number;
}

export interface MandiApiResponse {
    records: MandiPriceRecord[];
    total: number;
    count: number;
}

import { dbService } from './db';

// Always use the Node backend proxy — API key lives server-side
const BACKEND_URL = 'http://localhost:3001';

// Mock data for offline/fallback
const MOCK_RECORDS: MandiPriceRecord[] = [
    {
        state: "Uttar Pradesh",
        district: "Agra",
        market: "Achhnera",
        commodity: "Potato",
        variety: "Desi",
        grade: "FAQ",
        arrival_date: new Date().toLocaleDateString(),
        min_price: "1500",
        max_price: "1800",
        modal_price: "1650"
    },
    {
        state: "Maharashtra",
        district: "Nashik",
        market: "Lasalgaon",
        commodity: "Onion",
        variety: "Red",
        grade: "FAQ",
        arrival_date: new Date().toLocaleDateString(),
        min_price: "2000",
        max_price: "2500",
        modal_price: "2250"
    },
    {
        state: "Punjab",
        district: "Ludhiana",
        market: "Ludhiana",
        commodity: "Wheat",
        variety: "Kalyan",
        grade: "FAQ",
        arrival_date: new Date().toLocaleDateString(),
        min_price: "2200",
        max_price: "2400",
        modal_price: "2300"
    },
    {
        state: "Karnataka",
        district: "Shimoga",
        market: "Shimoga",
        commodity: "Rice",
        variety: "Sona Masuri",
        grade: "FAQ",
        arrival_date: new Date().toLocaleDateString(),
        min_price: "3500",
        max_price: "4200",
        modal_price: "3850"
    },
    {
        state: "Gujarat",
        district: "Rajkot",
        market: "Rajkot",
        commodity: "Cotton",
        variety: "Shankar-6",
        grade: "FAQ",
        arrival_date: new Date().toLocaleDateString(),
        min_price: "6000",
        max_price: "7500",
        modal_price: "6800"
    }
];

export const mandiService = {
    fetchPrices: async (limit = 10, offset = 0, filters: { commodity?: string, state?: string, district?: string, market?: string, q?: string } = {}): Promise<MandiApiResponse> => {
        const { commodity, state, district, market, q } = filters;
        // 1. Try to fetch via backend proxy (avoids CORS + protects API key)
        try {
            if (!navigator.onLine) throw new Error("Offline");

            let url = `${BACKEND_URL}/market/prices?limit=${limit}&offset=${offset}`;
            if (commodity) url += `&commodity=${encodeURIComponent(commodity)}`;
            if (state) url += `&state=${encodeURIComponent(state)}`;
            if (district) url += `&district=${encodeURIComponent(district)}`;
            if (market) url += `&market=${encodeURIComponent(market)}`;
            if (q) url += `&q=${encodeURIComponent(q)}`;

            console.log(`📡 Fetching via backend proxy: /market/prices`);

            const response = await fetch(url);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Backend proxy error (${response.status}): ${errText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Backend returned failure');
            }

            let records: MandiPriceRecord[] = data.records || [];

            // If no exact match found with specific filters, try broader search if commodity was provided
            if (commodity && records.length === 0 && !q) {
                console.log(`🔍 No results for commodity filter, trying broader search...`);
                const qUrl = `${BACKEND_URL}/market/prices?limit=${limit}&offset=${offset}&q=${encodeURIComponent(commodity)}`;
                const qResponse = await fetch(qUrl);
                if (qResponse.ok) {
                    const qData = await qResponse.json();
                    if (qData.success && qData.records?.length > 0) {
                        records = qData.records;
                    }
                }
            }

            // Cache successful results to IndexedDB
            if (records.length > 0) {
                console.log(`💾 Caching ${records.length} market records...`);
                Promise.all(records.map(record => {
                    const id = `${record.state}_${record.district}_${record.market}_${record.commodity}`;
                    return dbService.put('market_data', {
                        id: id.replace(/\s+/g, '_').toLowerCase(),
                        ...record,
                        timestamp: Date.now()
                    });
                })).catch(err => console.error("Failed to cache market data", err));
            }

            return {
                records,
                total: data.total || records.length,
                count: data.count || records.length
            };

        } catch (error) {
            console.warn("⚠️ Backend proxy failed. Switching to Local DB...", error);

            // 2. Fallback to IndexedDB cache
            try {
                let cachedRecords: any[] = [];

                if (commodity || q || state || district) {
                    const searchStr = (commodity || q || state || district || "").toLowerCase();
                    const allData = await dbService.getAll('market_data');
                    cachedRecords = allData.filter(item =>
                        item.commodity?.toLowerCase().includes(searchStr) ||
                        item.market?.toLowerCase().includes(searchStr) ||
                        item.district?.toLowerCase().includes(searchStr) ||
                        item.state?.toLowerCase().includes(searchStr)
                    );
                } else {
                    cachedRecords = await dbService.getAll('market_data');
                }

                cachedRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                if (cachedRecords.length > 0) {
                    console.log(`✅ Loaded ${cachedRecords.length} records from Offline Cache`);
                    return {
                        records: cachedRecords,
                        total: cachedRecords.length,
                        count: cachedRecords.length
                    };
                }
            } catch (dbError) {
                console.error("❌ Failed to read from Offline DB", dbError);
            }

            // 3. Final Fallback to MOCK data
            console.warn("⚠️ No local cache found. Using Mock Data.");
            const searchStr = (commodity || q || "").toLowerCase();
            const filteredMock = searchStr
                ? MOCK_RECORDS.filter(r =>
                    r.commodity.toLowerCase().includes(searchStr) ||
                    r.state.toLowerCase().includes(searchStr) ||
                    r.district.toLowerCase().includes(searchStr)
                )
                : MOCK_RECORDS;

            return {
                records: filteredMock,
                total: filteredMock.length,
                count: filteredMock.length
            };
        }
    }
};
