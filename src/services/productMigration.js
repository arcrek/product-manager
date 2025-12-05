const { dbAll, dbRun, dbGet } = require('../config/database');
const cron = require('node-cron');
const telegramService = require('./telegram');

class ProductMigrationService {
    constructor() {
        this.job = null;
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            console.log('Product migration service already running');
            return;
        }

        // Run every hour
        this.job = cron.schedule('0 * * * *', async () => {
            await this.migrateExpiredProducts();
        });

        this.isRunning = true;
        console.log('✓ Product migration service started (runs hourly)');
        
        // Run immediately on start
        await this.migrateExpiredProducts();
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.isRunning = false;
            console.log('Product migration service stopped');
        }
    }

    async migrateExpiredProducts() {
        try {
            // 1. Get ExpressVPN inventory
            const expressVpn = await dbGet('SELECT id FROM inventories WHERE name = ?', ['ExpressVPN']);
            const troiHan = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Trôi hạn']);
            
            if (!expressVpn || !troiHan) {
                console.log('ExpressVPN or Trôi hạn inventory not found');
                return;
            }

            // 2. Move products older than 3 days from ExpressVPN to Trôi hạn
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            
            const productsToMove = await dbAll(`
                SELECT id, product FROM products 
                WHERE inventory_id = ? 
                AND is_sold = 0 
                AND upload_date <= datetime(?)
            `, [expressVpn.id, threeDaysAgo.toISOString()]);

            for (const product of productsToMove) {
                await dbRun(
                    'UPDATE products SET inventory_id = ? WHERE id = ?',
                    [troiHan.id, product.id]
                );
            }

            if (productsToMove.length > 0) {
                console.log(`Moved ${productsToMove.length} products to Trôi hạn`);
                await this.notifyTelegram(`🔄 Moved ${productsToMove.length} products to Trôi hạn (>3 days old)`);
            }

            // 3. Delete products older than 10 days in Trôi hạn
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            
            const productsToDelete = await dbAll(`
                SELECT id, product FROM products 
                WHERE inventory_id = ? 
                AND is_sold = 0 
                AND upload_date <= datetime(?)
            `, [troiHan.id, tenDaysAgo.toISOString()]);

            for (const product of productsToDelete) {
                await dbRun('DELETE FROM products WHERE id = ?', [product.id]);
            }

            if (productsToDelete.length > 0) {
                console.log(`Deleted ${productsToDelete.length} expired products from Trôi hạn`);
                await this.notifyTelegram(`🗑️ Auto-deleted ${productsToDelete.length} products from Trôi hạn (>10 days old)`);
            }

        } catch (error) {
            console.error('Error in product migration:', error);
        }
    }

    async notifyTelegram(message) {
        try {
            await telegramService.sendMessage(message);
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }
}

module.exports = new ProductMigrationService();

