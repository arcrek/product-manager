require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const path = require('path');

// Initialize database
require('./config/database');

const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const apiKeysRoutes = require('./routes/apiKeys');
const inventoriesRoutes = require('./routes/inventories');
const emailTrialRoutes = require('./routes/emailTrial');
const { handleLogin, handleLogout, validateDashboardAuth } = require('./middleware/auth');
const telegramService = require('./services/telegram');
const stockChecker = require('./services/stockChecker');
const productMigration = require('./services/productMigration');
const settingsService = require('./services/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for dashboard to work properly
}));

// CORS
app.use(cors());

// Compression
app.use(compression());

// Cookie parser
app.use(cookieParser());

// Session middleware with SQLite store (production-ready)
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data',
        table: 'sessions',
        concurrentDB: true
    }),
    secret: process.env.SESSION_SECRET || 'expressvpn-secret-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true only if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please try again later' }
});

const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes
    message: { error: 'Too many requests, please try again later' }
});

// Apply rate limiters
app.use('/input', apiLimiter);
app.use('/api', dashboardLimiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (login page is public)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint (public)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Login routes (public)
app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.post('/api/login', express.json(), handleLogin);
app.post('/api/logout', express.json(), handleLogout);

// API routes (main inventory API) - public with API key
app.use('/', apiRoutes);

// Dashboard API routes - require authentication
app.use('/api', validateDashboardAuth, dashboardRoutes);
app.use('/api', validateDashboardAuth, settingsRoutes);
app.use('/api', validateDashboardAuth, apiKeysRoutes);
app.use('/api', validateDashboardAuth, inventoriesRoutes);
app.use('/api', validateDashboardAuth, emailTrialRoutes);

// Dashboard page - require authentication
app.get(['/', '/dashboard'], validateDashboardAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum 1MB allowed' });
        }
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize services
async function initializeServices() {
    try {
        // Load settings and configure Telegram
        const settings = await settingsService.getSettings();
        
        telegramService.configure(
            settings.telegram_bot_token,
            settings.telegram_chat_id,
            settings.telegram_enabled
        );

        // Start stock checker if enabled
        if (settings.telegram_enabled) {
            await stockChecker.start();
        }

        // Start product migration service
        await productMigration.start();

        console.log('✓ Services initialized');
    } catch (error) {
        console.error('Error initializing services:', error);
    }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   Product Manager Server                  ║
╚═══════════════════════════════════════════╝
    
✓ Server running on port ${PORT}
✓ Environment: ${process.env.NODE_ENV || 'development'}
✓ Dashboard: http://localhost:${PORT}
✓ API: http://localhost:${PORT}/input?key=YOUR_API_KEY
✓ Health: http://localhost:${PORT}/health

Press Ctrl+C to stop
    `);

    // Initialize services
    await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    stockChecker.stop();
    productMigration.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    stockChecker.stop();
    productMigration.stop();
    process.exit(0);
});

