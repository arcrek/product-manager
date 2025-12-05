# 📦 Product Manager - Multi-Inventory Management System

A lightweight, ultra-fast product inventory management system with RESTful API and beautiful dashboard. Built with Node.js, Express, and SQLite for managing multiple product inventories with automatic expiration and migration.

## ✨ Features

- **Ultra-Fast API**: < 10ms response time for inventory queries
- **Lightweight Database**: SQLite with optimized queries and indexing
- **Beautiful Dashboard**: Modern, responsive UI for product management
- **Docker Ready**: Full Docker and Docker Compose support with Portainer stack
- **Secure**: Multiple API key management + Session-based authentication for dashboard
- **RESTful API**: Clean API design following best practices
- **Transaction Safety**: ACID-compliant operations
- **Caching**: Smart caching for optimal performance
- **Telegram Notifications**: Real-time stock alerts and activity notifications
- **Smart Monitoring**: Periodic stock checks with customizable thresholds
- **Date-Based Management**: Delete unsold products by upload date
- **🏪 Kiosk Mode**: Create separate inventories with isolated API key access
- **Multiple Inventories**: Manage different product pools independently
- **Auto Product Migration**: Automatic ExpressVPN product expiration workflow
- **Sub-Inventories**: Hierarchical inventory structure (e.g., "Trôi hạn" under "ExpressVPN")

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd expressvpn-api
```

2. **Create environment file**
```bash
# Windows:
copy env.example .env

# Linux/Mac:
cp env.example .env
```

3. **Edit `.env` file with your configuration**
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

4. **Start with Docker Compose**
```bash
docker-compose up -d
```

5. **Access the application**
- Login Page: http://localhost:3000/login.html
- Dashboard: http://localhost:3000 (after login)
- API: http://localhost:3000/input?key=YOUR_API_KEY

### Option 3: Deploy to Portainer

Use the included `docker-compose.portainer-stack.yml` file to deploy as a stack in Portainer.

1. **Copy stack content**
```bash
cat docker-compose.portainer-stack.yml
```

2. **In Portainer UI**:
   - Go to Stacks → Add Stack
   - Paste the compose file content
   - Configure environment variables
   - Deploy

### Option 2: Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Create environment file**
```bash
# Windows:
copy env.example .env

# Linux/Mac:
cp env.example .env
```

3. **Initialize database**
```bash
npm run init-db
```

4. **Start the server**
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

## 📖 API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication
All API endpoints require an API key passed as a query parameter:
```
?key=YOUR_API_KEY
```

### Endpoints

#### 1. Get Inventory Count
Get the total number of available products.

**Request:**
```http
GET /input?key={api_key}
```

**Response:**
```json
{
  "sum": 150
}
```

#### 2. Get Products (Sell Products)
Retrieve and mark products as sold in a single transaction.

**Request:**
```http
GET /input?key={api_key}&order_id={order_id}&quantity={quantity}
```

**Parameters:**
- `key` (required): API authentication key
- `order_id` (required): Order identifier
- `quantity` (required): Number of products to retrieve (1-200)

**Response:**
```json
[
  {"product": "Product 1"},
  {"product": "Product 2"},
  {"product": "Product 3"}
]
```

**Error Responses:**
```json
// No products available
{
  "error": "No products available"
}

// Insufficient stock
{
  "error": "Insufficient stock. Only 5 products available"
}

// Invalid API key
{
  "error": "Invalid API key"
}
```

#### 3. Health Check
Check if the API is running.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

## 🎨 Dashboard Features

Access the dashboard at `http://localhost:3000` with Basic Authentication.

### Features:
- **📊 Real-time Statistics**: View total, available, and sold products
- **📤 Upload Products**: Upload via text file or paste directly
- **📋 Product Management**: View, filter, and delete products (scrollable, paginated list)
- **🔍 Filter & Search**: Filter by status (available/sold)
- **🗑️ Bulk Delete**: Select and delete multiple products
- **📅 Date-Based Deletion**: Delete unsold products by upload date
- **🔑 API Key Management**: Create, import, activate/deactivate multiple API keys
- **🏪 Inventory Management**: Create and manage separate inventories
- **🔒 Kiosk API Keys**: Restrict API keys to specific inventories
- **⏱️ Auto Expiration**: Products automatically migrate and expire based on age
- **🗑️ Delete by List**: Email Trial inventory supports batch deletion with partial matching
- **📱 Telegram Integration**: Configure bot notifications with custom headers/footers
- **⚡ Real-time Notifications**: Instant alerts when products are added or sold
- **📉 Stock Monitoring**: Periodic checks for low stock and out-of-stock alerts (UTC+7 timezone)
- **📥 Recent Activity**: Track recent uploads and sales

