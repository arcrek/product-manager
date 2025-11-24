const apiKeyService = require('../services/apiKeys');

// API Key authentication middleware
async function validateApiKey(req, res, next) {
    const apiKey = req.query.key;

    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    const validation = await apiKeyService.validateKey(apiKey);

    if (!validation.valid) {
        return res.status(403).json({ error: 'Invalid or inactive API key' });
    }

    // Attach key info to request for potential logging
    req.apiKey = {
        id: validation.keyId,
        name: validation.keyName
    };

    next();
}

// Session-based authentication for dashboard
function validateDashboardAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    
    // For API calls, return JSON error
    // Check Accept header or content type to determine if it's an API request
    const isApiRequest = req.xhr || 
                        req.headers.accept?.includes('application/json') ||
                        req.path.startsWith('/api/') ||
                        req.method !== 'GET';
    
    if (isApiRequest) {
        return res.status(401).json({ 
            error: 'Authentication required',
            redirectTo: '/login'
        });
    }
    
    // Otherwise redirect to login
    return res.redirect('/login');
}

// Login handler
function handleLogin(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'changeme123';

    if (username === expectedUsername && password === expectedPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        return res.json({ success: true, message: 'Login successful' });
    } else {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
}

// Logout handler
function handleLogout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
}

module.exports = {
    validateApiKey,
    validateDashboardAuth,
    handleLogin,
    handleLogout
};

