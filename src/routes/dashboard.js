const express = require('express');
const router = express.Router();
const multer = require('multer');
const { validateDashboardAuth } = require('../middleware/auth');
const productsController = require('../controllers/products');

// Configure multer for text file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 // 1MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files are allowed'));
        }
    }
});

// All dashboard API routes require authentication
router.use(validateDashboardAuth);

// Upload products from text file
router.post('/products/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const products = req.file.buffer.toString('utf-8');
        req.body.products = products;
        productsController.uploadProducts(req, res);
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// Upload products from text (direct)
router.post('/products/upload-text', express.json(), (req, res) => {
    productsController.uploadProducts(req, res);
});

// Get all products (with optional status filter)
router.get('/products', productsController.getProducts);

// Delete single product
router.delete('/products/:id', productsController.deleteProduct);

// Bulk delete products
router.post('/products/bulk-delete', express.json(), productsController.bulkDeleteProducts);

// Delete products by text list (partial match)
router.post('/products/delete-by-list', express.json(), productsController.deleteByList);

// Get statistics
router.get('/stats', productsController.getStats);

module.exports = router;

