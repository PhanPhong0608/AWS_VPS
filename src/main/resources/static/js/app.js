// AWS-Integrated VPS Rental Platform Frontend Engine

const API_BASE = '/api';

// ==========================================
// ENVIRONMENT MODE & MOCK DATABASE BACKEND
// ==========================================
let currentMode = localStorage.getItem('appMode') || 'mock';

function getMockDB() {
    let db = localStorage.getItem('mock_db');
    if (!db) {
        db = {
            users: {},
            vps: [],
            transactions: []
        };
        // Add a default demo user so they can login immediately
        db.users['demo'] = {
            password: 'password',
            email: 'demo@vpsrental.com',
            balance: 100.0,
            verified: true,
            avatarUrl: ''
        };
        // Add a default VPS instance to the demo user
        db.vps.push({
            id: 1,
            instanceId: 'i-0b2f913d8a4f910ce',
            name: 'demo-web-server',
            instanceType: 't3.micro',
            osType: 'UBUNTU',
            publicIp: '13.250.45.12',
            status: 'RUNNING',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            owner: 'demo'
        });
        db.transactions.push({
            id: 1,
            username: 'demo',
            type: 'DEPOSIT',
            amount: 100.0,
            description: 'Initial Signup Bonus (Simulated)',
            date: new Date().toISOString()
        });
        saveMockDB(db);
    } else {
        db = JSON.parse(db);
    }
    return db;
}

function saveMockDB(db) {
    localStorage.setItem('mock_db', JSON.stringify(db));
}

function updateVpsStateTransitions(db) {
    const now = Date.now();
    let modified = false;
    db.vps.forEach(v => {
        if (v.stateUpdatedAt) {
            const diff = now - v.stateUpdatedAt;
            if (diff >= 3000) { // 3 seconds transition
                if (v.status === 'PENDING') {
                    v.status = 'RUNNING';
                    if (v.publicIp === 'Initializing...') {
                        v.publicIp = `18.141.${Math.floor(Math.random()*254)+1}.${Math.floor(Math.random()*254)+1}`;
                    }
                    if (v.instanceId === 'AWS Pending') {
                        v.instanceId = `i-${Math.random().toString(16).substr(2, 17)}`;
                    }
                    delete v.stateUpdatedAt;
                    modified = true;
                } else if (v.status === 'STOPPING') {
                    v.status = 'STOPPED';
                    delete v.stateUpdatedAt;
                    modified = true;
                } else if (v.status === 'REBOOTING') {
                    v.status = 'RUNNING';
                    delete v.stateUpdatedAt;
                    modified = true;
                }
            }
        }
    });
    if (modified) {
        saveMockDB(db);
    }
}

function makeResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function makeTextResponse(status, text) {
    return new Response(text, {
        status: status,
        headers: { 'Content-Type': 'text/plain' }
    });
}

function generateGradientAvatar(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // Draw gradient
    const grad = ctx.createLinearGradient(0, 0, 100, 100);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#a855f7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 100, 100);
    
    // Draw text
    ctx.font = 'bold 45px Outfit';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = name ? name.substring(0, 2).toUpperCase() : 'US';
    ctx.fillText(initials, 50, 50);
    
    return canvas.toDataURL();
}

