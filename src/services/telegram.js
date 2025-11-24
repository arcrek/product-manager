const axios = require('axios');

class TelegramService {
    constructor() {
        this.botToken = null;
        this.chatId = null;
        this.enabled = false;
    }

    configure(botToken, chatId, enabled = true) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.enabled = enabled;
    }

    isConfigured() {
        return this.enabled && this.botToken && this.chatId;
    }

    async sendMessage(message) {
        if (!this.isConfigured()) {
            console.log('Telegram not configured, skipping notification');
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            
            const response = await axios.post(url, {
                chat_id: this.chatId,
                text: message,
                parse_mode: 'HTML'
            });

            console.log('Telegram notification sent successfully');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Failed to send Telegram notification:', error.message);
            return { 
                success: false, 
                error: error.response?.data?.description || error.message 
            };
        }
    }

    async sendStockAlert(availableCount, threshold, header = '', footer = '') {
        const emoji = availableCount === 0 ? '🚨' : availableCount <= threshold ? '⚠️' : '📊';
        
        let message = '';
        
        // Add custom header if provided
        if (header) {
            message += `${header}\n\n`;
        }
        
        message += `${emoji} <b>Stock Alert</b>\n\n`;
        message += `📦 Available Products: <b>${availableCount}</b>\n`;
        
        if (availableCount === 0) {
            message += `\n🚨 <b>OUT OF STOCK!</b>\n`;
            message += `Please upload more products immediately.`;
        } else if (availableCount <= threshold) {
            message += `\n⚠️ <b>LOW STOCK WARNING</b>\n`;
            message += `Stock is below threshold (${threshold})`;
        }
        
        message += `\n\n⏰ Time: ${new Date().toLocaleString()}`;
        
        // Add custom footer if provided
        if (footer) {
            message += `\n\n${footer}`;
        }
        
        return await this.sendMessage(message);
    }

    async sendTestMessage(header = '', footer = '') {
        let message = '';
        
        if (header) {
            message += `${header}\n\n`;
        }
        
        message += `✅ <b>Test Message</b>\n\nTelegram notifications are working!\n\n⏰ ${new Date().toLocaleString()}`;
        
        if (footer) {
            message += `\n\n${footer}`;
        }
        
        return await this.sendMessage(message);
    }

    async testConnection() {
        if (!this.botToken) {
            return { success: false, error: 'Bot token not configured' };
        }

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
            const response = await axios.get(url);
            
            return { 
                success: true, 
                botInfo: response.data.result 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.description || error.message 
            };
        }
    }
}

module.exports = new TelegramService();