### Upload Product Format
Products should be in plain text format, one product per line:

```text
Product 1
Product 2
Product 3
...
```

## 🏗️ Project Structure

```
expressvpn-api/
├── src/
│   ├── config/
│   │   ├── database.js          # Database configuration
│   │   └── init-database.js     # Database initialization
│   ├── controllers/
│   │   ├── inventory.js         # Inventory API logic
│   │   └── products.js          # Product management logic
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   ├── routes/
│   │   ├── api.js               # Main API routes
│   │   ├── dashboard.js         # Dashboard API routes
│   │   ├── settings.js          # Settings API routes
│   │   ├── apiKeys.js           # API key management routes
│   │   ├── inventories.js       # Inventory management routes
│   │   └── emailTrial.js        # Email Trial specific routes
│   ├── services/
│   │   ├── telegram.js          # Telegram bot integration
│   │   ├── stockChecker.js      # Periodic stock monitoring
│   │   ├── activityMonitor.js   # Real-time activity notifications
│   │   ├── settings.js          # Settings management
│   │   ├── apiKeys.js           # API key service
│   │   ├── inventoryService.js  # Inventory management service
│   │   └── productMigration.js  # Auto product migration & deletion
│   ├── utils/
│   │   ├── cache.js             # Caching utility
│   │   └── validator.js         # Input validation
│   └── server.js                # Main application entry
├── public/
│   ├── css/
│   │   └── style.css            # Dashboard styles
│   ├── js/
│   │   └── app.js               # Dashboard JavaScript
│   ├── index.html               # Dashboard HTML
│   └── login.html               # Login page
├── data/                        # SQLite database storage (products.db, sessions.db)
├── Dockerfile                   # Docker configuration
├── docker-compose.yml           # Docker Compose for local dev + Portainer
├── docker-compose.portainer-stack.yml  # Portainer stack deployment
├── package.json                 # Node.js dependencies
├── env.example                  # Environment variables template
├── README.md                    # This file
├── PROJECT_STRUCTURE.md         # Project structure documentation
└── FRONTEND_TODO.md             # Frontend development tasks
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `production` |
| `DB_PATH` | SQLite database file path | `./data/products.db` |
| `ADMIN_USERNAME` | Dashboard username | `admin` |
| `ADMIN_PASSWORD` | Dashboard password | `changeme123` |
| `SESSION_SECRET` | Session encryption secret | `supersecretkey` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | - |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID (optional) | - |
| `ENABLE_CACHE` | Enable inventory count caching | `true` |
| `CACHE_TTL` | Cache TTL in seconds | `60` |

**Note**: API keys are now managed through the dashboard, not environment variables.

## 🗄️ Database Schema

```sql
-- Inventories table
CREATE TABLE inventories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES inventories(id)
);

-- Default inventories: ExpressVPN, Email Trial, Trôi hạn (sub-inventory)

-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    inventory_id INTEGER DEFAULT 1,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_sold BOOLEAN DEFAULT 0,
    order_id TEXT NULL,
    sold_date DATETIME NULL,
    FOREIGN KEY (inventory_id) REFERENCES inventories(id)
);

CREATE INDEX idx_is_sold ON products(is_sold);
CREATE INDEX idx_upload_date ON products(upload_date);
CREATE INDEX idx_inventory_id ON products(inventory_id);
CREATE INDEX idx_inventory_sold ON products(inventory_id, is_sold);

-- API keys table
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    inventory_id INTEGER DEFAULT NULL,
    is_kiosk BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,
    FOREIGN KEY (inventory_id) REFERENCES inventories(id)
);

