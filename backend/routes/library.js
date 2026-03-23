const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /library — Fetch all items (shared via Firestore or local fallback)
 */
router.get('/', async (req, res) => {
    try {
        const items = await storageService.getLibraryItems();
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /library — Create a new item
 */
router.post('/', async (req, res) => {
    try {
        const newItemData = req.body;
        const id = uuidv4();
        const timestamp = new Date().toISOString();

        // Save image locally (served via /uploads)
        const imageUrl = storageService.saveImage(newItemData.thumbnail, id);

        const newItem = {
            ...newItemData,
            id,
            timestamp,
            thumbnail: imageUrl
        };

        const saved = await storageService.saveLibraryItem(newItem);
        if (saved) {
            console.log('✅ Library item saved:', id);
            res.status(201).json({ success: true, data: newItem });
        } else {
            throw new Error('Failed to save item');
        }
    } catch (error) {
        console.error('❌ Error creating library item:', error);
        res.status(500).json({ success: false, error: 'Failed to save item' });
    }
});

/**
 * PATCH /library/:id — Update an existing item
 */
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const items = await storageService.getLibraryItems();
        const existing = items.find(item => item.id === id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        const updated = { ...existing, ...updates };
        await storageService.saveLibraryItem(updated);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /library/:id — Remove an item
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const items = await storageService.getLibraryItems();
        const item = items.find(i => i.id === id);

        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        storageService.deleteImage(item.thumbnail);
        await storageService.deleteLibraryItem(id);

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