async function handleMockRequest(url, init = {}) {
    const db = getMockDB();
    await new Promise(resolve => setTimeout(resolve, 300)); // Network simulation latency

    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const method = (init.method || 'GET').toUpperCase();

    // Check Authorization header
    let authHeader = '';
    if (init.headers) {
        if (init.headers['Authorization']) authHeader = init.headers['Authorization'];
        else if (init.headers.Authorization) authHeader = init.headers.Authorization;
    }
    
    let loggedInUser = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (token && token !== 'null' && token !== 'undefined') {
            loggedInUser = localStorage.getItem('username') || 'demo';
        }
    }

    if (path === '/api/auth/register' && method === 'POST') {
        const { username, email, password } = JSON.parse(init.body);
        if (!username || !email || !password) {
            return makeTextResponse(400, 'All fields are required');
        }
        if (db.users[username]) {
            return makeTextResponse(400, 'Username already exists');
        }
        db.users[username] = {
            password,
            email,
            balance: 100.0, // Initial balance for testing VPS purchases
            verified: false,
            avatarUrl: ''
        };
        saveMockDB(db);
        return makeResponse(200, { message: 'Registration initiated' });
    }

    if (path === '/api/auth/confirm' && method === 'POST') {
        const { username, code } = JSON.parse(init.body);
        if (!db.users[username]) {
            return makeTextResponse(404, 'User not found');
        }
        if (code === '123456') {
            db.users[username].verified = true;
            
            // Add Initial deposit txn log
            db.transactions.push({
                id: db.transactions.length + 1,
                username: username,
                type: 'DEPOSIT',
                amount: 100.0,
                description: 'Sign-up Bonus (Simulated)',
                date: new Date().toISOString()
            });

            saveMockDB(db);
            return makeResponse(200, { message: 'Verification successful' });
        } else {
            return makeTextResponse(400, 'Invalid verification code');
        }
    }

    if (path === '/api/auth/login' && method === 'POST') {
        const { username, password } = JSON.parse(init.body);
        if (!db.users[username]) {
            return makeTextResponse(400, 'Invalid credentials');
        }
        if (!db.users[username].verified) {
            return makeTextResponse(400, 'Account not verified. Verification code sent.');
        }
        if (db.users[username].password !== password) {
            return makeTextResponse(400, 'Invalid credentials');
        }
        return makeResponse(200, {
            accessToken: 'mock-access-token',
            idToken: 'mock-id-token',
            refreshToken: 'mock-refresh-token'
        });
    }

    if (!loggedInUser) {
        return makeTextResponse(401, 'Unauthorized');
    }

    if (path === '/api/users/me' && method === 'GET') {
        const u = db.users[loggedInUser];
        return makeResponse(200, {
            username: loggedInUser,
            email: u.email,
            balance: u.balance,
            avatarUrl: u.avatarUrl || generateGradientAvatar(loggedInUser)
        });
    }

    if (path === '/api/users/me/avatar' && method === 'POST') {
        let avatarUrl = '';
        try {
            const file = init.body.get('file');
            if (file && file instanceof File) {
                avatarUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });
            } else {
                avatarUrl = generateGradientAvatar(loggedInUser);
            }
        } catch (e) {
            avatarUrl = generateGradientAvatar(loggedInUser);
        }
        db.users[loggedInUser].avatarUrl = avatarUrl;
        saveMockDB(db);
        return makeResponse(200, { avatarUrl });
    }

    if (path === '/api/payment/deposit' && method === 'POST') {
        const { amount, description } = JSON.parse(init.body);
        const depAmt = parseFloat(amount);
        if (isNaN(depAmt) || depAmt <= 0) {
            return makeTextResponse(400, 'Invalid deposit amount');
        }
        
        db.users[loggedInUser].balance = parseFloat(db.users[loggedInUser].balance) + depAmt;
        db.transactions.push({
            id: db.transactions.length + 1,
            username: loggedInUser,
            type: 'DEPOSIT',
            amount: depAmt,
            description: description || 'Simulated Portal Deposit',
            date: new Date().toISOString()
        });
        saveMockDB(db);
        return makeResponse(200, { message: 'Success' });
    }

    if (path === '/api/users/me/transactions' && method === 'GET') {
        const list = db.transactions.filter(t => t.username === loggedInUser);
        const sortedList = [...list].reverse();
        return makeResponse(200, sortedList);
    }

    if (path === '/api/vps' && method === 'GET') {
        updateVpsStateTransitions(db);
        const list = db.vps.filter(v => v.owner === loggedInUser);
        return makeResponse(200, list);
    }

    if (path === '/api/vps/rent' && method === 'POST') {
        const { name, instanceType, osType } = JSON.parse(init.body);
        const pricing = { 't2.micro': 5.0, 't3.micro': 8.0, 't3.medium': 20.0 };
        const price = pricing[instanceType] || 10.0;

        const currentBalance = parseFloat(db.users[loggedInUser].balance);
        if (currentBalance < price) {
            return makeTextResponse(400, `Insufficient wallet balance. Cost: $${price.toFixed(2)}`);
        }

        db.users[loggedInUser].balance = currentBalance - price;
        db.transactions.push({
            id: db.transactions.length + 1,
            username: loggedInUser,
            type: 'RENT',
            amount: -price,
            description: `VPS Rental: ${name} (${instanceType})`,
            date: new Date().toISOString()
        });

        const newVps = {
            id: db.vps.length + 1,
            instanceId: 'AWS Pending',
            name: name,
            instanceType: instanceType,
            osType: osType,
            publicIp: 'Initializing...',
            status: 'PENDING',
            monthlyPrice: price,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            owner: loggedInUser,
            stateUpdatedAt: Date.now()
        };
        db.vps.push(newVps);
        saveMockDB(db);
        return makeResponse(200, newVps);
    }

    const match = path.match(/^\/api\/vps\/(\d+)\/(\w+)$/);
    if (match) {
        const id = parseInt(match[1]);
        const action = match[2];
        const vpsIndex = db.vps.findIndex(v => v.id === id && v.owner === loggedInUser);
        if (vpsIndex === -1) {
            return makeTextResponse(404, 'VPS Instance not found');
        }
        
        const vps = db.vps[vpsIndex];
        if (action === 'start') {
            vps.status = 'PENDING';
            vps.stateUpdatedAt = Date.now();
        } else if (action === 'stop') {
            vps.status = 'STOPPING';
            vps.stateUpdatedAt = Date.now();
        } else if (action === 'reboot') {
            vps.status = 'REBOOTING';
            vps.stateUpdatedAt = Date.now();
        } else if (action === 'sync') {
            updateVpsStateTransitions(db);
        } else if (action === 'delete') {
            db.vps.splice(vpsIndex, 1);
            saveMockDB(db);
            return makeResponse(200, { message: 'VPS deleted successfully' });
        }
        
        saveMockDB(db);
        return makeResponse(200, db.vps[vpsIndex]);
    }

    return makeTextResponse(404, 'Not Found');
}

