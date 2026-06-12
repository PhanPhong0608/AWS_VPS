// AWS-Integrated VPS Rental Platform Frontend Engine

const API_BASE = '/api';

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
document.addEventListener('DOMContentLoaded', () => {
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
        localStorage.clear();
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
                        <button class="btn" style="padding: 8px 12px; margin-top:0;" onclick="controlVps(${vps.id}, 'sync')">🔍 Sync</button>
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

// Control VPS actions (start, stop, reboot, sync)
async function controlVps(id, action) {
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
