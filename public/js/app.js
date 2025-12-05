/**
 * ExpressVPN API Dashboard
 * Modern SPA-like interactive dashboard
 */

// --- State ---
const state = {
    activeTab: 'dashboard',
    products: [],
    inventories: [],
    keys: [],
    stats: {},
    selectedProducts: new Set(),
    theme: localStorage.getItem('theme') || 'light'
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    loadInitialData();
    
    // Setup global event listeners
    document.getElementById('dropZone')?.addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput')?.addEventListener('change', handleFileSelect);
    
    // Start polling for stock monitor status
    setInterval(updateMonitorStatus, 30000);
});

function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = state.theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    initTheme();
    // Update chart if exists
    if (window.activityChart) {
        updateChartTheme();
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
            // Close sidebar on mobile selection
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
        });
    });
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        if (document.querySelector('.sidebar').classList.contains('open')) {
            overlay.classList.add('open');
            overlay.style.display = 'block';
        } else {
            overlay.classList.remove('open');
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    }
}

function switchTab(tabId) {
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // Update page title
    document.getElementById('pageTitle').textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
    
    state.activeTab = tabId;
    
    // Refresh data for the tab
    if (tabId === 'products') loadProducts();
    if (tabId === 'inventory') loadInventories();
    if (tabId === 'api-keys') loadApiKeys();
    if (tabId === 'settings') loadSettings();
}

async function loadInitialData() {
    await Promise.all([
        loadInventories(),
        loadStats(),
        loadSettings() // Preload settings for monitor status
    ]);
    
    // If inventories exist, populate filters
    populateInventoryDropdowns();
}

// --- Data Loading ---

async function loadInventories() {
    try {
        const res = await fetch('/api/inventories');
        if (res.status === 401) return window.location.href = '/login';
        const data = await res.json();
        state.inventories = data.inventories;
        
        renderInventories();
        populateInventoryDropdowns();
    } catch (err) {
        showToast('Failed to load inventories', 'error');
    }
}

async function loadProducts(status = 'all', inventoryId = '') {
    try {
        // Build URL
        const filterInv = inventoryId || document.getElementById('productInventoryFilter')?.value || '';
        const filterStatus = status === 'all' ? (document.getElementById('productStatusFilter')?.value || 'all') : status;
        
        let url = '/api/products';
        const params = [];
        if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
        if (filterInv) params.push(`inventory_id=${filterInv}`);
        if (params.length) url += '?' + params.join('&');
        
        const res = await fetch(url);
        const data = await res.json();
        state.products = data.products;
        
        renderProducts();
    } catch (err) {
        showToast('Failed to load products', 'error');
    }
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        state.stats = data;
        
        // Update Dashboard Counters
        updateElement('totalProducts', data.stats.total);
        updateElement('availableProducts', data.stats.available);
        updateElement('soldProducts', data.stats.sold);
        
        // Update API Keys Stats (if on that tab)
        if (state.activeTab === 'api-keys') {
            // We might need to fetch API key stats separately or parse from here if available
        }

        renderRecentActivity(data.recentUploads, data.recentSales);
        renderActivityChart(data.recentSales);
    } catch (err) {
        console.error(err);
    }
}

async function loadApiKeys() {
    try {
        const res = await fetch('/api/api-keys');
        const data = await res.json();
        state.keys = data.keys;
        
        updateElement('activeKeysCount', data.stats.active);
        // updateElement('totalRequestsCount', data.stats.total_requests); // Removed
        
        renderApiKeys();
    } catch (err) {
        showToast('Failed to load API keys', 'error');
    }
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        
        // Populate Form
        const s = data.settings;
        setVal('telegram_bot_token', s.telegram_bot_token);
        setVal('telegram_chat_id', s.telegram_chat_id);
        setVal('telegram_header', s.telegram_header);
        setVal('telegram_footer', s.telegram_footer);
        setVal('stock_threshold', s.stock_threshold);
        setVal('check_interval', s.check_interval);
        
        setCheck('telegram_enabled', s.telegram_enabled);
        setCheck('notify_on_add', s.notify_on_add !== false);
        setCheck('notify_on_sold', s.notify_on_sold !== false);
        
        toggleTelegramSettings();
        updateMonitorUI(data.checker);
    } catch (err) {
        console.error(err);
    }
}

// --- Rendering ---

