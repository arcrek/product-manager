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

// Create new API key
router.post('/api-keys', express.json(), async (req, res) => {
    try {
        const { key, name, description } = req.body;

        if (!key || key.trim().length === 0) {
            return res.status(400).json({ error: 'API key is required' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const username = req.session?.username || 'admin';
        const result = await apiKeyService.createKey(
            key.trim(),
            name.trim(), 
            description?.trim() || '', 
            username
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

module.exports = router;

