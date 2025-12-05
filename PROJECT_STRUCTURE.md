# 📁 Project Structure

```
expressvpn-api/
│
├── 📄 Configuration Files
│   ├── package.json                        # Node.js dependencies and scripts
│   ├── env.example                         # Environment variables template
│   ├── .gitignore                          # Git ignore rules
│   ├── .dockerignore                       # Docker ignore rules
│   ├── Dockerfile                          # Docker image configuration
│   ├── docker-compose.yml                  # Docker Compose for local dev + Portainer
│   └── docker-compose.portainer-stack.yml  # Portainer stack deployment
│
├── 📚 Documentation
│   ├── README.md                 # Full project documentation
│   ├── PROJECT_STRUCTURE.md      # This file
│   ├── FRONTEND_TODO.md          # Frontend development tasks
│   └── api.md                    # Original API specification
│
├── 🗄️ Database
│   └── data/                     # SQLite database storage
│       ├── .gitkeep              # Keep directory in git
│       ├── products.db           # Main database (products, api_keys, settings)
│       └── sessions.db           # Session store (created at runtime)
│
├── 💻 Backend Source Code
│   └── src/
│       ├── 📁 config/            # Configuration modules
│       │   ├── database.js       # Database setup & prepared statements
│       │   └── init-database.js  # Database initialization script
│       │
│       ├── 📁 middleware/        # Express middleware
│       │   └── auth.js           # API key & session authentication
│       │
│       ├── 📁 utils/             # Utility functions
│       │   ├── cache.js          # In-memory caching
│       │   └── validator.js      # Input validation
│       │
│       ├── 📁 controllers/       # Business logic
│       │   ├── inventory.js      # Inventory API logic
│       │   └── products.js       # Product management logic
│       │
│       ├── 📁 routes/            # Express routes
│       │   ├── api.js            # Main API endpoints
│       │   ├── dashboard.js      # Dashboard API endpoints
│       │   ├── settings.js       # Settings API endpoints
│       │   ├── apiKeys.js        # API key management endpoints
│       │   ├── inventories.js    # Inventory management endpoints
│       │   └── emailTrial.js     # Email Trial specific endpoints
│       │
│       ├── 📁 services/          # Business services
│       │   ├── telegram.js       # Telegram bot integration
│       │   ├── stockChecker.js   # Periodic stock monitoring
│       │   ├── activityMonitor.js # Real-time activity notifications
│       │   ├── settings.js       # Settings management
│       │   ├── apiKeys.js        # API key service
│       │   ├── inventoryService.js # Inventory management service
│       │   └── productMigration.js # Auto product migration & deletion
│       │
│       └── server.js             # Main application entry point
│
└── 🎨 Frontend Dashboard
    └── public/
        ├── login.html            # Login page
        ├── index.html            # Dashboard HTML
        ├── 📁 css/
        │   └── style.css         # Dashboard styles
        └── 📁 js/
            └── app.js            # Dashboard JavaScript

```

## 🔍 File Descriptions

### Core Application Files

#### `src/server.js`
- Main Express application entry point
- Server configuration and middleware setup
- SQLite-based session management (connect-sqlite3)
- Route registration (API, Dashboard, Settings, API Keys)
- Telegram bot and stock checker initialization
- Error handling

#### `src/config/database.js`
- SQLite database connection
- Database schema initialization
- Prepared statements for performance
- Database indexes

#### `src/controllers/inventory.js`
- Get inventory count (with caching)
- Get products and mark as sold (transactional)
- Triggers instant notification when products are sold
- Main API logic as per api.md specification
- Inventory filtering for kiosk mode (NEW!)

#### `src/controllers/products.js`
- Upload products from text (triggers instant notification)
- List products with filters
- Delete single/multiple products
- Delete unsold products by upload date
- Get statistics
- Inventory-specific uploads (NEW!)
- Inventory filtering (NEW!)

#### `src/middleware/auth.js`
- Multiple API key validation for API endpoints (from database)
- Session-based authentication for dashboard
- Request type detection (API vs Dashboard)
- Security middleware
- Inventory context attachment (NEW!)

#### `src/routes/api.js`
- `/input` endpoint for inventory operations
- Handles both count and get products based on params

