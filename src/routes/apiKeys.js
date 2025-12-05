const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeys');

// Get all API keys
router.get('/api-keys', async (req, res) => {
    try {
        const keys = await apiKeyService.getAllKeys();
        const stats = await apiKeyService.getStats();
        
        res.json({ 
            keys,
            stats
        });
    } catch (error) {
        console.error('Error getting API keys:', error);
        res.status(500).json({ error: 'Failed to get API keys' });
    }
});

// Get single API key
router.get('/api-keys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const key = await apiKeyService.getKey(parseInt(id));
        
        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        res.json(key);
    } catch (error) {
        console.error('Error getting API key:', error);
        res.status(500).json({ error: 'Failed to get API key' });
    }
});

// Create new API key
router.post('/api-keys', express.json(), async (req, res) => {
    try {
        const { key, name, description, inventory_id, is_kiosk } = req.body;

        if (!key || key.trim().length === 0) {
            return res.status(400).json({ error: 'API key is required' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (is_kiosk && !inventory_id) {
            return res.status(400).json({ error: 'Inventory is required for kiosk API keys' });
        }

        const username = req.session?.username || 'admin';
        const result = await apiKeyService.createKey(
            key.trim(),
            name.trim(), 
            description?.trim() || '', 
            username,
            inventory_id ? parseInt(inventory_id) : null,
            is_kiosk || false
        );

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'API key imported successfully',
            key: result.key,
            id: result.id
        });
    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

// Update API key
router.put('/api-keys/:id', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const result = await apiKeyService.updateKey(parseInt(id), updates);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'API key updated successfully'
        });
    } catch (error) {
        console.error('Error updating API key:', error);
        res.status(500).json({ error: 'Failed to update API key' });
    }
});

// Toggle API key active status
router.patch('/api-keys/:id/toggle', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const result = await apiKeyService.toggleKey(parseInt(id), is_active);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            success: true,
            message: `API key ${is_active ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error toggling API key:', error);
        res.status(500).json({ error: 'Failed to toggle API key' });
    }
});

// Delete API key
router.delete('/api-keys/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await apiKeyService.deleteKey(parseInt(id));

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            message: 'API key deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({ error: 'Failed to delete API key' });
    }
});

// Get API key stats
router.get('/api-keys/stats', async (req, res) => {
    try {
        const stats = await apiKeyService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting API key stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get API URLs for a specific key
router.get('/api-keys/:id/urls', async (req, res) => {
    try {
        const { id } = req.params;
        const key = await apiKeyService.getKey(parseInt(id));
        
        if (!key) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Get the base URL from the request
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Generate API URLs
        const urls = {
            getStock: `${baseUrl}/input?key=${key.key}`,
            getProducts: `${baseUrl}/input?key=${key.key}&order_id=ORDER_ID&quantity=QUANTITY`,
            examples: {
                getStock: `${baseUrl}/input?key=${key.key}`,
                getOneProduct: `${baseUrl}/input?key=${key.key}&order_id=ORD123&quantity=1`,
                getFiveProducts: `${baseUrl}/input?key=${key.key}&order_id=ORD456&quantity=5`
            }
        };

        res.json({
            success: true,
            keyName: key.name,
            isKiosk: key.is_kiosk === 1,
            inventoryId: key.inventory_id,
            urls
        });
    } catch (error) {
        console.error('Error getting API URLs:', error);
        res.status(500).json({ error: 'Failed to generate API URLs' });
    }
});

module.exports = router;

