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
        this.lastAlertType = null; // Track what type of alert was last sent
    }

    async checkStock() {
        try {
            console.log('Running stock check...');
            this.lastCheck = new Date();

            // Get current stock count (available)
            const result = await queries.getAvailableCount();
            const currentAvailable = result ? result.sum : 0;

            // Get settings
            const settings = await settingsService.getSettings();
            const threshold = settings.stock_threshold || 10;
            const header = settings.telegram_header || '';
            const footer = settings.telegram_footer || '';

            console.log(`Available: ${currentAvailable}, Threshold: ${threshold}`);

            let notificationSent = false;

            // Determine current alert type
            let currentAlertType = null;
            if (currentAvailable === 0) {
                currentAlertType = 'out_of_stock';
            } else if (currentAvailable <= threshold) {
                currentAlertType = 'low_stock';
            } else {
                currentAlertType = 'normal';
            }

            // Only send notification if:
            // 1. Alert type changed (e.g., from low_stock to out_of_stock)
            // 2. Stock count changed AND still in alert state
            // 3. First time checking (lastAlertType is null)
            const shouldNotify = (
                this.lastAlertType === null || // First check
                this.lastAlertType !== currentAlertType || // Alert type changed
                (currentAlertType !== 'normal' && this.lastNotificationCount !== currentAvailable) // Stock changed while in alert state
            );

            if (shouldNotify && currentAlertType !== 'normal') {
                await telegramService.sendStockAlert(currentAvailable, threshold, header, footer);
                notificationSent = true;
                console.log(`✓ Sent ${currentAlertType} alert for ${currentAvailable} products`);
            } else if (currentAlertType !== 'normal') {
                console.log(`Skipped duplicate ${currentAlertType} notification (already sent)`);
            }

            // Update tracking
            this.lastNotificationCount = currentAvailable;
            this.lastAlertType = currentAlertType;

            return {
                success: true,
                currentStock: currentAvailable,
                threshold,
                notificationSent,
                alertType: currentAlertType
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
            lastNotificationCount: this.lastNotificationCount,
            lastAlertType: this.lastAlertType
        };
    }
}

module.exports = new StockChecker();

