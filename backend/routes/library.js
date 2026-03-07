const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /library
 * Fetch all items
 */
router.get('/', (req, res) => {
    const items = storageService.getLibraryItems();
    res.json({ success: true, data: items });
});

/**
 * POST /library
 * Create a new item
 */
router.post('/', (req, res) => {
    console.log('📬 Received library item to save:', req.body.diseaseName);
    try {
        const newItemData = req.body;
        const items = storageService.getLibraryItems();

        const id = uuidv4();
        const timestamp = new Date().toISOString();

        // If image is base64, save it as a file
        console.log('🖼️ Saving image for item:', id);
        const imageUrl = storageService.saveImage(newItemData.thumbnail, id);

        const newItem = {
            ...newItemData,
            id,
            timestamp,
            thumbnail: imageUrl
        };

        items.unshift(newItem);
        const saved = storageService.saveLibraryItems(items);

        if (saved) {
            console.log('✅ Item saved successfully:', id);
            res.status(201).json({ success: true, data: newItem });
        } else {
            throw new Error('storageService.saveLibraryItems returned false');
        }
    } catch (error) {
        console.error('❌ Error creating library item:', error);
        res.status(500).json({ success: false, error: 'Failed to save item' });
    }
});

/**
 * PATCH /library/:id
 * Update an existing item
 */
router.patch('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const items = storageService.getLibraryItems();

        const index = items.findIndex(item => item.id === id);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        // Update fields
        items[index] = { ...items[index], ...updates };
        storageService.saveLibraryItems(items);

        res.json({ success: true, data: items[index] });
    } catch (error) {
        console.error('Error updating library item:', error);
        res.status(500).json({ success: false, error: 'Failed to update item' });
    }
});

/**
 * DELETE /library/:id
 * Remove an item and its image
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const items = storageService.getLibraryItems();

        const index = items.findIndex(item => item.id === id);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        // Delete image file
        storageService.deleteImage(items[index].thumbnail);

        // Remove from list
        items.splice(index, 1);
        storageService.saveLibraryItems(items);

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting library item:', error);
        res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
});

module.exports = router;
