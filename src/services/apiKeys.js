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
                    is_active BOOLEAN DEFAULT 1,
                    usage_count INTEGER DEFAULT 0,
                    last_used DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT DEFAULT 'admin'
                )
            `);

            await dbRun(`
                CREATE INDEX IF NOT EXISTS idx_api_key ON api_keys(key, is_active)
            `);

            // Check if default key exists
            const defaultKey = process.env.API_KEY || '17e7068f-f366-4120-83e3-e0ec1212da49';
            const existing = await dbGet('SELECT id FROM api_keys WHERE key = ?', [defaultKey]);
            
            if (!existing) {
                await dbRun(
                    'INSERT INTO api_keys (key, name, description, is_active) VALUES (?, ?, ?, ?)',
                    [defaultKey, 'Default Key', 'Initial API key from environment', 1]
                );
                console.log('✓ Default API key added');
            }

            console.log('✓ API Keys table initialized');
        } catch (error) {
            console.error('Error initializing API keys table:', error);
        }
    }

    async createKey(key, name, description = '', createdBy = 'admin') {
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
            
            const result = await dbRun(
                'INSERT INTO api_keys (key, name, description, created_by) VALUES (?, ?, ?, ?)',
                [trimmedKey, name, description, createdBy]
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
                'SELECT id, name, is_active FROM api_keys WHERE key = ? AND is_active = 1',
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
                    keyName: apiKey.name
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
                    id, 
                    key, 
                    name, 
                    description, 
                    is_active, 
                    usage_count, 
                    last_used, 
                    created_at, 
                    created_by
                FROM api_keys
                ORDER BY created_at DESC
            `);

            return keys;
        } catch (error) {
            console.error('Error getting API keys:', error);
            return [];
        }
    }

    async getKey(id) {
        try {
            return await dbGet('SELECT * FROM api_keys WHERE id = ?', [id]);
        } catch (error) {
            console.error('Error getting API key:', error);
            return null;
        }
    }

    async updateKey(id, updates) {
        try {
            const { name, description, is_active } = updates;
            
            await dbRun(
                'UPDATE api_keys SET name = ?, description = ?, is_active = ? WHERE id = ?',
                [name, description, is_active ? 1 : 0, id]
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
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    SUM(usage_count) as total_requests
                FROM api_keys
            `);

            return stats;
        } catch (error) {
            console.error('Error getting API key stats:', error);
            return { total: 0, active: 0, total_requests: 0 };
        }
    }
}

module.exports = new ApiKeyService();

