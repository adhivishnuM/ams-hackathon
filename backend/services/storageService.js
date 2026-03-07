const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(LIBRARY_FILE)) {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify([]));
}

/**
 * Read all library items
 */
function getLibraryItems() {
    try {
        const data = fs.readFileSync(LIBRARY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading library file:', error);
        return [];
    }
}

/**
 * Save all library items
 */
function saveLibraryItems(items) {
    try {
        fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving library file:', error);
        return false;
    }
}

/**
 * Save a base64 image to the uploads directory and return the URL path
 */
function saveImage(base64Data, id) {
    try {
        if (!base64Data || !base64Data.startsWith('data:image')) {
            return base64Data; // Return as is if not a base64 string
        }

        const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return base64Data;
        }

        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `analysis_${id}_${Date.now()}.${extension}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        fs.writeFileSync(filePath, buffer);

        // Return relative URL for frontend
        return `/uploads/${fileName}`;
    } catch (error) {
        console.error('Error saving image:', error);
        return base64Data;
    }
}

/**
 * Delete an image file
 */
function deleteImage(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;

    try {
        const fileName = imageUrl.replace('/uploads/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Error deleting image:', error);
    }
}

const CHAT_FILE = path.join(DATA_DIR, 'chat_history.json');

// Initialize chat history file
if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
}

/**
 * Read chat history
 */
function getChatHistory() {
    try {
        const data = fs.readFileSync(CHAT_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading chat history:', error);
        return [];
    }
}

/**
 * Save a chat item (Grouped by conversationId)
 */
function saveChatItem(item) {
    try {
        const history = getChatHistory();

        if (item.conversationId) {
            // Find existing conversation
            const existingIndex = history.findIndex(h => h.conversationId === item.conversationId);

            if (existingIndex !== -1) {
                // Update existing conversation
                const entry = history[existingIndex];

                // Ensure messages array exists
                if (!entry.messages) {
                    entry.messages = [
                        { query: entry.query, response: entry.response, timestamp: entry.timestamp, id: entry.id }
                    ];
                }

                // Add new turn to history
                entry.messages.push({
                    query: item.query,
                    response: item.response,
                    timestamp: item.timestamp,
                    id: item.id
                });

                // Update top-level metadata for preview list
                entry.query = item.query;
                entry.response = item.response;
                entry.timestamp = item.timestamp;
                entry.lastUpdated = new Date().toISOString();

                // Move this conversation to the top
                history.splice(existingIndex, 1);
                history.unshift(entry);

                fs.writeFileSync(CHAT_FILE, JSON.stringify(history, null, 2));
                return true;
            }
        }

        // New Conversation or No ID provided (Legacy/Analyze fallback)
        const newItem = {
            ...item,
            messages: [
                { query: item.query, response: item.response, timestamp: item.timestamp, id: item.id }
            ],
            lastUpdated: item.timestamp
        };

        history.unshift(newItem);

        // Limit number of threads/conversations
        if (history.length > 50) {
            history.length = 50;
        }

        fs.writeFileSync(CHAT_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving chat item:', error);
        return false;
    }
}

/**
 * Clear chat history
 */
function clearChatHistory() {
    try {
        fs.writeFileSync(CHAT_FILE, JSON.stringify([]));
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    getLibraryItems,
    saveLibraryItems,
    saveImage,
    deleteImage,
    getChatHistory,
    saveChatItem,
    clearChatHistory
};
