const cron = require('node-cron');
const { queries } = require('../config/database');
const telegramService = require('./telegram');
const settingsService = require('./settings');

class StockChecker {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.lastCheck = null;
        this.lastNotificationCount = null;
    }

    async checkStock() {
        try {
            console.log('Running stock check...');
            this.lastCheck = new Date();

            // Get current stock count
            const result = await queries.getAvailableCount();
            const currentCount = result ? result.sum : 0;

            // Get settings
            const settings = await settingsService.getSettings();
            const threshold = settings.stock_threshold || 10;
            const notifyOnChange = settings.notify_on_change || false;

            console.log(`Current stock: ${currentCount}, Threshold: ${threshold}`);

            // Check if we should send notification
            let shouldNotify = false;

            // Always notify if stock is 0 or below threshold
            if (currentCount === 0 || currentCount <= threshold) {
                shouldNotify = true;
            }

            // Notify on change if enabled
            if (notifyOnChange && this.lastNotificationCount !== null && 
                this.lastNotificationCount !== currentCount) {
                shouldNotify = true;
            }

            if (shouldNotify) {
                const header = settings.telegram_header || '';
                const footer = settings.telegram_footer || '';
                await telegramService.sendStockAlert(currentCount, threshold, header, footer);
                this.lastNotificationCount = currentCount;
            }

            return {
                success: true,
                currentStock: currentCount,
                threshold,
                notificationSent: shouldNotify
            };
        } catch (error) {
            console.error('Stock check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('Stock checker already running');
            return;
        }

        const settings = await settingsService.getSettings();
        const interval = settings.check_interval || '*/30 * * * *'; // Default: every 30 minutes

        console.log(`Starting stock checker with interval: ${interval}`);

        // Create cron job
        this.cronJob = cron.schedule(interval, async () => {
            await this.checkStock();
        });

        this.isRunning = true;
        console.log('Stock checker started');

        // Run initial check
        await this.checkStock();
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        this.isRunning = false;
        console.log('Stock checker stopped');
    }

    async restart() {
        this.stop();
        await this.start();
    }

    getStatus() {
        return {
            running: this.isRunning,
            lastCheck: this.lastCheck,
            lastNotificationCount: this.lastNotificationCount
        };
    }
}

module.exports = new StockChecker();

