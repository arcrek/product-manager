// Global state
let selectedProducts = new Set();
let allProducts = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadProducts();
    loadTelegramSettings();
    loadApiKeys();
});

// Logout function
async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Get auth headers
function getAuthHeaders() {
    // Basic auth is handled by browser
    return {
        'Content-Type': 'application/json'
    };
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        const data = await response.json();
        
        // Update stats cards
        document.getElementById('totalProducts').textContent = data.stats.total;
        document.getElementById('availableProducts').textContent = data.stats.available;
        document.getElementById('soldProducts').textContent = data.stats.sold;
        
        // Update recent uploads
        const uploadsHtml = data.recentUploads.length > 0
            ? data.recentUploads.map(item => `
                <div class="activity-item">
                    <div class="activity-product">${escapeHtml(item.product)}</div>
                    <div class="activity-meta">${formatDate(item.upload_date)}</div>
                </div>
            `).join('')
            : '<div class="loading">No recent uploads</div>';
        
        document.getElementById('recentUploads').innerHTML = uploadsHtml;
        
        // Update recent sales
        const salesHtml = data.recentSales.length > 0
            ? data.recentSales.map(item => `
                <div class="activity-item">
                    <div class="activity-product">${escapeHtml(item.product)}</div>
                    <div class="activity-meta">Order: ${escapeHtml(item.order_id)} • ${formatDate(item.sold_date)}</div>
                </div>
            `).join('')
            : '<div class="loading">No recent sales</div>';
        
        document.getElementById('recentSales').innerHTML = salesHtml;
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

// Load products
async function loadProducts(status = 'all') {
    try {
        const url = status === 'all' 
            ? '/api/products' 
            : `/api/products?status=${status}`;
        
        const response = await fetch(url);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load products');
        }
        
        const data = await response.json();
        allProducts = data.products;
        
        displayProducts(allProducts);
        
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsBody').innerHTML = `
            <tr><td colspan="7" class="error">Failed to load products</td></tr>
        `;
        showToast('Failed to load products', 'error');
    }
}

// Display products in table
function displayProducts(products) {
    const tbody = document.getElementById('productsBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No products found</td></tr>';
        return;
    }
    
    const html = products.map(product => `
        <tr>
            <td><input type="checkbox" class="product-checkbox" data-id="${product.id}" onchange="updateSelection()"></td>
            <td>${product.id}</td>
            <td title="${escapeHtml(product.product)}">${escapeHtml(truncate(product.product, 50))}</td>
            <td>${formatDate(product.upload_date)}</td>
            <td>
                <span class="badge ${product.is_sold ? 'badge-warning' : 'badge-success'}">
                    ${product.is_sold ? 'Sold' : 'Available'}
                </span>
            </td>
            <td>${product.order_id ? escapeHtml(product.order_id) : '-'}</td>
            <td>
                <button onclick="deleteProduct(${product.id})" class="btn btn-danger btn-small">Delete</button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// Upload file
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/products/upload', {
            method: 'POST',
            body: formData
        });
        
        // Check if we got HTML (redirect to login)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error(data.error || 'Upload failed');
        }
        
        const resultDiv = document.getElementById('uploadResult');
        resultDiv.className = 'result success';
        resultDiv.textContent = `✓ Successfully uploaded ${data.inserted} products${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}`;
        
        showToast(`Successfully uploaded ${data.inserted} products`, 'success');
        
        // Reset and refresh
        fileInput.value = '';
        loadStats();
        loadProducts();
        
    } catch (error) {
        console.error('Error uploading file:', error);
        const resultDiv = document.getElementById('uploadResult');
        resultDiv.className = 'result error';
        resultDiv.textContent = `✗ ${error.message}`;
        showToast(error.message, 'error');
    }
}