// Global fetch interceptor for Mock Mode
const originalFetch = window.fetch;
window.fetch = async function(resource, init) {
    if (currentMode === 'mock' && typeof resource === 'string' && resource.startsWith('/api')) {
        return handleMockRequest(resource, init);
    }
    return originalFetch(resource, init);
};

// Auto detect mode based on network availability
async function autoDetectMode() {
    if (localStorage.getItem('appMode')) {
        currentMode = localStorage.getItem('appMode');
        return;
    }
    if (window.location.protocol === 'file:') {
        localStorage.setItem('appMode', 'mock');
        currentMode = 'mock';
        return;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        await originalFetch('/api/auth/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}), 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        // If it got past connection failure, backend is alive
        localStorage.setItem('appMode', 'live');
        currentMode = 'live';
    } catch (e) {
        localStorage.setItem('appMode', 'mock');
        currentMode = 'mock';
    }
}

function updateModeUI() {
    const badge = document.getElementById('current-mode-badge');
    const btn = document.getElementById('toggle-mode-btn');
    if (!badge || !btn) return;

    if (currentMode === 'mock') {
        badge.textContent = '🔮 Demo Mode (Offline)';
        badge.className = 'mode-badge mode-badge-mock';
        btn.textContent = 'Switch to Live Backend';
    } else {
        badge.textContent = '⚡ Live Mode (Connected)';
        badge.className = 'mode-badge mode-badge-live';
        btn.textContent = 'Switch to Demo Mode';
    }
}

function initModeToggler() {
    updateModeUI();
    const btn = document.getElementById('toggle-mode-btn');
    if (btn) {
        btn.onclick = () => {
            currentMode = currentMode === 'mock' ? 'live' : 'mock';
            localStorage.setItem('appMode', currentMode);
            updateModeUI();
            showAlert(`Environment changed to ${currentMode === 'mock' ? 'Demo Mode' : 'Live Mode'}`, 'success');
            setTimeout(() => {
                window.location.reload();
            }, 800);
        };
    }
}

// Helper: Show alert banner
function showAlert(message, type = 'success') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    
    banner.textContent = message;
    banner.className = type === 'success' ? 'alert-success' : 'alert-error';
    banner.style.display = 'block';
    
    setTimeout(() => {
        banner.style.display = 'none';
    }, 4000);
}

// Helper: Get authorization headers
function getHeaders(extraHeaders = {}) {
    const token = localStorage.getItem('accessToken');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...extraHeaders
    };
}

// Document Load Handlers
document.addEventListener('DOMContentLoaded', async () => {
    await autoDetectMode();
    initModeToggler();

    const path = window.location.pathname;
    
    // Page redirection check
    const token = localStorage.getItem('accessToken');
    if (path.endsWith('dashboard.html')) {
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        initDashboard();
    } else {
        // index.html or base path
        if (token) {
            window.location.href = 'dashboard.html';
            return;
        }
        initAuth();
    }
});