#### `src/routes/dashboard.js`
- `/api/products/*` endpoints for CRUD operations
- `/api/stats` for dashboard statistics
- File upload handling

#### `src/routes/settings.js`
- Telegram notification settings (bot token, chat ID, thresholds)
- Custom message headers and footers
- Enable/disable notification types

#### `src/routes/apiKeys.js`
- API key CRUD operations
- Import custom API keys
- Activate/deactivate keys
- Usage tracking
- Kiosk mode support (NEW!)

#### `src/routes/inventories.js` (NEW!)
- Inventory CRUD operations
- Create separate product pools
- Inventory statistics
- Inventory management

#### `src/services/telegram.js`
- Telegram bot message sending
- Message formatting with UTC+7 timestamps
- Custom header/footer support
- Notification templates

#### `src/services/stockChecker.js`
- Periodic stock level monitoring (cron-based)
- Low stock alerts
- Out of stock alerts
- Duplicate notification prevention

#### `src/services/activityMonitor.js`
- Real-time product addition notifications
- Real-time product sale notifications
- Event-driven alerts (instant)

#### `src/services/settings.js`
- Application settings storage and retrieval
- Default settings management
- Settings persistence

#### `src/services/apiKeys.js`
- API key validation
- Key usage tracking
- Multiple active key support
- Last used timestamp tracking
- Inventory association (NEW!)
- Kiosk mode validation (NEW!)

#### `src/services/inventoryService.js`
- Inventory CRUD operations
- Inventory statistics
- Validation and constraints
- Integration with products and API keys

#### `src/services/productMigration.js`
- Automated product lifecycle management
- ExpressVPN → Trôi hạn migration (3 days)
- Auto-deletion from Trôi hạn (10 days)
- Cron-based scheduling (hourly checks)
- Telegram notifications for migrations

#### `src/routes/emailTrial.js`
- Email Trial inventory endpoints
- Delete by list functionality
- Partial match support

### Frontend Files

#### `public/login.html`
- Clean, modern login page
- Session-based authentication
- Auto-redirect after successful login

#### `public/index.html`
- Modern, responsive dashboard UI
- Statistics cards
- Product upload forms
- Product management table (scrollable, paginated)
- Recent activity sections
- Telegram notification settings
- API key management interface
- Delete by date functionality

#### `public/css/style.css`
- Modern, gradient design
- Responsive layout
- Card-based UI components
- Professional styling
- Modal dialogs
- Scrollable tables

#### `public/js/app.js`
- Dashboard interactivity
- AJAX calls to backend API
- Real-time updates
- Form handling and validation
- Telegram settings management
- API key CRUD operations
- Session management

### Docker Files

#### `Dockerfile`
- Multi-stage build for optimization
- Alpine Linux base (smaller image)
- Health check configuration
- Production-ready setup

#### `docker-compose.yml`
- Single-service architecture
- Volume mounting for database
- Environment configuration
- Network setup
- Auto-restart policy

### Configuration Files

#### `package.json`
- Project metadata
- Dependencies (Express, SQLite, etc.)
- NPM scripts (start, dev, init-db)

#### `.env.example`
- Environment variable template
- API key configuration
- Dashboard credentials
- Performance settings

## 🎯 Key Features by File

### Performance Features
- **cache.js**: In-memory caching for inventory count
- **database.js**: Prepared statements for fast queries
- **server.js**: Compression and optimization middleware

### Security Features
- **auth.js**: Multiple API key + Session-based authentication
- **validator.js**: Input sanitization and validation
- **server.js**: Helmet.js security headers, rate limiting
- **apiKeys.js**: Secure API key management and validation

### Transaction Safety
- **database.js**: WAL mode for concurrency
- **inventory.js**: Transaction-based product selling
- **products.js**: Bulk operations in transactions

### User Experience
- **app.js**: Real-time updates and notifications
- **style.css**: Modern, intuitive UI design
- **index.html**: Comprehensive dashboard features
- **login.html**: Clean authentication experience

