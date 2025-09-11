document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://responsive-savings-analyzer-with-calender.onrender.com';
    const loadingOverlay = document.getElementById('loading-overlay');
    const form = document.getElementById('signup-form');

    function showLoading(show = true) {
        if (!loadingOverlay) return;
        if (show) loadingOverlay.classList.add('show');
        else loadingOverlay.classList.remove('show');
    }

    function toast(message, ok = false) {
        const div = document.createElement('div');
        div.className = (ok ? 'success-message' : 'error-message') + ' show';
        div.textContent = message;
        document.querySelector('.signin-content').insertBefore(div, document.querySelector('.signin-content').firstChild);
        setTimeout(() => div.remove(), ok ? 2500 : 4000);
    }

    window.handleCredentialResponse = async (response) => {
        showLoading(true);
        try {
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const r = await fetch(`${API_BASE_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: response.credential, email: payload.email, name: payload.name, picture: payload.picture })
            });
            const data = await r.json();
            if (r.ok) {
                localStorage.setItem('auth_token', data.access_token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                toast('Account created! Redirecting...', true);
                setTimeout(() => window.location.href = 'index.html', 1200);
            } else {
                toast(data.detail || 'Google signup failed.');
            }
        } catch (e) {
            console.error(e);
            toast('An error occurred during Google signup.');
        } finally {
            showLoading(false);
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const name = formData.get('name');
        const email = formData.get('email');
        const password = formData.get('password');

        if (!name || !email || !password) {
            return toast('Please fill in all fields.');
        }
        if (password.length < 6) {
            return toast('Password must be at least 6 characters.');
        }

        showLoading(true);
        try {
            const r = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await r.json();
            if (r.ok) {
                localStorage.setItem('auth_token', data.access_token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                toast('Account created! Redirecting...', true);
                setTimeout(() => window.location.href = 'index.html', 1200);
            } else {
                toast(data.detail || 'Could not create account.');
            }
        } catch (e) {
            console.error(e);
            toast('Network error. Please try again.');
        } finally {
            showLoading(false);
        }
    });

    // Initialize Google Button render if needed
    window.onload = function () {
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: '634170748970-dtsu0ruqjtdjgik6pp18frbeqh3sjfd7.apps.googleusercontent.com',
                callback: handleCredentialResponse
            });
            google.accounts.id.renderButton(document.getElementById('g_id_onload'), { theme: 'outline', size: 'large', width: '100%' });
        }
    };
});