// ==========================================
// 1. AUTHENTICATION & LOGIN FORM HANDLERS
// ==========================================
function initAuth() {
    // Form panel toggle buttons
    const toRegister = document.getElementById('to-register');
    const toLogin = document.getElementById('to-login');
    const verifyToLogin = document.getElementById('verify-to-login');
    
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const verifyCard = document.getElementById('verify-card');
    
    if (toRegister) {
        toRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.style.display = 'none';
            registerCard.style.display = 'block';
        });
    }
    
    if (toLogin) {
        toLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerCard.style.display = 'none';
            loginCard.style.display = 'block';
        });
    }
    
    if (verifyToLogin) {
        verifyToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            verifyCard.style.display = 'none';
            loginCard.style.display = 'block';
        });
    }

    // Submit forms
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Invalid login credentials');
            }
            
            const tokens = await res.json();
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('idToken', tokens.idToken);
            localStorage.setItem('refreshToken', tokens.refreshToken);
            localStorage.setItem('username', username);
            
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Registration failed');
            }
            
            showAlert('Registration initiated. Verification code sent to email!', 'success');
            
            // Redirect to confirm panel
            registerCard.style.display = 'none';
            verifyCard.style.display = 'block';
            document.getElementById('verify-username').value = username;
            
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });

    document.getElementById('verify-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('verify-username').value;
        const code = document.getElementById('verify-code').value;
        
        try {
            const res = await fetch(`${API_BASE}/auth/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code })
            });
            
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Verification failed. Double check code');
            }
            
            showAlert('Verification complete! You can now log in.', 'success');
            verifyCard.style.display = 'none';
            loginCard.style.display = 'block';
            
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });
}

// ==========================================
// 2. DASHBOARD VIEW INTERACTIVE FLOWS
// ==========================================
function initDashboard() {
    // Logout btn
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        window.location.href = 'index.html';
    });

    // Dynamic pricing update in Rental Form
    const typeSelect = document.getElementById('rent-instance-type');
    const priceDisplay = document.getElementById('rent-price-display');
    if (typeSelect && priceDisplay) {
        typeSelect.addEventListener('change', () => {
            const priceMap = {
                't2.micro': '$5.00',
                't3.micro': '$8.00',
                't3.medium': '$20.00'
            };
            priceDisplay.textContent = priceMap[typeSelect.value] || '$10.00';
        });
    }

    // Refresh VPS button
    document.getElementById('refresh-vps-list')?.addEventListener('click', loadVpsList);

    // Rent VPS form submit
    document.getElementById('rent-vps-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('rent-name').value;
        const instanceType = document.getElementById('rent-instance-type').value;
        const osType = document.getElementById('rent-os').value;

        try {
            const res = await fetch(`${API_BASE}/vps/rent`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ name, instanceType, osType })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Rental execution failed');
            }

            showAlert('VPS provisioned successfully! Loading instance...', 'success');
            document.getElementById('rent-vps-form').reset();
            if (priceDisplay) priceDisplay.textContent = '$8.00';
            
            // Reload user details and VPS lists
            loadUserProfile();
            loadVpsList();
            loadTransactions();
            
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });

    // Deposit balance form submit
    document.getElementById('deposit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        
        try {
            const res = await fetch(`${API_BASE}/payment/deposit`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ amount, description: 'Simulated Portal Deposit' })
            });

            if (!res.ok) {
                throw new Error('Transaction rejected');
            }

            showAlert('Funds deposited successfully!', 'success');
            document.getElementById('deposit-form').reset();
            loadUserProfile();
            loadTransactions();
            
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });

    // Avatar upload handler
    const fileInput = document.getElementById('avatar-file-input');
    fileInput?.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('accessToken');

        try {
            const res = await fetch(`${API_BASE}/users/me/avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // Form-data handles content-type boundary
                body: formData
            });

            if (!res.ok) throw new Error('Avatar upload failed');

            const data = await res.json();
            document.getElementById('user-display-avatar').src = data.avatarUrl;
            showAlert('Avatar updated successfully!', 'success');
        } catch (err) {
            showAlert(err.message, 'error');
        }
    });

    // Initial load
    loadUserProfile();
    loadVpsList();
    loadTransactions();
}