// Upload text
async function uploadText() {
    const textInput = document.getElementById('textInput');
    const products = textInput.value;
    
    if (!products.trim()) {
        showToast('Please enter products', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/products/upload-text', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ products })
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error(data.error || 'Upload failed');
        }
        
        const resultDiv = document.getElementById('uploadResult');
        resultDiv.className = 'result success';
        resultDiv.textContent = `✓ Successfully uploaded ${data.inserted} products${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}`;
        
        showToast(`Successfully uploaded ${data.inserted} products`, 'success');
        
        // Reset and refresh
        textInput.value = '';
        loadStats();
        loadProducts();
        
    } catch (error) {
        console.error('Error uploading text:', error);
        const resultDiv = document.getElementById('uploadResult');
        resultDiv.className = 'result error';
        resultDiv.textContent = `✗ ${error.message}`;
        showToast(error.message, 'error');
    }
}

// Filter products
function filterProducts() {
    const status = document.getElementById('statusFilter').value;
    loadProducts(status);
}

// Refresh products
function refreshProducts() {
    const status = document.getElementById('statusFilter').value;
    loadProducts(status);
    loadStats();
    showToast('Refreshed', 'info');
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Delete failed');
        }
        
        showToast('Product deleted successfully', 'success');
        loadStats();
        loadProducts();
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast(error.message, 'error');
    }
}

// Toggle select all
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.product-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateSelection();
}

// Update selection
function updateSelection() {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    selectedProducts.clear();
    
    checkboxes.forEach(checkbox => {
        selectedProducts.add(parseInt(checkbox.dataset.id));
    });
    
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    bulkDeleteBtn.style.display = selectedProducts.size > 0 ? 'block' : 'none';
    
    // Update select all checkbox
    const allCheckboxes = document.querySelectorAll('.product-checkbox');
    const selectAll = document.getElementById('selectAll');
    selectAll.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
}

// Bulk delete
async function bulkDelete() {
    if (selectedProducts.size === 0) {
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} products?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/products/bulk-delete', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ids: Array.from(selectedProducts) })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Bulk delete failed');
        }
        
        showToast(`Successfully deleted ${data.deleted} products`, 'success');
        
        selectedProducts.clear();
        document.getElementById('selectAll').checked = false;
        loadStats();
        loadProducts();
        
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast(error.message, 'error');
    }
}

// Delete by date functionality
let productsToDelete = [];

function showDeleteByDateModal() {
    const modal = document.getElementById('deleteByDateModal');
    modal.classList.add('show');
    
    // Set default date to 7 days ago
    const date = new Date();
    date.setDate(date.getDate() - 7);
    document.getElementById('deleteBeforeDate').value = date.toISOString().split('T')[0];
    
    // Reset preview
    document.getElementById('deleteByDatePreview').classList.remove('show');
    document.getElementById('confirmDeleteBtn').style.display = 'none';
}

function closeDeleteByDateModal() {
    const modal = document.getElementById('deleteByDateModal');
    modal.classList.remove('show');
    productsToDelete = [];
}

async function previewDeleteByDate() {
    const dateInput = document.getElementById('deleteBeforeDate');
    const selectedDate = dateInput.value;
    
    if (!selectedDate) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        // Get all available products
        const response = await fetch('/api/products?status=available');
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        const products = data.products;
        
        // Filter products uploaded before selected date
        const selectedDateTime = new Date(selectedDate + 'T23:59:59').getTime();
        productsToDelete = products.filter(p => {
            const uploadTime = new Date(p.upload_date).getTime();
            return uploadTime <= selectedDateTime;
        });
        
        // Show preview
        const previewDiv = document.getElementById('deleteByDatePreview');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (productsToDelete.length === 0) {
            previewDiv.innerHTML = `
                <div class="preview-count" style="color: #10b981;">
                    ✓ No unsold products found before ${formatDateShort(selectedDate)}
                </div>
            `;
            previewDiv.classList.add('show');
            confirmBtn.style.display = 'none';
        } else {
            const previewItems = productsToDelete.slice(0, 10).map(p => `
                <div class="preview-item">
                    <strong>${escapeHtml(p.product)}</strong><br>
                    <small>Uploaded: ${formatDate(p.upload_date)}</small>
                </div>
            `).join('');
            
            const moreText = productsToDelete.length > 10 
                ? `<div class="preview-item"><em>...and ${productsToDelete.length - 10} more</em></div>` 
                : '';
            
            previewDiv.innerHTML = `
                <div class="preview-count">
                    ⚠️ ${productsToDelete.length} unsold product${productsToDelete.length > 1 ? 's' : ''} will be deleted
                </div>
                <div class="preview-list">
                    ${previewItems}
                    ${moreText}
                </div>
            `;
            previewDiv.classList.add('show');
            confirmBtn.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error previewing delete:', error);
        showToast('Failed to preview products', 'error');
    }
}

