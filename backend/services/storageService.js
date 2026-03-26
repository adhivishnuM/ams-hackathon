/**
 * Storage Service — Local JSON only (Firebase removed)
 *
 * Library items and chat history live in backend/data/ as JSON files.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat_history.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure local dirs exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(LIBRARY_FILE)) fs.writeFileSync(LIBRARY_FILE, '[]');
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, '[]');

// ─── Library Items ────────────────────────────────────────────────────────────

async function getLibraryItems() {
    try { return JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')); }
    catch { return []; }
}

async function saveLibraryItem(item) {
    try {
        const items = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) items[idx] = item; else items.unshift(item);
        if (items.length > 100) items.length = 100;
        fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
        return true;
    } catch { return false; }
}

async function deleteLibraryItem(id) {
    try {
        const items = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
        const filtered = items.filter(i => i.id !== id);
        fs.writeFileSync(LIBRARY_FILE, JSON.stringify(filtered, null, 2));
        return true;
    } catch { return false; }
}

// ─── Chat History ─────────────────────────────────────────────────────────────

async function getChatHistory() {
    try { return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8')); }
    catch { return []; }
}

async function saveChatItem(item) {
    const id = item.conversationId || item.id;
    try {
        const history = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
        const idx = history.findIndex(h => h.conversationId === id);
        if (idx >= 0) {
            const entry = history[idx];
            entry.messages = entry.messages || [];
            entry.messages.push({ query: item.query, response: item.response, timestamp: item.timestamp, id: item.id });
            entry.query = item.query;
            entry.response = item.response;
            entry.timestamp = item.timestamp;
            history.splice(idx, 1);
            history.unshift(entry);
        } else {
            history.unshift({ ...item, messages: [{ query: item.query, response: item.response, timestamp: item.timestamp, id: item.id }] });
        }
        if (history.length > 50) history.length = 50;
        fs.writeFileSync(CHAT_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch { return false; }
}

async function clearChatHistory() {
    try {
        fs.writeFileSync(CHAT_FILE, '[]');
        return true;
    } catch { return false; }
}

// ─── Image Storage (local only, served via /uploads) ─────────────────────────

function saveImage(base64Data, id) {
    try {
        if (!base64Data || !base64Data.startsWith('data:image')) return base64Data;
        const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Data;
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buf = Buffer.from(matches[2], 'base64');
        const fileName = `analysis_${id}_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buf);
        return `/uploads/${fileName}`;
    } catch { return base64Data; }
}

function deleteImage(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    try {
        const filePath = path.join(UPLOADS_DIR, imageUrl.replace('/uploads/', ''));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
}

module.exports = {
    getLibraryItems,
    saveLibraryItem,
    deleteLibraryItem,
    getChatHistory,
    saveChatItem,
    clearChatHistory,
    saveImage,
    deleteImage
};
