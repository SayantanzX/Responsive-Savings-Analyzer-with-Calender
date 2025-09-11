// Signin Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const emailSigninForm = document.getElementById('email-signin-form');
    const signupLink = document.getElementById('signup-link');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    
    // API Base URL - Update this to match your FastAPI backend
    const API_BASE_URL = 'https://responsive-savings-analyzer-with-calender.onrender.com';
    
    // Show loading overlay
    function showLoading() {
        loadingOverlay.classList.add('show');
    }
    
    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.classList.remove('show');
    }
    
    // Show error message
    function showError(message) {
        hideLoading();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message show';
        errorDiv.textContent = message;
        
        const signinContent = document.querySelector('.signin-content');
        signinContent.insertBefore(errorDiv, signinContent.firstChild);
        
        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    // Show success message
    function showSuccess(message) {
        hideLoading();
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message show';
        successDiv.textContent = message;
        
        const signinContent = document.querySelector('.signin-content');
        signinContent.insertBefore(successDiv, signinContent.firstChild);
        
        // Remove success message after 3 seconds
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
    
    // Handle Google Sign-in response
    window.handleCredentialResponse = async (response) => {
        showLoading();
        
        try {
            // Decode the JWT token
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            
            // Send the token to your backend for verification
            const backendResponse = await fetch(`${API_BASE_URL}/auth/google`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: response.credential,
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture
                })
            });
            
            const result = await backendResponse.json();
            
            if (backendResponse.ok) {
                // Store the authentication token
                localStorage.setItem('auth_token', result.access_token);
                localStorage.setItem('user_info', JSON.stringify(result.user));
                
                showSuccess('Successfully signed in! Redirecting...');
                
                // Redirect to main page after successful login
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                showError(result.detail || 'Authentication failed. Please try again.');
            }
        } catch (error) {
            console.error('Google Sign-in Error:', error);
            showError('An error occurred during sign-in. Please try again.');
        }
    };
    
    // Handle email/password signin
    emailSigninForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        const formData = new FormData(emailSigninForm);
        const email = formData.get('email');
        const password = formData.get('password');
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Store the authentication token
                localStorage.setItem('auth_token', result.access_token);
                localStorage.setItem('user_info', JSON.stringify(result.user));
                
                showSuccess('Successfully signed in! Redirecting...');
                
                // Redirect to main page after successful login
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                showError(result.detail || 'Invalid email or password.');
            }
        } catch (error) {
            console.error('Sign-in Error:', error);
            showError('An error occurred during sign-in. Please try again.');
        }
    });
    
    // Handle signup link click (navigate to signup page)
    signupLink.addEventListener('click', (e) => {
        // If href is set, let it navigate. Keep for safety.
    });
    
    // Handle forgot password link click
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        // For now, show an alert. You can implement password reset functionality
        alert('Password reset functionality will be implemented. Please contact support for assistance.');
    });
    
    // Check if user is already authenticated
    function checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            // Verify token is still valid
            fetch(`${API_BASE_URL}/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (response.ok) {
                    // User is already authenticated, redirect to main page
                    window.location.href = 'index.html';
                } else {
                    // Token is invalid, remove it
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                }
            })
            .catch(error => {
                console.error('Auth verification error:', error);
                // Remove invalid token
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
            });
        }
    }
    
    // Check authentication status on page load
    checkAuthStatus();
    
    // Initialize Google Sign-in
    window.onload = function () {
        google.accounts.id.initialize({
            client_id: '634170748970-dtsu0ruqjtdjgik6pp18frbeqh3sjfd7.apps.googleusercontent.com', // Replace with your actual Google Client ID
            callback: handleCredentialResponse
        });
        
        google.accounts.id.renderButton(
            document.querySelector('.g_id_signin'),
            {
                theme: 'outline',
                size: 'large',
                width: '100%'
            }
        );
    };
});

// Utility function to make authenticated API calls
async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        // Redirect to signin page if no token
        window.location.href = 'signin.html';
        return;
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        // Token is invalid or expired
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'signin.html';
        return;
    }
    
    return response;
}

// Export for use in other files
window.makeAuthenticatedRequest = makeAuthenticatedRequest;