### Notification & Monitoring
- **telegram.js**: Telegram bot integration with custom messages
- **stockChecker.js**: Periodic stock monitoring with smart alerting
- **activityMonitor.js**: Instant notifications for add/sell events
- **settings.js**: Centralized configuration management

### Session Management
- **server.js**: SQLite-based session storage (connect-sqlite3)
- **sessions.db**: Persistent session data (not in-memory)

## 📊 Data Flow

### API Request Flow
```
Client → server.js → middleware/auth.js (validates API key from database)
  → (attaches inventory context if kiosk mode)
  → routes/api.js → controllers/inventory.js 
  → (filters by inventory if kiosk)
  → config/database.js → SQLite
  → (if sold) activityMonitor.notifyProductSold → telegram.js
```

### Dashboard Flow
```
Browser → public/login.html → server.js (session authentication)
  → public/index.html → public/js/app.js 
  → server.js → middleware/auth.js (checks session)
  → routes/dashboard.js → controllers/products.js 
  → config/database.js → SQLite
```

### Notification Flow (Real-time)
```
Product Upload/Sale → activityMonitor.notifyProductAdded/Sold
  → settings.js (check if enabled) → telegram.js 
  → Telegram Bot API → User's Telegram
```

### Notification Flow (Periodic)
```
Cron Job (stockChecker.js) → Check stock level
  → Compare with threshold → telegram.js (if alert needed)
  → Telegram Bot API → User's Telegram
  (Duplicate prevention via state tracking)
```

## 🔄 Typical Operations

### Upload Products
```
Dashboard UI → app.js (uploadFile/uploadText) 
  → /api/products/upload → products.js (uploadProducts)
  → database.js (transaction) → SQLite → Response → UI Update
```

### Get Products (API)
```
External System → /input?key=X&order_id=Y&quantity=Z
  → auth.js (validateApiKey) → inventory.js (getProducts)
  → database.js (transaction: select + update) 
  → SQLite → JSON Response
```

### Delete Products
```
Dashboard UI → app.js (deleteProduct/bulkDelete/deleteByDate)
  → /api/products/:id or /api/products/bulk-delete or /api/products/delete-by-date
  → products.js → database.js → SQLite 
  → Response → UI Refresh
```

### Import API Key
```
Dashboard UI → app.js (importApiKey modal)
  → /api/api-keys → routes/apiKeys.js
  → services/apiKeys.js (validate & insert)
  → database.js → SQLite → Response → UI Refresh
```

### Configure Telegram Notifications
```
Dashboard UI → app.js (saveTelegramSettings)
  → /api/settings/telegram → routes/settings.js
  → services/settings.js (save config)
  → database.js → SQLite
  → stockChecker.js updates interval if changed
```

### Test Telegram Connection
```
Dashboard UI → app.js (testTelegram button)
  → /api/settings/telegram/test → routes/settings.js
  → telegram.js (send test message)
  → Telegram Bot API → Response (success/failure)
```

## 🛠️ Extensibility Points

### Adding New API Endpoints
1. Add controller function in `src/controllers/`
2. Add route in `src/routes/`
3. Update documentation

### Adding New Dashboard Features
1. Update HTML in `public/index.html`
2. Add styles in `public/css/style.css`
3. Add JavaScript in `public/js/app.js`
4. Create backend API if needed

### Changing Database Schema
1. Update schema in `src/config/database.js`
2. Update prepared statements
3. Add migration logic if needed
4. Update controllers

### Adding Authentication Methods
1. Add new middleware in `src/middleware/auth.js`
2. Apply to routes as needed
3. Update frontend if necessary

### Adding New Notification Channels
1. Create new service in `src/services/` (e.g., `discord.js`, `slack.js`)
2. Add configuration in `src/services/settings.js`
3. Integrate in `activityMonitor.js` and `stockChecker.js`
4. Add UI controls in dashboard

### Customizing Notification Logic
1. Modify `src/services/activityMonitor.js` for instant alerts
2. Modify `src/services/stockChecker.js` for periodic checks
3. Update message templates in `src/services/telegram.js`
4. Add new notification types in settings schema

### Changing Session Store
1. Update session configuration in `src/server.js`
2. Choose from: Redis, MongoDB, PostgreSQL stores
3. Update dependencies in `package.json`

---
