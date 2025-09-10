document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8000';
    const loadingOverlay = document.getElementById('loading-overlay');

    function showLoading(show = true) {
        if (!loadingOverlay) return;
        if (show) loadingOverlay.classList.add('show');
        else loadingOverlay.classList.remove('show');
    }

    function authHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async function ensureAdmin() {
        const token = localStorage.getItem('auth_token');
        if (!token) return window.location.href = 'signin.html';
        const resp = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
        if (!resp.ok) return window.location.href = 'signin.html';
        const user = await resp.json();
        if (user.role !== 'admin') {
            alert('Admin access required.');
            return window.location.href = 'index.html';
        }
    }

    function bindNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                btn.classList.add('active');
                const target = document.querySelector(btn.dataset.target);
                if (target) target.classList.add('active');
            });
        });
    }

    async function loadUsers() {
        showLoading(true);
        const tableBody = document.querySelector('#users-table tbody');
        tableBody.innerHTML = '';
        const resp = await fetch(`${API_BASE_URL}/admin/users`, { headers: authHeaders() });
        const users = await resp.json();
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>
                    <select data-id="${u.id}" class="role-select">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                    </select>
                </td>
                <td>${u.is_active ? '<span class="badge success">active</span>' : '<span class="badge warn">disabled</span>'}</td>
                <td>${new Date(u.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn-outline toggle-active" data-id="${u.id}">${u.is_active ? 'Disable' : 'Enable'}</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        bindUserActions();
        showLoading(false);
    }

    function bindUserActions() {
        document.querySelectorAll('.role-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const id = sel.getAttribute('data-id');
                await fetch(`${API_BASE_URL}/admin/users/${id}`, {
                    method: 'PATCH',
                    headers: authHeaders(),
                    body: JSON.stringify({ role: sel.value })
                });
                loadUsers();
            });
        });
        document.querySelectorAll('.toggle-active').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await fetch(`${API_BASE_URL}/admin/users/${id}`, {
                    method: 'PATCH',
                    headers: authHeaders(),
                    body: JSON.stringify({ toggle_active: true })
                });
                loadUsers();
            });
        });
    }

    async function loadAnalytics() {
        const resp = await fetch(`${API_BASE_URL}/admin/analytics`, { headers: authHeaders() });
        const a = await resp.json();
        document.querySelector('#metric-users span').textContent = a.total_users;
        document.querySelector('#metric-savings span').textContent = a.total_savings_entries;
        document.querySelector('#metric-amount span').textContent = `Rs. ${a.total_savings_amount}`;
        document.querySelector('#metric-avg span').textContent = `Rs. ${a.average_per_entry}`;
    }

    async function loadSettings() {
        const resp = await fetch(`${API_BASE_URL}/admin/settings`, { headers: authHeaders() });
        const s = await resp.json();
        document.getElementById('site_name').value = s.site_name || '';
        document.getElementById('allow_signups').value = String(s.allow_signups ?? true);
        document.getElementById('token_expiry_minutes').value = s.token_expiry_minutes || 30;
    }

    function bindSettingsForm() {
        const form = document.getElementById('settings-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                site_name: document.getElementById('site_name').value,
                allow_signups: document.getElementById('allow_signups').value === 'true',
                token_expiry_minutes: Number(document.getElementById('token_expiry_minutes').value)
            };
            await fetch(`${API_BASE_URL}/admin/settings`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
            alert('Settings saved');
        });
    }

    async function loadLogs() {
        const level = document.getElementById('log-level').value;
        const url = new URL(`${API_BASE_URL}/admin/logs`);
        if (level) url.searchParams.set('level', level);
        const resp = await fetch(url.toString(), { headers: authHeaders() });
        const logs = await resp.json();
        const tbody = document.querySelector('#logs-table tbody');
        tbody.innerHTML = '';
        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(l.created_at).toLocaleString()}</td>
                <td>${l.level}</td>
                <td>${l.message}</td>
                <td><code>${l.meta || ''}</code></td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('log-level').addEventListener('change', loadLogs);
    document.getElementById('back-home').addEventListener('click', () => window.location.href = 'index.html');
    document.getElementById('logout-admin').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'signin.html';
    });

    (async function init() {
        await ensureAdmin();
        bindNav();
        bindSettingsForm();
        await Promise.all([loadUsers(), loadAnalytics(), loadSettings(), loadLogs()]);
    })();
});

