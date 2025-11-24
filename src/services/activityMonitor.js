const telegramService = require('./telegram');
const settingsService = require('./settings');

class ActivityMonitor {
    constructor() {
        this.enabled = true;
    }

    async notifyProductAdded(quantity) {
        if (!this.enabled) return;

        try {
            const settings = await settingsService.getSettings();
            
            if (!settings.notify_on_add) {
                console.log('Notify on add is disabled');
                return;
            }

            // Only send if Telegram is enabled
            if (!settings.telegram_enabled) {
                return;
            }

            const header = settings.telegram_header || '';
            const footer = settings.telegram_footer || '';

            await telegramService.sendProductAddedAlert(quantity, header, footer);
            console.log(`✓ Sent notification: ${quantity} products added`);
        } catch (error) {
            console.error('Error sending add notification:', error);
        }
    }

    async notifyProductSold(quantity, orderId) {
        if (!this.enabled) return;

        try {
            const settings = await settingsService.getSettings();
            
            if (!settings.notify_on_sold) {
                console.log('Notify on sold is disabled');
                return;
            }

            // Only send if Telegram is enabled
            if (!settings.telegram_enabled) {
                return;
            }

            const header = settings.telegram_header || '';
            const footer = settings.telegram_footer || '';

            await telegramService.sendProductSoldAlert(quantity, orderId, header, footer);
            console.log(`✓ Sent notification: ${quantity} products sold, Order ID: ${orderId}`);
        } catch (error) {
            console.error('Error sending sold notification:', error);
        }
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}

module.exports = new ActivityMonitor();

