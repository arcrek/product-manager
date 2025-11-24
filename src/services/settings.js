const { dbRun, dbGet, dbAll } = require('../config/database');

class SettingsService {
    constructor() {
        this.cache = null;
        this.initializeSettings();
    }

    async initializeSettings() {
        try {
            // Create settings table
            await dbRun(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Set default settings if not exists
            const defaults = {
                telegram_bot_token: '',
                telegram_chat_id: '',
                telegram_enabled: 'false',
                stock_threshold: '10',
                check_interval: '*/30 * * * *', // Every 30 minutes
                notify_on_add: 'true',
                notify_on_sold: 'true',
                last_notification: '',
                telegram_header: '🏪 <b>ExpressVPN Stock Monitor</b>',
                telegram_footer: '━━━━━━━━━━━━━━━━\n💻 Powered by ExpressVPN API'
            };

            for (const [key, value] of Object.entries(defaults)) {
                await dbRun(
                    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
                    [key, value]
                );
            }

            console.log('✓ Settings table initialized');
        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    }

    async getSetting(key) {
        try {
            const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
            return row ? row.value : null;
        } catch (error) {
            console.error('Error getting setting:', error);
            return null;
        }
    }

    async setSetting(key, value) {
        try {
            await dbRun(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value]
            );
            this.cache = null; // Clear cache
            return true;
        } catch (error) {
            console.error('Error setting setting:', error);
            return false;
        }
    }

    async getSettings() {
        if (this.cache) {
            return this.cache;
        }

        try {
            const rows = await dbAll('SELECT key, value FROM settings');
            const settings = {};
            
            rows.forEach(row => {
                // Convert string values to appropriate types
                if (row.value === 'true') settings[row.key] = true;
                else if (row.value === 'false') settings[row.key] = false;
                else if (!isNaN(row.value) && row.value !== '') settings[row.key] = Number(row.value);
                else settings[row.key] = row.value;
            });

            this.cache = settings;
            return settings;
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    async updateSettings(updates) {
        try {
            for (const [key, value] of Object.entries(updates)) {
                await this.setSetting(key, String(value));
            }
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }
}

module.exports = new SettingsService();