async function confirmDeleteByDate() {
    if (productsToDelete.length === 0) {
        return;
    }
    
    const count = productsToDelete.length;
    if (!confirm(`Are you sure you want to delete ${count} unsold product${count > 1 ? 's' : ''}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const ids = productsToDelete.map(p => p.id);
        
        const response = await fetch('/api/products/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Delete failed');
        }
        
        showToast(`Successfully deleted ${data.deleted} products`, 'success');
        
        closeDeleteByDateModal();
        loadStats();
        loadProducts();
        
    } catch (error) {
        console.error('Error deleting products:', error);
        showToast(error.message, 'error');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatDateShort(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Telegram Settings Functions
async function loadTelegramSettings() {
    try {
        const response = await fetch('/api/settings');
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        const settings = data.settings;
        const checker = data.checker;
        
        // Populate form
        document.getElementById('telegram_enabled').checked = settings.telegram_enabled || false;
        document.getElementById('telegram_bot_token').value = settings.telegram_bot_token || '';
        document.getElementById('telegram_chat_id').value = settings.telegram_chat_id || '';
        document.getElementById('stock_threshold').value = settings.stock_threshold || 10;
        document.getElementById('check_interval').value = settings.check_interval || '*/30 * * * *';
        document.getElementById('notify_on_add').checked = settings.notify_on_add !== false;
        document.getElementById('notify_on_sold').checked = settings.notify_on_sold !== false;
        document.getElementById('telegram_header').value = settings.telegram_header || '';
        document.getElementById('telegram_footer').value = settings.telegram_footer || '';
        
        // Show/hide config
        toggleTelegramSettings();
        
        // Update status
        updateCheckerStatus(checker);
        
    } catch (error) {
        console.error('Error loading Telegram settings:', error);
    }
}

function toggleTelegramSettings() {
    const enabled = document.getElementById('telegram_enabled').checked;
    const config = document.getElementById('telegramConfig');
    config.style.display = enabled ? 'block' : 'none';
}

async function saveTelegramSettings() {
    const settings = {
        telegram_enabled: document.getElementById('telegram_enabled').checked,
        telegram_bot_token: document.getElementById('telegram_bot_token').value.trim(),
        telegram_chat_id: document.getElementById('telegram_chat_id').value.trim(),
        stock_threshold: parseInt(document.getElementById('stock_threshold').value),
        check_interval: document.getElementById('check_interval').value,
        notify_on_add: document.getElementById('notify_on_add').checked,
        notify_on_sold: document.getElementById('notify_on_sold').checked,
        telegram_header: document.getElementById('telegram_header').value.trim(),
        telegram_footer: document.getElementById('telegram_footer').value.trim()
    };
    
    // Validate
    if (settings.telegram_enabled) {
        if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
            showToast('Please fill in Bot Token and Chat ID', 'error');
            return;
        }
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save settings');
        }
        
        showToast('Settings saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast(error.message, 'error');
    }
}

async function testTelegram() {
    const bot_token = document.getElementById('telegram_bot_token').value.trim();
    const chat_id = document.getElementById('telegram_chat_id').value.trim();
    const header = document.getElementById('telegram_header').value.trim();
    const footer = document.getElementById('telegram_footer').value.trim();
    
    if (!bot_token || !chat_id) {
        showToast('Please fill in Bot Token and Chat ID', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/settings/telegram/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_token, chat_id, header, footer })
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✓ Test successful! Check your Telegram group.`, 'success');
        } else {
            showToast(`✗ Test failed: ${data.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error testing Telegram:', error);
        showToast('Failed to test Telegram', 'error');
    }
}

async function checkStockNow() {
    try {
        const response = await fetch('/api/settings/check-stock', {
            method: 'POST'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Stock check completed. Current: ${data.currentStock}${data.notificationSent ? ' (notification sent)' : ''}`, 'success');
        } else {
            showToast(`Check failed: ${data.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Error checking stock:', error);
        showToast('Failed to check stock', 'error');
    }
}

async function toggleChecker() {
    const btn = document.getElementById('toggleCheckerBtn');
    const isRunning = btn.textContent.includes('Stop');
    const action = isRunning ? 'stop' : 'start';
    
    try {
        const response = await fetch(`/api/settings/checker/${action}`, {
            method: 'POST'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            btn.textContent = isRunning ? '▶️ Start' : '⏸️ Stop';
            showToast(data.message, 'success');
            
            // Reload settings to update status
            setTimeout(loadTelegramSettings, 500);
        }
        
    } catch (error) {
        console.error('Error toggling checker:', error);
        showToast('Failed to toggle checker', 'error');
    }
}

// API Keys Management Functions
async function loadApiKeys() {
    try {
        const response = await fetch('/api/api-keys');
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        const keys = data.keys;
        const stats = data.stats;
        
        // Update stats
        document.getElementById('totalKeys').textContent = stats.total || 0;
        document.getElementById('activeKeys').textContent = stats.active || 0;
        document.getElementById('totalRequests').textContent = stats.total_requests || 0;
        
        // Display keys
        displayApiKeys(keys);
        
    } catch (error) {
        console.error('Error loading API keys:', error);
        showToast('Failed to load API keys', 'error');
    }
}

function displayApiKeys(keys) {
    const tbody = document.getElementById('apiKeysBody');
    
    if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No API keys found</td></tr>';
        return;
    }
    
    const html = keys.map(key => `
        <tr>
            <td><strong>${escapeHtml(key.name)}</strong>${key.description ? `<br><small>${escapeHtml(key.description)}</small>` : ''}</td>
            <td>
                <code class="key-display" onclick="copyToClipboard('${key.key}')" title="Click to copy">
                    ${key.key.substring(0, 20)}...
                </code>
            </td>
            <td>
                <span class="badge ${key.is_active ? 'badge-success' : 'badge-warning'}">
                    ${key.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${key.usage_count || 0} requests</td>
            <td>${key.last_used ? formatDate(key.last_used) : 'Never'}</td>
            <td>${formatDate(key.created_at)}<br><small>by ${escapeHtml(key.created_by)}</small></td>
            <td>
                <button onclick="toggleApiKey(${key.id}, ${!key.is_active})" class="btn btn-small ${key.is_active ? 'btn-secondary' : 'btn-primary'}" title="${key.is_active ? 'Deactivate' : 'Activate'}">
                    ${key.is_active ? '⏸️' : '▶️'}
                </button>
                <button onclick="editApiKey(${key.id})" class="btn btn-secondary btn-small" title="Edit">✏️</button>
                <button onclick="deleteApiKey(${key.id})" class="btn btn-danger btn-small" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function showCreateKeyModal() {
    const modal = document.getElementById('createKeyModal');
    modal.classList.add('show');
    document.getElementById('keyValue').value = '';
    document.getElementById('keyName').value = '';
    document.getElementById('keyDescription').value = '';
}

function closeCreateKeyModal() {
    const modal = document.getElementById('createKeyModal');
    modal.classList.remove('show');
}

async function createApiKey() {
    const key = document.getElementById('keyValue').value.trim();
    const name = document.getElementById('keyName').value.trim();
    const description = document.getElementById('keyDescription').value.trim();
    
    if (!key) {
        showToast('Please enter an API key', 'error');
        return;
    }
    
    if (!name) {
        showToast('Please enter a key name', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, name, description })
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to import API key');
        }
        
        showToast('API key imported successfully!', 'success');
        closeCreateKeyModal();
        loadApiKeys();
        
    } catch (error) {
        console.error('Error importing API key:', error);
        showToast(error.message, 'error');
    }
}

async function editApiKey(id) {
    try {
        const response = await fetch('/api/api-keys');
        const data = await response.json();
        const key = data.keys.find(k => k.id === id);
        
        if (!key) {
            showToast('Key not found', 'error');
            return;
        }
        
        document.getElementById('editKeyId').value = key.id;
        document.getElementById('editKeyName').value = key.name;
        document.getElementById('editKeyDescription').value = key.description || '';
        document.getElementById('editKeyActive').checked = key.is_active;
        
        const modal = document.getElementById('editKeyModal');
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Error loading key for edit:', error);
        showToast('Failed to load key details', 'error');
    }
}

function closeEditKeyModal() {
    const modal = document.getElementById('editKeyModal');
    modal.classList.remove('show');
}

async function saveApiKey() {
    const id = document.getElementById('editKeyId').value;
    const name = document.getElementById('editKeyName').value.trim();
    const description = document.getElementById('editKeyDescription').value.trim();
    const is_active = document.getElementById('editKeyActive').checked;
    
    if (!name) {
        showToast('Please enter a key name', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/api-keys/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, is_active })
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update API key');
        }
        
        showToast('API key updated successfully!', 'success');
        closeEditKeyModal();
        loadApiKeys();
        
    } catch (error) {
        console.error('Error updating API key:', error);
        showToast(error.message, 'error');
    }
}