CREATE INDEX idx_api_key ON api_keys(key);
CREATE INDEX idx_is_active ON api_keys(is_active);
CREATE INDEX idx_inventory_id ON api_keys(inventory_id);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Sessions table (managed by connect-sqlite3)
CREATE TABLE sessions (
    sid TEXT PRIMARY KEY,
    expired INTEGER NOT NULL,
    sess TEXT NOT NULL
);
```

**Default Inventories**:
- **ExpressVPN**: Main inventory with auto-expiration (3 days → Trôi hạn)
- **Email Trial**: Email trial accounts with delete-by-list support
- **Trôi hạn**: Sub-inventory under ExpressVPN (auto-deleted after 10 days)

**Note**: Database migration is automatic. When you upgrade, the system will:
- Create the `inventories` table with default inventories
- Add `inventory_id` column to `products` (existing products → ExpressVPN inventory)
- Add `inventory_id` and `is_kiosk` columns to `api_keys` (existing keys → full access)
- Start the auto-migration service for ExpressVPN products

## 🐳 Docker Commands

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build

# Remove volumes (⚠️ deletes database)
docker-compose down -v
```

## 📊 Performance

- **API Response Time**: < 10ms (inventory count)
- **API Response Time**: < 50ms (get products with transaction)
- **Max Products**: 200 (recommended limit)
- **Concurrent Requests**: 50-100 req/sec
- **Docker Image Size**: < 150MB
- **Memory Usage**: < 100MB
- **Startup Time**: < 2 seconds

## 🔒 Security

- ✅ API key authentication for all API endpoints
- ✅ Basic authentication for dashboard
- ✅ Rate limiting (100 req/min for API, 200 req/15min for dashboard)
- ✅ Helmet.js for security headers
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (prepared statements)
- ✅ File upload restrictions

## 🧪 Testing

### Test API Endpoints

```bash
# Test inventory count
curl "http://localhost:3000/input?key=YOUR_API_KEY"

# Test get products
curl "http://localhost:3000/input?key=YOUR_API_KEY&order_id=ORDER123&quantity=5"

# Test health check
curl "http://localhost:3000/health"
```

