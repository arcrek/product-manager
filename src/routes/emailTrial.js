const express = require('express');
const router = express.Router();
const { dbAll, dbRun, dbGet } = require('../config/database');
const telegramService = require('../services/telegram');

// Delete products by list (Email Trial specific)
router.post('/email-trial/delete-by-list', express.json(), async (req, res) => {
    try {
        const { list } = req.body;
        
        if (!list || !Array.isArray(list) || list.length === 0) {
            return res.status(400).json({ error: 'List is required and must be an array' });
        }

        // Get Email Trial inventory
        const emailTrial = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Email Trial']);
        
        if (!emailTrial) {
            return res.status(404).json({ error: 'Email Trial inventory not found' });
        }

        let deletedCount = 0;
        const notFound = [];

        for (const item of list) {
            const searchTerm = item.trim();
            
            // Try exact match first
            let product = await dbGet(
                'SELECT id, product FROM products WHERE inventory_id = ? AND product = ?',
                [emailTrial.id, searchTerm]
            );

            // If not found, try partial match (email part before |)
            if (!product && searchTerm.includes('@')) {
                const emailPart = searchTerm.split('@')[0] + '@' + searchTerm.split('@')[1].split('|')[0];
                product = await dbGet(
                    'SELECT id, product FROM products WHERE inventory_id = ? AND product LIKE ?',
                    [emailTrial.id, emailPart + '%']
                );
            }

            if (product) {
                await dbRun('DELETE FROM products WHERE id = ?', [product.id]);
                deletedCount++;
            } else {
                notFound.push(searchTerm);
            }
        }

        // Send Telegram notification
        await telegramService.sendMessage(
            `🗑️ Bulk delete from Email Trial:\n` +
            `✅ Deleted: ${deletedCount}\n` +
            `❌ Not found: ${notFound.length}`
        );

        res.json({
            success: true,
            deleted: deletedCount,
            notFound: notFound.length > 0 ? notFound : undefined
        });

    } catch (error) {
        console.error('Error deleting by list:', error);
        res.status(500).json({ error: 'Failed to delete products' });
    }
});

module.exports = router;

