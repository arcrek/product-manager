const { dbRun, dbGet, dbAll } = require('../config/database');
const crypto = require('crypto');

class ApiKeyService {
    constructor() {
        this.initializeTable();
    }

    async initializeTable() {
        try {
            await dbRun(`
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    inventory_id INTEGER DEFAULT NULL,
                    is_kiosk BOOLEAN DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    usage_count INTEGER DEFAULT 0,
                    last_used DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT DEFAULT 'admin',
                    FOREIGN KEY (inventory_id) REFERENCES inventories(id)
                )
            `);

            await dbRun(`
                CREATE INDEX IF NOT EXISTS idx_api_key ON api_keys(key, is_active)
            `);

            await dbRun(`
                CREATE INDEX IF NOT EXISTS idx_inventory_id ON api_keys(inventory_id)
            `);

            // Try to add inventory_id and is_kiosk columns if they don't exist (for existing databases)
            try {
                await dbRun('ALTER TABLE api_keys ADD COLUMN inventory_id INTEGER DEFAULT NULL');
                console.log('✓ Added inventory_id column to api_keys table');
            } catch (e) {
                // Column already exists, ignore
            }

            try {
                await dbRun('ALTER TABLE api_keys ADD COLUMN is_kiosk BOOLEAN DEFAULT 0');
                console.log('✓ Added is_kiosk column to api_keys table');
            } catch (e) {
                // Column already exists, ignore
            }

            // Check if default key exists
            const defaultKey = '17e7068f-f366-4120-83e3-e0ec1212da49';
            const existing = await dbGet('SELECT id FROM api_keys WHERE key = ?', [defaultKey]);
            
            if (!existing) {
                await dbRun(
                    'INSERT INTO api_keys (key, name, description, is_active, is_kiosk) VALUES (?, ?, ?, ?, ?)',
                    [defaultKey, 'Default Key', 'Initial Default API Key', 1, 0]
                );
                console.log('✓ Default API key added');
            }

            // No default API key - admin must create keys via dashboard

            console.log('✓ API Keys table initialized');
        } catch (error) {
            console.error('Error initializing API keys table:', error);
        }
    }

    async createKey(key, name, description = '', createdBy = 'admin', inventoryId = null, isKiosk = false) {
        try {
            // Validate key
            if (!key || key.trim().length === 0) {
                return {
                    success: false,
                    error: 'API key is required'
                };
            }

            const trimmedKey = key.trim();

            // Check if key already exists
            const existing = await dbGet('SELECT id FROM api_keys WHERE key = ?', [trimmedKey]);
            if (existing) {
                return {
                    success: false,
                    error: 'This API key already exists'
                };
            }

            // If kiosk mode, inventory_id is required
            if (isKiosk && !inventoryId) {
                return {
                    success: false,
                    error: 'Inventory ID is required for kiosk API keys'
                };
            }
            
            const result = await dbRun(
                'INSERT INTO api_keys (key, name, description, created_by, inventory_id, is_kiosk) VALUES (?, ?, ?, ?, ?, ?)',
                [trimmedKey, name, description, createdBy, inventoryId, isKiosk ? 1 : 0]
            );

            return {
                success: true,
                key: trimmedKey,
                id: result.lastID
            };
        } catch (error) {
            console.error('Error creating API key:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async validateKey(key) {
        try {
            const apiKey = await dbGet(
                'SELECT id, name, is_active, inventory_id, is_kiosk FROM api_keys WHERE key = ? AND is_active = 1',
                [key]
            );

            if (apiKey) {
                // Update usage count and last used
                await dbRun(
                    'UPDATE api_keys SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?',
                    [apiKey.id]
                );

                return {
                    valid: true,
                    keyId: apiKey.id,
                    keyName: apiKey.name,
                    inventoryId: apiKey.inventory_id,
                    isKiosk: apiKey.is_kiosk === 1
                };
            }

            return { valid: false };
        } catch (error) {
            console.error('Error validating API key:', error);
            return { valid: false };
        }
    }

    async getAllKeys() {
        try {
            const keys = await dbAll(`
                SELECT 
                    ak.id, 
                    ak.key, 
                    ak.name, 
                    ak.description, 
                    ak.is_active,
                    ak.is_kiosk,
                    ak.inventory_id,
                    i.name as inventory_name,
                    ak.usage_count, 
                    ak.last_used, 
                    ak.created_at, 
                    ak.created_by
                FROM api_keys ak
                LEFT JOIN inventories i ON ak.inventory_id = i.id
                ORDER BY ak.created_at DESC
            `);

            return keys;
        } catch (error) {
            console.error('Error getting API keys:', error);
            return [];
        }
    }

    async getKey(id) {
        try {
            const key = await dbGet(`
                SELECT 
                    ak.*,
                    i.name as inventory_name
                FROM api_keys ak
                LEFT JOIN inventories i ON ak.inventory_id = i.id
                WHERE ak.id = ?
            `, [id]);
            return key;
        } catch (error) {
            console.error('Error getting API key:', error);
            return null;
        }
    }

    async updateKey(id, updates) {
        try {
            const { name, description, is_active, inventory_id, is_kiosk } = updates;
            
            // If kiosk mode, inventory_id is required
            if (is_kiosk && !inventory_id) {
                return {
                    success: false,
                    error: 'Inventory ID is required for kiosk API keys'
                };
            }

            await dbRun(
                'UPDATE api_keys SET name = ?, description = ?, is_active = ?, inventory_id = ?, is_kiosk = ? WHERE id = ?',
                [name, description, is_active ? 1 : 0, inventory_id, is_kiosk ? 1 : 0, id]
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating API key:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteKey(id) {
        try {
            // Check if it's the last active key
            const activeKeys = await dbAll('SELECT id FROM api_keys WHERE is_active = 1');
            
            if (activeKeys.length === 1 && activeKeys[0].id === id) {
                return {
                    success: false,
                    error: 'Cannot delete the last active API key'
                };
            }

            const result = await dbRun('DELETE FROM api_keys WHERE id = ?', [id]);

            return {
                success: result.changes > 0,
                error: result.changes === 0 ? 'Key not found' : null
            };
        } catch (error) {
            console.error('Error deleting API key:', error);
            return { success: false, error: error.message };
        }
    }

    async toggleKey(id, isActive) {
        try {
            await dbRun(
                'UPDATE api_keys SET is_active = ? WHERE id = ?',
                [isActive ? 1 : 0, id]
            );

            return { success: true };
        } catch (error) {
            console.error('Error toggling API key:', error);
            return { success: false, error: error.message };
        }
    }

    async getStats() {
        try {
            const stats = await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
                FROM api_keys
            `);

            return stats;
        } catch (error) {
            console.error('Error getting API key stats:', error);
            return { total: 0, active: 0 };
        }
    }
}

module.exports = new ApiKeyService();

