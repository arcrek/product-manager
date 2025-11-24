const express = require('express');
const router = express.Router();
const settingsService = require('../services/settings');
const telegramService = require('../services/telegram');
const stockChecker = require('../services/stockChecker');

// Get all settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await settingsService.getSettings();
        const checkerStatus = stockChecker.getStatus();
        
        res.json({ 
            settings,
            checker: checkerStatus
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update settings
router.post('/settings', express.json(), async (req, res) => {
    try {
        const updates = req.body;
        
        const success = await settingsService.updateSettings(updates);
        
        if (!success) {
            return res.status(500).json({ error: 'Failed to update settings' });
        }

        // Reload settings
        const settings = await settingsService.getSettings();

        // Update Telegram service
        telegramService.configure(
            settings.telegram_bot_token,
            settings.telegram_chat_id,
            settings.telegram_enabled
        );

        // Restart stock checker if running
        if (stockChecker.isRunning) {
            await stockChecker.restart();
        }

        res.json({ 
            success: true,
            message: 'Settings updated successfully',
            settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Test Telegram connection
router.post('/settings/telegram/test', express.json(), async (req, res) => {
    try {
        const { bot_token, chat_id, header, footer } = req.body;

        if (!bot_token || !chat_id) {
            return res.status(400).json({ error: 'Bot token and chat ID required' });
        }

        // Temporarily configure for testing
        const originalConfig = {
            botToken: telegramService.botToken,
            chatId: telegramService.chatId,
            enabled: telegramService.enabled
        };

        telegramService.configure(bot_token, chat_id, true);

        // Test connection
        const connectionTest = await telegramService.testConnection();
        
        if (!connectionTest.success) {
            // Restore original config
            telegramService.configure(
                originalConfig.botToken,
                originalConfig.chatId,
                originalConfig.enabled
            );
            return res.status(400).json({ 
                success: false, 
                error: connectionTest.error 
            });
        }

        // Send test message with custom header/footer
        const messageTest = await telegramService.sendTestMessage(header || '', footer || '');

        // Restore original config
        telegramService.configure(
            originalConfig.botToken,
            originalConfig.chatId,
            originalConfig.enabled
        );

        res.json({ 
            success: messageTest.success,
            botInfo: connectionTest.botInfo,
            message: messageTest.success 
                ? 'Test message sent successfully!' 
                : messageTest.error
        });
    } catch (error) {
        console.error('Error testing Telegram:', error);
        res.status(500).json({ error: 'Failed to test Telegram connection' });
    }
});

// Trigger manual stock check
router.post('/settings/check-stock', async (req, res) => {
    try {
        const result = await stockChecker.checkStock();
        res.json(result);
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).json({ error: 'Failed to check stock' });
    }
});

// Start/stop stock checker
router.post('/settings/checker/:action', async (req, res) => {
    try {
        const { action } = req.params;

        if (action === 'start') {
            await stockChecker.start();
            res.json({ success: true, message: 'Stock checker started' });
        } else if (action === 'stop') {
            stockChecker.stop();
            res.json({ success: true, message: 'Stock checker stopped' });
        } else if (action === 'restart') {
            await stockChecker.restart();
            res.json({ success: true, message: 'Stock checker restarted' });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error controlling stock checker:', error);
        res.status(500).json({ error: 'Failed to control stock checker' });
    }
});

module.exports = router;