async function toggleApiKey(id, activate) {
    try {
        const response = await fetch(`/api/api-keys/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: activate })
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to toggle API key');
        }
        
        showToast(data.message, 'success');
        loadApiKeys();
        
    } catch (error) {
        console.error('Error toggling API key:', error);
        showToast(error.message, 'error');
    }
}

async function deleteApiKey(id) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/api-keys/${id}`, {
            method: 'DELETE'
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete API key');
        }
        
        showToast('API key deleted successfully!', 'success');
        loadApiKeys();
        
    } catch (error) {
        console.error('Error deleting API key:', error);
        showToast(error.message, 'error');
    }
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('API key copied to clipboard!', 'success');
}

function updateCheckerStatus(checker) {
    const statusBox = document.getElementById('checkerStatus');
    const statusContent = document.getElementById('statusContent');
    const toggleBtn = document.getElementById('toggleCheckerBtn');
    
    if (!checker) return;
    
    statusBox.style.display = 'block';
    
    const runningClass = checker.running ? 'success' : 'error';
    const runningText = checker.running ? '✓ Running' : '✗ Stopped';
    const lastCheckText = checker.lastCheck ? new Date(checker.lastCheck).toLocaleString() : 'Never';
    
    statusContent.innerHTML = `
        <div class="status-item">
            <span class="status-label">Status:</span>
            <span class="status-value ${runningClass}">${runningText}</span>
        </div>
        <div class="status-item">
            <span class="status-label">Last Check:</span>
            <span class="status-value">${lastCheckText}</span>
        </div>
        ${checker.lastNotificationCount !== null ? `
        <div class="status-item">
            <span class="status-label">Last Notification:</span>
            <span class="status-value">${checker.lastNotificationCount} products</span>
        </div>
        ` : ''}
    `;
    
    toggleBtn.textContent = checker.running ? '⏸️ Stop' : '▶️ Start';
}