### Test Dashboard
1. Navigate to http://localhost:3000
2. Login with credentials from `.env`
3. Upload sample products
4. Test filtering, deletion, etc.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Initialize/reset database
npm run init-db
```

## 📝 Sample Product Data

Create a file `sample-products.txt`:

```text
ExpressVPN Premium Account 1 Year
ExpressVPN Premium Account 6 Months
ExpressVPN Premium Account 3 Months
NordVPN Premium Account 1 Year
NordVPN Premium Account 6 Months
Surfshark VPN Premium 1 Year
Surfshark VPN Premium 6 Months
```

Upload via dashboard or API.

## 📱 Telegram Notifications

The system supports real-time Telegram notifications for inventory activities.

### Setup

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow instructions
   - Copy the bot token

2. **Get Chat ID**:
   - Add your bot to a group or message it directly
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the `chat.id` in the response

3. **Configure in Dashboard**:
   - Go to Settings section
   - Enter Bot Token and Chat ID
   - Set low stock threshold
   - Set check interval (in minutes)
   - Customize message header/footer (optional)
   - Enable notification types

### Notification Types

- **Products Added**: Instant notification when products are uploaded
- **Products Sold**: Instant notification when products are sold (includes Order ID)
- **Low Stock Alert**: Periodic check triggers when stock is low
- **Out of Stock Alert**: Periodic check triggers when no products available

### Custom Messages

You can add custom header and footer text to all Telegram notifications:

```
Header: 🏪 VPN Store Notification
Footer: Visit dashboard: https://yourdomain.com
```

All timestamps are displayed in **UTC+7** timezone.

## 🔑 API Key Management

API keys are managed through the dashboard instead of environment variables.

### Features

- **Multiple Keys**: Support for multiple active API keys
- **Manual Import**: Import your own API keys (no auto-generation)
- **Usage Tracking**: Track last used time and usage count for each key
- **Activate/Deactivate**: Enable or disable keys without deletion
- **Dashboard UI**: Manage all keys from the dashboard
- **🏪 Kiosk Mode**: Restrict API keys to specific inventories (NEW!)

### Using API Keys

1. **Import a Key**:
   - Go to API Keys section in dashboard
   - Click "Import API Key"
   - Enter your key and optional name
   - (Optional) Enable "Kiosk Mode" and select an inventory
   - Click Import

2. **Use in API Calls**:
   ```bash
   curl "http://localhost:3000/input?key=YOUR_API_KEY"
   ```

3. **Monitor Usage**:
   - View usage count and last used time in dashboard
   - Deactivate compromised keys instantly

## 🏪 Kiosk Mode & Multiple Inventories

Create separate inventories and associate API keys with specific inventories for complete isolation.

### What is Kiosk Mode?

Kiosk mode allows you to:
- Create multiple separate inventories
- Assign each API key to a specific inventory
- Ensure complete isolation between different product pools
- Perfect for managing multiple resellers or product lines

### Use Cases

1. **Multiple Resellers**: Each reseller gets their own inventory and kiosk API key
2. **Different Product Lines**: Separate inventories for different VPN products
3. **Regional Separation**: Different inventories for different regions
4. **Testing**: Separate test inventory from production

### Quick Setup

1. **Create an Inventory** (via dashboard or API):
   ```bash
   curl -X POST http://localhost:3000/api/inventories \
     -H "Content-Type: application/json" \
     -d '{"name":"Reseller A","description":"Products for Reseller A"}'
   ```

2. **Create a Kiosk API Key**:
   ```bash
   curl -X POST http://localhost:3000/api/api-keys \
     -H "Content-Type: application/json" \
     -d '{
       "key":"reseller-a-key-123",
       "name":"Reseller A Key",
       "is_kiosk":true,
       "inventory_id":2
     }'
   ```

3. **Upload Products to Specific Inventory**:
   ```bash
   curl -X POST http://localhost:3000/api/products \
     -H "Content-Type: application/json" \
     -d '{"products":"product1\nproduct2","inventory_id":2}'
   ```

4. **Use Kiosk API Key** (automatically filtered to assigned inventory):
   ```bash
   curl "http://localhost:3000/input?key=reseller-a-key-123"
   # Only returns products from inventory 2
   ```

### Key Benefits

- ✅ **Complete Isolation**: Kiosk keys can only see their assigned inventory
- ✅ **Easy Management**: Manage multiple inventories from one dashboard
- ✅ **Backward Compatible**: Existing API keys continue to work as before
- ✅ **Flexible**: Mix kiosk and full-access keys as needed

## ⏱️ Automated Product Lifecycle

The system includes automated product management for ExpressVPN inventory:

### ExpressVPN Auto-Migration
- Products uploaded to **ExpressVPN** inventory
- After **3 days**, automatically moved to **Trôi hạn** sub-inventory
- After **10 days** in Trôi hạn, automatically deleted
- Runs hourly via cron scheduler
- Telegram notifications for all migrations and deletions

### Example Timeline
```
Day 0:  Product uploaded to ExpressVPN
Day 3:  Automatically moved to Trôi hạn
Day 13: Automatically deleted from Trôi hạn
```

### API Key Access
- API keys can be assigned to either ExpressVPN or Trôi hạn independently
- Example: Reseller A sees ExpressVPN products, Reseller B sees Trôi hạn products

## 🗑️ Delete by List (Email Trial)

Email Trial inventory supports batch deletion with partial matching:

### Features
- Delete multiple products by providing a list
- Supports exact matches: `email@domain.com|password123`
- Supports partial matches: Just `email@domain.com` will match the full product
- Perfect for cleaning up invalid or used trial accounts

### API Endpoint
```bash
POST /api/dashboard/products/delete-by-list
Content-Type: application/json

{
  "list": "email1@domain.com\nemail2@domain.com\nemail3@domain.com|password"
}
```

### Response
```json
{
  "success": true,
  "deleted": 5,
  "processed": 3
}
```

## 🐛 Troubleshooting

### Database Lock Error
```bash
# Stop the server and remove WAL files
rm data/*.db-wal data/*.db-shm
```

### Port Already in Use
```bash
# Change PORT in .env file or stop conflicting service
lsof -ti:3000 | xargs kill -9
```

### Docker Permission Issues
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/
```

### Session Issues (Not Logged In)
```bash
# Clear sessions database
rm data/sessions.db
# Restart server
docker-compose restart
```

### Telegram Notifications Not Working
```bash
# Test bot token and chat ID
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test"

# Check dashboard settings - ensure:
# 1. Bot token is correct
# 2. Chat ID is correct
# 3. Notifications are enabled
# 4. At least one notification type is enabled
```

### Duplicate Notifications
The system now prevents duplicate out-of-stock notifications. If you're still seeing duplicates:
```bash
# Restart the server to reset notification state
docker-compose restart
```

## 📄 License

ISC

## 👨‍💻 Support

For issues and questions, please create an issue in the repository.

---

**Built with ❤️ using Node.js, Express, and SQLite**