function renderInventories() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    
    if (state.inventories.length === 0) {
        grid.innerHTML = '<div class="empty-state">No inventories found</div>';
        return;
    }
    
    grid.innerHTML = state.inventories.map(inv => `
        <div class="inventory-card">
            <div class="inv-header">
                <div class="inv-name">${escapeHtml(inv.name)}</div>
                ${inv.id === 1 ? '<span class="badge badge-info">Default</span>' : ''}
            </div>
            <div class="inv-desc">${escapeHtml(inv.description || 'No description')}</div>
            <div class="inv-stats">
                <div class="inv-stat-item">
                    <span class="inv-stat-val">${inv.available_products}</span>
                    <span class="inv-stat-lbl">Available</span>
                </div>
                <div class="inv-stat-item">
                    <span class="inv-stat-val">${inv.sold_products}</span>
                    <span class="inv-stat-lbl">Sold</span>
                </div>
            </div>
            <div class="inv-actions">
                ${inv.name === 'Email Trial' ? `
                    <button onclick="showDeleteByListModal()" class="btn btn-text" style="color:var(--danger)" title="Delete by List"><i class="ph ph-list-dashes"></i> List Del</button>
                ` : ''}
                ${inv.id !== 1 ? `
                    <button onclick="editInventory(${inv.id})" class="btn btn-text" title="Edit"><i class="ph ph-pencil"></i></button>
                    <button onclick="deleteInventory(${inv.id})" class="btn btn-text" style="color:var(--danger)" title="Delete"><i class="ph ph-trash"></i></button>
                ` : ''}
                <button onclick="filterToInventory(${inv.id})" class="btn btn-text" style="margin-left:auto; color:var(--primary)">
                    View Products <i class="ph ph-arrow-right"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function renderProducts() {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    
    if (state.products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = state.products.map(p => {
        const inv = state.inventories.find(i => i.id === p.inventory_id);
        const invName = inv ? inv.name : 'Unknown';
        
        return `
        <tr>
            <td><input type="checkbox" class="product-check" value="${p.id}" onchange="updateBulkSelection()"></td>
            <td>
                <div style="font-weight:500; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.product)}">
                    ${escapeHtml(p.product)}
                </div>
            </td>
            <td><span class="badge badge-info">${escapeHtml(invName)}</span></td>
            <td>
                <span class="badge ${p.is_sold ? 'badge-warning' : 'badge-success'}">
                    ${p.is_sold ? 'Sold' : 'Available'}
                </span>
            </td>
            <td>${new Date(p.upload_date).toLocaleDateString()}</td>
            <td><small>${p.order_id || '-'}</small></td>
            <td>
                <button onclick="deleteProduct(${p.id})" class="btn btn-icon" style="color:var(--danger)"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `}).join('');
}

function renderApiKeys() {
    const tbody = document.getElementById('apiKeysBody');
    if (!tbody) return;
    
    tbody.innerHTML = state.keys.map(k => {
        const invName = k.inventory_name || '-';
        const typeBadge = k.is_kiosk 
            ? `<span class="badge badge-warning"><i class="ph ph-storefront"></i> Kiosk</span>`
            : `<span class="badge badge-info"><i class="ph ph-globe"></i> Full</span>`;
            
        return `
        <tr>
            <td>
                <div style="font-weight:600">${escapeHtml(k.name)}</div>
                <div class="key-preview" onclick="copyToClipboard('${k.key}')" title="Click to copy">
                    ${k.key.substring(0, 12)}...
                </div>
            </td>
            <td>${typeBadge}</td>
            <td>${k.is_kiosk ? invName : '-'}</td>
            <td>
                <span class="badge ${k.is_active ? 'badge-success' : 'badge-gray'}">
                    ${k.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${k.usage_count}</td>
            <td>${new Date(k.created_at).toLocaleDateString()}</td>
            <td>
                <button onclick="showApiUrls(${k.id}, '${escapeHtml(k.key)}')" class="btn btn-icon" title="Show URLs"><i class="ph ph-link"></i></button>
                <button onclick="toggleKey(${k.id}, ${!k.is_active})" class="btn btn-icon">
                    <i class="ph ${k.is_active ? 'ph-pause' : 'ph-play'}"></i>
                </button>
                <button onclick="editKey(${k.id})" class="btn btn-icon"><i class="ph ph-pencil"></i></button>
                <button onclick="deleteKey(${k.id})" class="btn btn-icon" style="color:var(--danger)"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `}).join('');
}

function showApiUrls(id, key) {
    const baseUrl = window.location.origin;
    const stockUrl = `${baseUrl}/input?key=${key}`;
    const productsUrl = `${baseUrl}/input?key=${key}&order_id=ORDER_ID&quantity=QUANTITY`;
    
    document.getElementById('stockUrl').value = stockUrl;
    document.getElementById('productsUrl').value = productsUrl;
    
    // Examples
    document.getElementById('example1Url').textContent = `${baseUrl}/input?key=${key}&order_id=ORD-${Date.now().toString().substr(-4)}&quantity=1`;
    document.getElementById('example5Url').textContent = `${baseUrl}/input?key=${key}&order_id=ORD-${Date.now().toString().substr(-4)}&quantity=5`;
    
    openModal('apiUrlsModal');
}

function copyUrl(elementId) {
    const element = document.getElementById(elementId);
    const text = element.value || element.textContent;
    navigator.clipboard.writeText(text);
    showToast('URL copied to clipboard', 'success');
}

async function editKey(id) {
    try {
        const res = await fetch(`/api/api-keys/${id}`); 
        let key;
        if (res.ok) {
            key = await res.json();
        } else {
            key = state.keys.find(k => k.id === id);
        }
        
        if (!key) return showToast('Key not found', 'error');
        
        document.getElementById('editKeyId').value = key.id;
        document.getElementById('editKeyName').value = key.name;
        document.getElementById('editKeyDescription').value = key.description || '';
        document.getElementById('editKeyActive').checked = key.is_active;
        document.getElementById('editKeyIsKiosk').checked = key.is_kiosk;
        
        populateInventoryDropdowns(); 
        document.getElementById('editKeyInventory').value = key.inventory_id || '';
        
        toggleEditKioskInput();
        openModal('editKeyModal');
    } catch (e) {
        console.error(e);
        showToast('Failed to load key details', 'error');
    }
}

function renderRecentActivity(uploads, sales) {
    const list = document.getElementById('recentActivityList');
    if (!list) return;
    
    // Aggregate activities
    const aggregated = [];
    
    // Group Uploads
    // Key: invId_timeKey (minute precision)
    const uploadGroups = {};
    uploads.forEach(u => {
        const date = new Date(u.upload_date);
        const timeKey = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes();
        const key = `${u.inventory_id}_${timeKey}`;
        
        if (!uploadGroups[key]) {
            uploadGroups[key] = { 
                type: 'upload', 
                inventory_id: u.inventory_id, 
                date: u.upload_date, 
                count: 0 
            };
        }
        uploadGroups[key].count++;
        // Keep the latest date for sorting
        if (new Date(u.upload_date) > new Date(uploadGroups[key].date)) {
            uploadGroups[key].date = u.upload_date;
        }
    });
    
    // Group Sales
    const saleGroups = {};
    sales.forEach(s => {
        const date = new Date(s.sold_date);
        const timeKey = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes();
        const key = `${s.inventory_id}_${timeKey}`; // Could also group by order_id if available
        
        if (!saleGroups[key]) {
            saleGroups[key] = { 
                type: 'sale', 
                inventory_id: s.inventory_id, 
                date: s.sold_date, 
                count: 0 
            };
        }
        saleGroups[key].count++;
        if (new Date(s.sold_date) > new Date(saleGroups[key].date)) {
            saleGroups[key].date = s.sold_date;
        }
    });
    
    // Combine
    const activities = [
        ...Object.values(uploadGroups),
        ...Object.values(saleGroups)
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    if (activities.length === 0) {
        list.innerHTML = '<div class="empty-state">No recent activity</div>';
        return;
    }
    
    list.innerHTML = activities.map(a => {
        const inv = state.inventories.find(i => i.id === a.inventory_id);
        const invName = inv ? inv.name : 'Unknown Inventory';
        const isSale = a.type === 'sale';
        
        const text = isSale 
            ? `Sold <strong>${a.count}</strong> product${a.count > 1 ? 's' : ''} from <strong>${escapeHtml(invName)}</strong>`
            : `Uploaded <strong>${a.count}</strong> product${a.count > 1 ? 's' : ''} to <strong>${escapeHtml(invName)}</strong>`;
            
        return `
        <div class="activity-item">
            <div class="activity-icon" style="color: ${isSale ? 'var(--warning)' : 'var(--primary)'}">
                <i class="ph ${isSale ? 'ph-shopping-cart' : 'ph-upload-simple'}"></i>
            </div>
            <div class="activity-details">
                <span class="activity-text">${text}</span>
                <span class="activity-time">${new Date(a.date).toLocaleString()}</span>
            </div>
        </div>
    `}).join('');
}

function renderActivityChart(sales) {
    const ctx = document.getElementById('activityChart');
    if (!ctx || !sales.length) return;
    
    // Group sales by day for the last 7 days
    const days = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days[d.toLocaleDateString()] = 0;
    }
    
    sales.forEach(s => {
        const date = new Date(s.sold_date).toLocaleDateString();
        if (days[date] !== undefined) days[date]++;
    });
    
    if (window.activityChart instanceof Chart) {
        window.activityChart.destroy();
    }
    
    window.activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(days).map(d => d.split('/')[0] + '/' + d.split('/')[1]),
            datasets: [{
                label: 'Sales',
                data: Object.values(days),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function updateChartTheme() {
    // Re-render chart to pick up font colors if we were doing complex theming, 
    // but basic chart.js adapts reasonably well.
}

// --- Actions ---

// Inventories
function showCreateInventoryModal() { openModal('createInventoryModal'); }

async function createInventory() {
    const name = val('invName');
    const description = val('invDesc');
    
    if (!name) return showToast('Name required', 'error');
    
    try {
        await apiCall('/api/inventories', 'POST', { name, description });
        closeModal('createInventoryModal');
        loadInventories();
        showToast('Inventory created', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteInventory(id) {
    if (!confirm('Delete inventory? Cannot initiate if products exist.')) return;
    try {
        await apiCall(`/api/inventories/${id}`, 'DELETE');
        loadInventories();
        showToast('Inventory deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// Delete by List (Email Trial)
function showDeleteByListModal() {
    openModal('deleteByListModal');
    document.getElementById('deleteListTextarea').value = '';
}

async function deleteByList() {
    const text = document.getElementById('deleteListTextarea').value;
    const list = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (list.length === 0) {
        return showToast('Please enter at least one item', 'error');
    }
    
    if (!confirm(`Delete products matching ${list.length} items?`)) return;
    
    try {
        const res = await fetch('/api/email-trial/delete-by-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list })
        });
        
        if (res.status === 404) {
            // Fallback for development if endpoint name is different or not ready
             throw new Error('Backend endpoint not ready');
        }
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        
        showToast(`Deleted ${data.deleted} products`, 'success');
        closeModal('deleteByListModal');
        loadProducts();
        loadInventories(); // Update counts
    } catch (e) {
        // Fallback to bulk delete if specific endpoint fails? 
        // No, partial match logic is likely server-side.
        // We will try the generic delete-by-list endpoint if the specific one fails
        try {
             const res = await fetch('/api/products/delete-by-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ list })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Deleted ${data.deleted} products`, 'success');
            closeModal('deleteByListModal');
            loadProducts();
            loadInventories();
        } catch (err) {
            showToast(e.message, 'error');
        }
    }
}

