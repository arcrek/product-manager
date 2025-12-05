const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const dbPath = process.env.DB_PATH || './data/products.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        throw err;
    }
    console.log('✓ Connected to SQLite database');
});

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL');

// Promisify database methods with proper context
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize database schema
async function initializeDatabase() {
    // Create inventories table
    const createInventoriesTableSQL = `
        CREATE TABLE IF NOT EXISTS inventories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    `;

    // Create products table with inventory_id
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product TEXT NOT NULL,
            inventory_id INTEGER DEFAULT 1,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_sold BOOLEAN DEFAULT 0,
            order_id TEXT NULL,
            sold_date DATETIME NULL,
            moved_date DATETIME NULL,
            FOREIGN KEY (inventory_id) REFERENCES inventories(id)
        )
    `;

    const createIndexSoldSQL = `
        CREATE INDEX IF NOT EXISTS idx_is_sold ON products(is_sold)
    `;

    const createIndexUploadDateSQL = `
        CREATE INDEX IF NOT EXISTS idx_upload_date ON products(upload_date)
    `;

    const createIndexInventorySQL = `
        CREATE INDEX IF NOT EXISTS idx_inventory_id ON products(inventory_id)
    `;

    const createIndexInventorySoldSQL = `
        CREATE INDEX IF NOT EXISTS idx_inventory_sold ON products(inventory_id, is_sold)
    `;

    try {
        // Create inventories table first
        await dbRun(createInventoriesTableSQL);
        
        // Initialize Default Inventories
        // ID 1: ExpressVPN (Renaming Default if exists or creating)
        const inv1 = await dbGet('SELECT id FROM inventories WHERE id = 1');
        if (!inv1) {
            await dbRun(
                'INSERT INTO inventories (id, name, description) VALUES (?, ?, ?)',
                [1, 'ExpressVPN', 'Main inventory for ExpressVPN accounts']
            );
            console.log('✓ ExpressVPN inventory created');
        } else {
            // Update name if it's "Default Inventory"
            await dbRun("UPDATE inventories SET name = 'ExpressVPN', description = 'Main inventory for ExpressVPN accounts' WHERE id = 1 AND name = 'Default Inventory'");
        }

        // ID 2: Email Trial
        const inv2 = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Email Trial']);
        if (!inv2) {
            await dbRun(
                'INSERT INTO inventories (name, description) VALUES (?, ?)',
                ['Email Trial', 'Inventory for Email Trial accounts']
            );
            console.log('✓ Email Trial inventory created');
        }

        // ID 3: Trôi hạn (Sub-inventory for ExpressVPN)
        const inv3 = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Trôi hạn']);
        if (!inv3) {
            await dbRun(
                'INSERT INTO inventories (name, description) VALUES (?, ?)',
                ['Trôi hạn', 'Expired ExpressVPN accounts (Moved after 3 days)']
            );
            console.log('✓ Trôi hạn inventory created');
        }

        // Create or alter products table
        await dbRun(createTableSQL);
        
        // Try to add inventory_id column if it doesn't exist (for existing databases)
        try {
            await dbRun('ALTER TABLE products ADD COLUMN inventory_id INTEGER DEFAULT 1');
            console.log('✓ Added inventory_id column to products table');
        } catch (e) {
            // Column already exists, ignore
        }

        // Try to add moved_date column
        try {
            await dbRun('ALTER TABLE products ADD COLUMN moved_date DATETIME NULL');
            console.log('✓ Added moved_date column to products table');
        } catch (e) {
            // Column already exists, ignore
        }
        
        await dbRun(createIndexSoldSQL);
        await dbRun(createIndexUploadDateSQL);
        await dbRun(createIndexInventorySQL);
        await dbRun(createIndexInventorySoldSQL);
        
        console.log('✓ Database initialized successfully');
    } catch (error) {
        console.error('✗ Error initializing database:', error.message);
        throw error;
    }
}

// Initialize on module load
initializeDatabase().catch(console.error);

// Database query functions (replacing prepared statements)
const queries = {
    async getAvailableCount(inventoryId = null) {
        if (inventoryId) {
            return await dbGet('SELECT COUNT(*) as sum FROM products WHERE is_sold = 0 AND inventory_id = ?', [inventoryId]);
        }
        return await dbGet('SELECT COUNT(*) as sum FROM products WHERE is_sold = 0');
    },
    
    async getAvailableProducts(limit, inventoryId = null) {
        if (inventoryId) {
            return await dbAll(`
                SELECT id, product FROM products 
                WHERE is_sold = 0 AND inventory_id = ?
                ORDER BY id ASC 
                LIMIT ?
            `, [inventoryId, limit]);
        }
        return await dbAll(`
            SELECT id, product FROM products 
            WHERE is_sold = 0 
            ORDER BY id ASC 
            LIMIT ?
        `, [limit]);
    },
    
    async markProductsAsSold(orderId, productId) {
        return await dbRun(`
            UPDATE products 
            SET is_sold = 1, order_id = ?, sold_date = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [orderId, productId]);
    },
    
    async insertProduct(product, inventoryId = 1) {
        return await dbRun('INSERT INTO products (product, inventory_id) VALUES (?, ?)', [product, inventoryId]);
    },
    
    async getAllProducts(inventoryId = null) {
        if (inventoryId) {
            return await dbAll(`
                SELECT id, product, inventory_id, upload_date, is_sold, order_id, sold_date 
                FROM products 
                WHERE inventory_id = ?
                ORDER BY upload_date DESC, id DESC
            `, [inventoryId]);
        }
        return await dbAll(`
            SELECT id, product, inventory_id, upload_date, is_sold, order_id, sold_date 
            FROM products 
            ORDER BY upload_date DESC, id DESC
        `);
    },
    
    async getProductsByStatus(status, inventoryId = null) {
        if (inventoryId) {
            return await dbAll(`
                SELECT id, product, inventory_id, upload_date, is_sold, order_id, sold_date 
                FROM products 
                WHERE is_sold = ? AND inventory_id = ?
                ORDER BY upload_date DESC, id DESC
            `, [status, inventoryId]);
        }
        return await dbAll(`
            SELECT id, product, inventory_id, upload_date, is_sold, order_id, sold_date 
            FROM products 
            WHERE is_sold = ? 
            ORDER BY upload_date DESC, id DESC
        `, [status]);
    },
    
    async deleteProduct(id) {
        return await dbRun('DELETE FROM products WHERE id = ?', [id]);
    },
    
    async getStats(inventoryId = null) {
        if (inventoryId) {
            return await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_sold = 0 THEN 1 ELSE 0 END) as available,
                    SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) as sold
                FROM products
                WHERE inventory_id = ?
            `, [inventoryId]);
        }
        return await dbGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_sold = 0 THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) as sold
            FROM products
        `);
    },
    
    async getRecentUploads(inventoryId = null) {
        if (inventoryId) {
            return await dbAll(`
                SELECT product, upload_date, inventory_id
                FROM products 
                WHERE inventory_id = ?
                ORDER BY upload_date DESC 
                LIMIT 10
            `, [inventoryId]);
        }
        return await dbAll(`
            SELECT product, upload_date, inventory_id
            FROM products 
            ORDER BY upload_date DESC 
            LIMIT 10
        `);
    },
    
    async getRecentSales(inventoryId = null) {
        if (inventoryId) {
            return await dbAll(`
                SELECT product, order_id, sold_date, inventory_id
                FROM products 
                WHERE is_sold = 1 AND inventory_id = ?
                ORDER BY sold_date DESC 
                LIMIT 10
            `, [inventoryId]);
        }
        return await dbAll(`
            SELECT product, order_id, sold_date, inventory_id
            FROM products 
            WHERE is_sold = 1 
            ORDER BY sold_date DESC 
            LIMIT 10
        `);
    },

    // Inventory queries
    async getAllInventories() {
        return await dbAll(`
            SELECT id, name, description, created_at, is_active
            FROM inventories
            ORDER BY created_at DESC
        `);
    },

    async getInventoryById(id) {
        return await dbGet('SELECT * FROM inventories WHERE id = ?', [id]);
    },

    async createInventory(name, description) {
        return await dbRun(
            'INSERT INTO inventories (name, description) VALUES (?, ?)',
            [name, description]
        );
    },

    async updateInventory(id, name, description, isActive) {
        return await dbRun(
            'UPDATE inventories SET name = ?, description = ?, is_active = ? WHERE id = ?',
            [name, description, isActive ? 1 : 0, id]
        );
    },

    async deleteInventory(id) {
        return await dbRun('DELETE FROM inventories WHERE id = ?', [id]);
    }
};

// Transaction helper
async function runInTransaction(callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            Promise.resolve(callback())
                .then((result) => {
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                })
                .catch((error) => {
                    db.run('ROLLBACK', () => {
                        reject(error);
                    });
                });
        });
    });
}

module.exports = {
    db,
    queries,
    runInTransaction,
    dbRun,
    dbGet,
    dbAll
};
