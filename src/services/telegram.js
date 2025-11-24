const axios = require('axios');

class TelegramService {
    constructor() {
        this.botToken = null;
        this.chatId = null;
        this.enabled = false;
    }

    // Format time to UTC+7
    formatTime() {
        const now = new Date();
        const utc7Time = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        return utc7Time.toLocaleString('en-US', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
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
        
        message += `\n\n⏰ Time: ${this.formatTime()} (UTC+7)`;
        
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
        
        message += `✅ <b>Test Message</b>\n\nTelegram notifications are working!\n\n⏰ ${this.formatTime()} (UTC+7)`;
        
        if (footer) {
            message += `\n\n${footer}`;
        }
        
        return await this.sendMessage(message);
    }

    async sendProductAddedAlert(quantity, header = '', footer = '') {
        let message = '';
        
        if (header) {
            message += `${header}\n\n`;
        }
        
        message += `📦 <b>Products Added</b>\n\n`;
        message += `➕ New Products: <b>${quantity}</b>\n`;
        message += `⏰ Time: ${this.formatTime()} (UTC+7)`;
        
        if (footer) {
            message += `\n\n${footer}`;
        }
        
        return await this.sendMessage(message);
    }

    async sendProductSoldAlert(quantity, orderId, header = '', footer = '') {
        let message = '';
        
        if (header) {
            message += `${header}\n\n`;
        }
        
        message += `💰 <b>Products Sold</b>\n\n`;
        message += `📤 Quantity Sold: <b>${quantity}</b>\n`;
        message += `🆔 Order ID: <code>${orderId}</code>\n`;
        message += `⏰ Time: ${this.formatTime()} (UTC+7)`;
        
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

