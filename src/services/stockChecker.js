const cron = require('node-cron');
const { queries, dbRun, dbGet } = require('../config/database');
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

            // Check product lifecycle (Move/Delete)
            await this.checkLifecycle();

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

    async checkLifecycle() {
        try {
            console.log('Checking product lifecycle...');
            const settings = await settingsService.getSettings();
            const header = settings.telegram_header || '';
            const footer = settings.telegram_footer || '';

            // Get Inventory IDs
            const invExpress = await dbGet('SELECT id FROM inventories WHERE name = ?', ['ExpressVPN']);
            const invTroiHan = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Trôi hạn']);

            if (!invExpress || !invTroiHan) {
                console.error('Lifecycle check skipped: Inventories not found');
                return;
            }

            const expressId = invExpress.id;
            const troiHanId = invTroiHan.id;

            // 1. Move expired products from ExpressVPN to Trôi hạn (3 days)
            // SQLite: datetime('now') is UTC. We should use 'localtime' if upload_date was stored as localtime,
            // but usually it's UTC (CURRENT_TIMESTAMP).
            // Assuming upload_date is UTC.
            const moveResult = await dbRun(`
                UPDATE products 
                SET inventory_id = ?, moved_date = CURRENT_TIMESTAMP
                WHERE inventory_id = ? 
                AND upload_date < datetime('now', '-3 days')
                AND is_sold = 0
            `, [troiHanId, expressId]);

            if (moveResult.changes > 0) {
                console.log(`Moved ${moveResult.changes} expired products to Trôi hạn`);
                await telegramService.sendProductMovedAlert(
                    moveResult.changes, 
                    'ExpressVPN', 
                    'Trôi hạn', 
                    header, 
                    footer
                );
            }

            // 2. Delete old products from Trôi hạn (10 days after move)
            // Note: moved_date is when it entered Trôi hạn
            const deleteResult = await dbRun(`
                DELETE FROM products 
                WHERE inventory_id = ? 
                AND moved_date < datetime('now', '-10 days')
                AND is_sold = 0
            `, [troiHanId]);

            if (deleteResult.changes > 0) {
                console.log(`Deleted ${deleteResult.changes} old products from Trôi hạn`);
                await telegramService.sendProductDeletedAlert(
                    deleteResult.changes, 
                    'Trôi hạn', 
                    'Expired > 10 days', 
                    header, 
                    footer
                );
            }

        } catch (error) {
            console.error('Lifecycle check error:', error);
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