function filterToInventory(id) {
    switchTab('products');
    const select = document.getElementById('productInventoryFilter');
    if (select) {
        select.value = id;
        filterProducts();
    }
}

// Products
function filterProducts() {
    loadProducts();
}

function updateBulkSelection() {
    const checks = document.querySelectorAll('.product-check:checked');
    const btn = document.getElementById('bulkDeleteBtn');
    state.selectedProducts = new Set(Array.from(checks).map(c => c.value));
    
    if (btn) btn.style.display = state.selectedProducts.size > 0 ? 'inline-flex' : 'none';
}

function toggleSelectAll() {
    const all = document.getElementById('selectAll').checked;
    document.querySelectorAll('.product-check').forEach(c => c.checked = all);
    updateBulkSelection();
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        await apiCall(`/api/products/${id}`, 'DELETE');
        loadProducts(); // Refresh
        loadStats();
        showToast('Product deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function bulkDelete() {
    const ids = Array.from(state.selectedProducts);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} products?`)) return;
    
    try {
        await apiCall('/api/products/bulk-delete', 'POST', { ids });
        state.selectedProducts.clear();
        loadProducts();
        loadStats();
        showToast('Products deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// Upload
function showUploadModal() {
    openModal('uploadModal');
    switchUploadTab('file');
}

function switchUploadTab(type) {
    document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`upload-${type}-tab`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Find the button that called this... simpler to just query indices or add IDs
    // For now, simple toggle logic:
    const btns = document.querySelectorAll('.tabs .tab-btn');
    if (type === 'file') { btns[0].classList.add('active'); btns[1].classList.remove('active'); }
    else { btns[1].classList.add('active'); btns[0].classList.remove('active'); }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) document.getElementById('selectedFileName').textContent = file.name;
}

async function performUpload() {
    const invId = document.getElementById('uploadInventorySelect').value;
    const fileInput = document.getElementById('fileInput');
    const textInput = document.getElementById('textInput');
    const isFile = document.getElementById('upload-file-tab').classList.contains('active');
    
    try {
        let res;
        if (isFile) {
            if (!fileInput.files[0]) return showToast('Select a file', 'error');
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('inventory_id', invId);
            res = await fetch('/api/products/upload', { method: 'POST', body: formData });
        } else {
            const text = textInput.value;
            if (!text.trim()) return showToast('Enter text', 'error');
            res = await fetch('/api/products/upload-text', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ products: text, inventory_id: parseInt(invId) })
            });
        }
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        showToast(`Uploaded ${data.inserted} products`, 'success');
        closeModal('uploadModal');
        loadProducts();
        loadStats();
    } catch (e) { showToast(e.message, 'error'); }
}

// API Keys
function showCreateKeyModal() { openModal('createKeyModal'); toggleKioskInput(); }
function toggleKioskInput() {
    const isKiosk = document.getElementById('keyIsKiosk').checked;
    document.getElementById('kioskInventorySelect').style.display = isKiosk ? 'block' : 'none';
}

async function createApiKey() {
    const key = val('keyValue');
    const name = val('keyName');
    const isKiosk = document.getElementById('keyIsKiosk').checked;
    const invId = document.getElementById('keyInventory').value;
    
    try {
        await apiCall('/api/api-keys', 'POST', {
            key, name, is_kiosk: isKiosk, inventory_id: isKiosk ? parseInt(invId) : null
        });
        closeModal('createKeyModal');
        loadApiKeys();
        showToast('Key created', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function toggleKey(id, active) {
    try {
        await apiCall(`/api/api-keys/${id}/toggle`, 'PATCH', { is_active: active });
        loadApiKeys();
        showToast(`Key ${active ? 'activated' : 'deactivated'}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteKey(id) {
    if (!confirm('Delete API key?')) return;
    try {
        await apiCall(`/api/api-keys/${id}`, 'DELETE');
        loadApiKeys();
        showToast('Key deleted', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

// Settings
function toggleTelegramSettings() {
    const enabled = document.getElementById('telegram_enabled').checked;
    const form = document.getElementById('telegramConfig');
    if (enabled) form.classList.remove('disabled');
    else form.classList.add('disabled'); 
    // CSS class logic or display none
    form.style.opacity = enabled ? '1' : '0.5';
    form.style.pointerEvents = enabled ? 'all' : 'none';
}

async function saveTelegramSettings() {
    const settings = {
        telegram_enabled: document.getElementById('telegram_enabled').checked,
        telegram_bot_token: val('telegram_bot_token'),
        telegram_chat_id: val('telegram_chat_id'),
        telegram_header: val('telegram_header'),
        telegram_footer: val('telegram_footer'),
        stock_threshold: parseInt(val('stock_threshold')),
        check_interval: val('check_interval'),
        notify_on_add: document.getElementById('notify_on_add').checked,
        notify_on_sold: document.getElementById('notify_on_sold').checked
    };
    
    try {
        await apiCall('/api/settings', 'POST', settings);
        showToast('Settings saved', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function checkStockNow() {
    try {
        const data = await apiCall('/api/settings/check-stock', 'POST');
        showToast(`Stock check complete. Count: ${data.currentStock}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

async function toggleChecker() {
    const badge = document.getElementById('monitorStatusBadge');
    const isRunning = badge.textContent === 'Running';
    const action = isRunning ? 'stop' : 'start';
    
    try {
        const data = await apiCall(`/api/settings/checker/${action}`, 'POST');
        showToast(data.message, 'success');
        updateMonitorUI({ running: !isRunning }); // Optimistic update
        loadSettings(); // Refresh real state
    } catch (e) { showToast(e.message, 'error'); }
}

function updateMonitorUI(checker) {
    const badge = document.getElementById('monitorStatusBadge');
    const btn = document.getElementById('toggleCheckerBtn');
    
    if (checker && checker.running) {
        badge.textContent = 'Running';
        badge.className = 'status-badge success';
        btn.textContent = 'Stop Monitor';
        btn.className = 'btn btn-danger';
    } else {
        badge.textContent = 'Stopped';
        badge.className = 'status-badge';
        btn.textContent = 'Start Monitor';
        btn.className = 'btn btn-primary';
    }
}

// --- Helpers ---

function populateInventoryDropdowns() {
    const options = state.inventories.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
    
    const productFilter = document.getElementById('productInventoryFilter');
    if (productFilter) productFilter.innerHTML = '<option value="">All Inventories</option>' + options;
    
    const uploadSelect = document.getElementById('uploadInventorySelect');
    if (uploadSelect) uploadSelect.innerHTML = options;
    
    const keySelect = document.getElementById('keyInventory');
    if (keySelect) keySelect.innerHTML = options;
    
    const editKeySelect = document.getElementById('editKeyInventory');
    if (editKeySelect) editKeySelect.innerHTML = options;
}

async function apiCall(url, method = 'GET', body = null) {
    const opts = { 
        method, 
        headers: { 'Content-Type': 'application/json' } 
    };
    if (body) opts.body = JSON.stringify(body);
    
    const res = await fetch(url, opts);
    if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

// Modal System
function openModal(id) {
    const m = document.getElementById(id);
    m.classList.add('open');
    setTimeout(() => m.querySelector('.input')?.focus(), 100);
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) e.target.classList.remove('open');
};

// Utilities
function val(id) { return document.getElementById(id)?.value.trim(); }
function setVal(id, v) { const el = document.getElementById(id); if(el) el.value = v || ''; }
function setCheck(id, v) { const el = document.getElementById(id); if(el) el.checked = v; }
function updateElement(id, v) { const el = document.getElementById(id); if(el) el.textContent = v; }
function showToast(msg, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login');
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
}

// Delete By Date Logic
let productsToDeleteByDate = [];

function showDeleteByDateModal() { 
    openModal('deleteByDateModal'); 
    // Set default to 7 days ago
    const d = new Date();
    d.setDate(d.getDate() - 7);
    document.getElementById('deleteBeforeDate').value = d.toISOString().split('T')[0];
    document.getElementById('deletePreview').innerHTML = '';
    document.getElementById('confirmDeleteDateBtn').style.display = 'none';
    productsToDeleteByDate = [];
}

async function previewDeleteByDate() {
    const dateVal = val('deleteBeforeDate');
    if(!dateVal) return showToast('Select date', 'error');
    
    try {
        document.getElementById('deletePreview').innerHTML = '<div class="loading">Scanning products...</div>';
        
        // 1. Get all available products (from all inventories or current context? 
        // Let's stick to ALL available products to be safe, or clarify context. 
        // The original implementation deleted "unsold" products globally based on date.
        // We'll assume global cleanup.)
        
        const res = await fetch('/api/products?status=available');
        if(res.status === 401) return window.location.href = '/login';
        const data = await res.json();
        
        const targetDate = new Date(dateVal + 'T23:59:59').getTime();
        
        productsToDeleteByDate = data.products.filter(p => {
            const uploadTime = new Date(p.upload_date).getTime();
            return uploadTime <= targetDate;
        });
        
        const count = productsToDeleteByDate.length;
        let html = '';
        
        if (count === 0) {
            html = `<div class="empty-state" style="color:var(--success)">No old products found before this date.</div>`;
            document.getElementById('confirmDeleteDateBtn').style.display = 'none';
        } else {
            html = `<div style="margin-bottom:10px; font-weight:600; color:var(--danger)">
                Found ${count} unsold products to delete:
            </div>
            <ul style="max-height:150px; overflow-y:auto; padding-left:20px; color:var(--text-secondary); font-size:0.9rem;">
                ${productsToDeleteByDate.slice(0, 10).map(p => `<li>${escapeHtml(p.product)} <small>(${new Date(p.upload_date).toLocaleDateString()})</small></li>`).join('')}
                ${count > 10 ? `<li>...and ${count - 10} more</li>` : ''}
            </ul>`;
            document.getElementById('confirmDeleteDateBtn').style.display = 'inline-block';
        }
        
        document.getElementById('deletePreview').innerHTML = html;
        
    } catch (e) {
        showToast('Failed to preview: ' + e.message, 'error');
    }
}

async function confirmDeleteByDate() {
    const count = productsToDeleteByDate.length;
    if (count === 0) return;
    
    if (!confirm(`Permanently delete ${count} products?`)) return;
    
    try {
        const ids = productsToDeleteByDate.map(p => p.id);
        await apiCall('/api/products/bulk-delete', 'POST', { ids });
        
        showToast(`Deleted ${count} products`, 'success');
        closeModal('deleteByDateModal');
        
        // Refresh
        loadStats();
        loadProducts(); 
        if(state.activeTab === 'inventory') loadInventories();
        
    } catch (e) {
        showToast(e.message, 'error');
    }
}
