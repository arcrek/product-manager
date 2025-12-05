const { queries, runInTransaction, dbRun, dbGet, dbAll, db } = require('../config/database');
const { validateProductText, parseProductsFromText } = require('../utils/validator');
const cache = require('../utils/cache');
const activityMonitor = require('../services/activityMonitor');

// Upload products from text
async function uploadProducts(req, res) {
    const { products, inventory_id } = req.body;

    if (!products) {
        return res.status(400).json({ error: 'Products data is required' });
    }

    // Parse products from text
    const productList = parseProductsFromText(products);

    if (productList.length === 0) {
        return res.status(400).json({ error: 'No valid products found' });
    }

    if (productList.length > 200) {
        return res.status(400).json({ 
            error: `Too many products. Maximum 200 allowed, got ${productList.length}` 
        });
    }

    // Validate each product
    const validProducts = [];
    const errors = [];

    productList.forEach((product, index) => {
        const validation = validateProductText(product);
        if (validation.valid) {
            validProducts.push(validation.value);
        } else {
            errors.push(`Line ${index + 1}: ${validation.error}`);
        }
    });

    if (validProducts.length === 0) {
        return res.status(400).json({ 
            error: 'No valid products to insert', 
            details: errors 
        });
    }

    // Default to inventory 1 if not specified
    const targetInventoryId = inventory_id ? parseInt(inventory_id) : 1;

    try {
        // Insert products in transaction
        const inserted = await runInTransaction(async () => {
            for (const product of validProducts) {
                await queries.insertProduct(product, targetInventoryId);
            }
            return validProducts.length;
        });

        // Invalidate cache (both general and inventory-specific)
        cache.invalidate('inventory_count');
        cache.invalidate(`inventory_count_${targetInventoryId}`);

        // Send immediate notification about products added
        activityMonitor.notifyProductAdded(inserted, targetInventoryId);

        res.json({ 
            success: true, 
            inserted,
            skipped: productList.length - validProducts.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error uploading products:', error);
        res.status(500).json({ error: 'Failed to upload products' });
    }
}

// Get all products or filter by status
async function getProducts(req, res) {
    const { status, inventory_id } = req.query;

    try {
        let products;
        const inventoryId = inventory_id ? parseInt(inventory_id) : null;

        if (status === 'available') {
            products = await queries.getProductsByStatus(0, inventoryId);
        } else if (status === 'sold') {
            products = await queries.getProductsByStatus(1, inventoryId);
        } else {
            products = await queries.getAllProducts(inventoryId);
        }

        res.json({ products });
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
}

// Delete a single product
async function deleteProduct(req, res) {
    const { id } = req.params;

    const productId = parseInt(id);
    if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }

    try {
        const result = await queries.deleteProduct(productId);

        if (!result || result.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Invalidate cache
        cache.invalidate('inventory_count');

        res.json({ success: true, deleted: productId });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
}

// Bulk delete products
async function bulkDeleteProducts(req, res) {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Product IDs array is required' });
    }

    if (ids.length > 200) {
        return res.status(400).json({ error: 'Too many IDs. Maximum 200 allowed' });
    }

    try {
        // Delete in transaction
        const deleted = await runInTransaction(async () => {
            let count = 0;
            for (const id of ids) {
                const result = await queries.deleteProduct(parseInt(id));
                count += result.changes || 0;
            }
            return count;
        });

        // Invalidate cache
        cache.invalidate('inventory_count');

        res.json({ success: true, deleted });
    } catch (error) {
        console.error('Error bulk deleting products:', error);
        res.status(500).json({ error: 'Failed to delete products' });
    }
}

// Delete products by list (partial match) for Email Trial
async function deleteByList(req, res) {
    const { list } = req.body;

    if (!list) {
        return res.status(400).json({ error: 'List is required' });
    }

    // Parse list from text
    const items = parseProductsFromText(list);

    if (items.length === 0) {
        return res.status(400).json({ error: 'No valid items found in list' });
    }

    try {
        // Get Email Trial inventory ID
        const emailTrialInv = await dbGet('SELECT id FROM inventories WHERE name = ?', ['Email Trial']);
        
        if (!emailTrialInv) {
            return res.status(404).json({ error: 'Email Trial inventory not found' });
        }

        const inventoryId = emailTrialInv.id;

        // Delete in transaction
        const deleted = await runInTransaction(async () => {
            let count = 0;
            for (const item of items) {
                // Partial match delete in specific inventory
                const result = await dbRun(
                    'DELETE FROM products WHERE inventory_id = ? AND product LIKE ?', 
                    [inventoryId, `%${item}%`]
                );
                count += result.changes || 0;
            }
            return count;
        });

        // Invalidate cache
        cache.invalidate('inventory_count');
        cache.invalidate(`inventory_count_${inventoryId}`);

        res.json({ 
            success: true, 
            deleted, 
            processed: items.length 
        });
    } catch (error) {
        console.error('Error deleting products by list:', error);
        res.status(500).json({ error: 'Failed to delete products' });
    }
}

// Get statistics with aggregated activity
async function getStats(req, res) {
    try {
        const { inventory_id } = req.query;
        const inventoryId = inventory_id ? parseInt(inventory_id) : null;

        const stats = await queries.getStats(inventoryId);
        
        // Get aggregated activity data
        const recentActivity = await getAggregatedActivity(inventoryId);

        res.json({
            stats: {
                total: stats.total || 0,
                available: stats.available || 0,
                sold: stats.sold || 0
            },
            recentActivity
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
}

// Helper function to get aggregated activity
async function getAggregatedActivity(inventoryId = null) {
    try {
        // Get uploads grouped by date and inventory
        const uploadsQuery = inventoryId 
            ? `SELECT 
                DATE(upload_date) as date,
                inventory_id,
                COUNT(*) as count
               FROM products 
               WHERE inventory_id = ?
               GROUP BY DATE(upload_date), inventory_id
               ORDER BY upload_date DESC
               LIMIT 10`
            : `SELECT 
                DATE(upload_date) as date,
                inventory_id,
                COUNT(*) as count
               FROM products 
               GROUP BY DATE(upload_date), inventory_id
               ORDER BY upload_date DESC
               LIMIT 10`;
        
        const uploads = inventoryId 
            ? await dbAll(uploadsQuery, [inventoryId])
            : await dbAll(uploadsQuery);

        // Get sales grouped by date and inventory
        const salesQuery = inventoryId
            ? `SELECT 
                DATE(sold_date) as date,
                inventory_id,
                COUNT(*) as count
               FROM products 
               WHERE is_sold = 1 AND inventory_id = ?
               GROUP BY DATE(sold_date), inventory_id
               ORDER BY sold_date DESC
               LIMIT 10`
            : `SELECT 
                DATE(sold_date) as date,
                inventory_id,
                COUNT(*) as count
               FROM products 
               WHERE is_sold = 1
               GROUP BY DATE(sold_date), inventory_id
               ORDER BY sold_date DESC
               LIMIT 10`;
        
        const sales = inventoryId
            ? await dbAll(salesQuery, [inventoryId])
            : await dbAll(salesQuery);

        // Get inventory names
        const inventories = await queries.getAllInventories();
        const invMap = {};
        inventories.forEach(inv => {
            invMap[inv.id] = inv.name;
        });

        // Format activity with inventory names
        const activities = [];
        
        uploads.forEach(u => {
            activities.push({
                type: 'upload',
                date: u.date,
                count: u.count,
                inventory_id: u.inventory_id,
                inventory_name: invMap[u.inventory_id] || 'Unknown',
                description: `Uploaded ${u.count} product${u.count > 1 ? 's' : ''} in ${invMap[u.inventory_id] || 'Unknown'}`
            });
        });

        sales.forEach(s => {
            activities.push({
                type: 'sale',
                date: s.date,
                count: s.count,
                inventory_id: s.inventory_id,
                inventory_name: invMap[s.inventory_id] || 'Unknown',
                description: `Sold ${s.count} product${s.count > 1 ? 's' : ''} from ${invMap[s.inventory_id] || 'Unknown'}`
            });
        });

        // Sort by date descending
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        return activities.slice(0, 10);
    } catch (error) {
        console.error('Error getting aggregated activity:', error);
        return [];
    }
}

module.exports = {
    uploadProducts,
    getProducts,
    deleteProduct,
    bulkDeleteProducts,
    deleteByList,
    getStats
};
