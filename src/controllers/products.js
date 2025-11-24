const { queries, runInTransaction, dbRun } = require('../config/database');
const { validateProductText, parseProductsFromText } = require('../utils/validator');
const cache = require('../utils/cache');
const activityMonitor = require('../services/activityMonitor');

// Upload products from text
async function uploadProducts(req, res) {
    const { products } = req.body;

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

    try {
        // Insert products in transaction
        const inserted = await runInTransaction(async () => {
            for (const product of validProducts) {
                await queries.insertProduct(product);
            }
            return validProducts.length;
        });

        // Invalidate cache
        cache.invalidate('inventory_count');

        // Send immediate notification about products added
        activityMonitor.notifyProductAdded(inserted);

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
    const { status } = req.query;

    try {
        let products;

        if (status === 'available') {
            products = await queries.getProductsByStatus(0);
        } else if (status === 'sold') {
            products = await queries.getProductsByStatus(1);
        } else {
            products = await queries.getAllProducts();
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

// Get statistics
async function getStats(req, res) {
    try {
        const stats = await queries.getStats();
        const recentUploads = await queries.getRecentUploads();
        const recentSales = await queries.getRecentSales();

        res.json({
            stats: {
                total: stats.total || 0,
                available: stats.available || 0,
                sold: stats.sold || 0
            },
            recentUploads,
            recentSales
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
}

module.exports = {
    uploadProducts,
    getProducts,
    deleteProduct,
    bulkDeleteProducts,
    getStats
};