// Fetch user profile data
async function loadUserProfile() {
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch profile details');

        const user = await res.json();
        document.getElementById('user-display-name').textContent = user.username;
        document.getElementById('user-display-email').textContent = user.email;
        document.getElementById('user-display-balance').textContent = `$${parseFloat(user.balance).toFixed(2)}`;
        
        if (user.avatarUrl) {
            document.getElementById('user-display-avatar').src = user.avatarUrl;
        }
    } catch (err) {
        console.error(err);
    }
}

// Fetch user transaction history logs
async function loadTransactions() {
    try {
        const res = await fetch(`${API_BASE}/users/me/transactions`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Could not fetch ledger logs');

        const txs = await res.json();
        const tbody = document.getElementById('transaction-list-body');
        if (!tbody) return;

        if (txs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No logs available</td></tr>`;
            return;
        }

        tbody.innerHTML = txs.map(t => {
            const amountClass = t.amount >= 0 ? 'tx-amount-plus' : 'tx-amount-minus';
            const amountSign = t.amount >= 0 ? `+$${t.amount.toFixed(2)}` : `-$${Math.abs(t.amount).toFixed(2)}`;
            return `
                <tr>
                    <td><span class="status-badge ${t.type === 'DEPOSIT' ? 'status-running' : 'status-stopped'}">${t.type}</span></td>
                    <td><span class="${amountClass}">${amountSign}</span></td>
                    <td>${t.description}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

// Fetch VPS listing
async function loadVpsList() {
    const container = document.getElementById('vps-list-container');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/vps`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Could not fetch VPS list');

        const list = await res.json();
        
        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 40px 0; grid-column: span 2;">
                    You do not own any VPS instances. Rent one above to begin!
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(vps => {
            const osIcon = vps.osType === 'UBUNTU' ? '🐧' : (vps.osType === 'WINDOWS' ? '🪟' : '⚙️');
            const statusClass = `status-${vps.status.toLowerCase()}`;
            return `
                <div class="vps-card" data-id="${vps.id}">
                    <div class="vps-header">
                        <span class="vps-title">${vps.name}</span>
                        <span class="status-badge ${statusClass}">${vps.status}</span>
                    </div>
                    <div class="vps-details">
                        <span><strong>OS:</strong> ${osIcon} ${vps.osType}</span>
                        <span><strong>Size:</strong> 💾 ${vps.instanceType}</span>
                        <span><strong>IP:</strong> 🌐 ${vps.publicIp || 'Initializing...'}</span>
                        <span><strong>Instance ID:</strong> 🆔 ${vps.instanceId || 'AWS Pending'}</span>
                        <span style="grid-column: span 2;"><strong>Expires:</strong> 📅 ${vps.expiryDate.split('T')[0]}</span>
                    </div>
                    <div class="vps-actions">
                        <button class="btn btn-secondary" onclick="controlVps(${vps.id}, 'start')">▶️ Start</button>
                        <button class="btn btn-secondary" onclick="controlVps(${vps.id}, 'stop')">⏸️ Stop</button>
                        <button class="btn btn-secondary" onclick="controlVps(${vps.id}, 'reboot')">🔄 Reboot</button>
                        <button class="btn btn-secondary" onclick="controlVps(${vps.id}, 'sync')">🔍 Sync</button>
                        <button class="btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 8px 12px; margin-top: 0;" onclick="controlVps(${vps.id}, 'delete')">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--danger); padding: 40px 0; grid-column: span 2;">
                Error loading VPS servers: ${err.message}
            </div>
        `;
    }
}

// Control VPS actions (start, stop, reboot, sync, delete)
async function controlVps(id, action) {
    if (action === 'delete') {
        if (!confirm('Are you sure you want to terminate and delete this VPS server? This action cannot be undone.')) {
            return;
        }
    }
    showAlert(`Requesting AWS EC2 ${action} for VPS...`, 'success');
    
    try {
        const res = await fetch(`${API_BASE}/vps/${id}/${action}`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Failed to execute ${action}`);
        }

        showAlert(`AWS EC2 instance state update: ${action.toUpperCase()} success!`, 'success');
        loadVpsList();
    } catch (err) {
        showAlert(err.message, 'error');
    }
}

// Expose controlVps to window so inline onclick handlers work
window.controlVps = controlVps;
