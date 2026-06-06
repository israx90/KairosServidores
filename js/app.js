import { showToast } from './utils.js';
/**
 * Servidor KRS - Main Application Logic
 * Handles Routing, State, and UI Interaction
 */

import './api.js';
import { Profile } from './components/profile.js';
import { Calendar } from './components/calendar.js';
import { Teams } from './components/teams.js';
import { Reports } from './components/reports.js';
import { Users } from './components/users.js';
import { Admin } from './components/admin.js';
import { Reminders } from './components/reminders.js';

import { getAvatarHTML, getInitialsAvatar } from './utils.js';

const App = {
    state: {
        user: null, // Logged in user data
        currentView: 'dashboard',
        isMobile: window.innerWidth <= 768
    },

    init() {
        console.log('KRS App Initializing...');
        this.bindEvents();
        this.checkSession();
        this.handleResize();
    },

    bindEvents() {
        // Login Logic
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navigation — single delegated listener on document to avoid duplicates
        // This handles both sidebar links and any dynamically added nav items
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-item[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const view = href.substring(1);

                // Close mobile sidebar if open
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');

                this.navigate(view);
            }
        });

        // Window Resize
        window.addEventListener('resize', () => this.handleResize());

        // Mobile Menu Toggle
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
            });

            // Close when clicking overlay
            if (overlay) {
                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                });
            }
        }
    },

    handleResize() {
        this.state.isMobile = window.innerWidth <= 768;
        // Adjust UI if needed dynamically
    },

    async checkSession() {
        const user = localStorage.getItem('krs_user');
        if (user) {
            this.state.user = JSON.parse(user);
            this.showView('dashboard');
        } else {
            this.showView('guest');
        }
    },

    async handleLogin() {
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        if (!user || !pass) {
            showToast('Por favor completa todos los campos', 'error');
            return;
        }

        const submitBtn = document.querySelector('#login-form button');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Conectando...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('api/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ action: 'login', username: user, password: pass })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                if (text.includes('aes.js') || text.includes('__test=')) {
                    throw new Error('El servidor está verificando tu conexión. Por favor recarga la página (Ctrl+F5).');
                }
                console.error("JSON Error:", text);
                throw new Error('Respuesta inválida del servidor.');
            }

            if (data.success) {
                this.state.user = data.data;
                localStorage.setItem('krs_user', JSON.stringify(this.state.user));

                if (this.state.user.is_temp_password == 1) {
                    showToast('Por seguridad, debes cambiar tu contraseña temporal.', 'info');
                    this.navigate('settings'); // Redirect to settings
                }

                this.showView('dashboard');
            } else {
                throw new Error(data.message || 'Error al iniciar sesión');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },

    handleLogout() {
        if (confirm('¿Seguro que quieres cerrar sesión?')) {
            localStorage.removeItem('krs_user');
            this.state.user = null;
            this.showView('guest');
        }
    },

    showView(viewName) {
        const authSection = document.getElementById('auth-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const userControls = document.getElementById('user-controls');
        const guestControls = document.getElementById('guest-controls');
        const sidebar = document.querySelector('.sidebar');
        const dashboardGrid = document.querySelector('.dashboard-grid');

        // Reset Styles
        if (sidebar) sidebar.style.display = 'flex';
        if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = ''; // Reset to CSS default

        if (viewName === 'auth') {
            authSection.style.display = 'flex';
            dashboardSection.style.display = 'none';
        }
        else if (viewName === 'dashboard') {
            authSection.style.display = 'none';
            dashboardSection.style.display = 'block';

            // Logged In State
            if (userControls) userControls.style.display = 'flex';
            if (guestControls) guestControls.style.display = 'none';

            this.renderDashboard();
        }
        else if (viewName === 'guest') {
            // Guest State
            authSection.style.display = 'none';
            dashboardSection.style.display = 'block';

            if (userControls) userControls.style.display = 'none';
            if (guestControls) guestControls.style.display = 'block';
            if (sidebar) sidebar.style.display = 'none';
            if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = '1fr';

            // Bind Guest Login Button
            const loginBtn = document.getElementById('login-redirect-btn');
            if (loginBtn) {
                loginBtn.onclick = () => this.showView('auth');
            }

            this.navigate('calendar');
        }
    },

    navigate(view) {
        console.log('Navigating to:', view);
        this.state.currentView = view;

        // Update Active State in Nav
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[href="#${view}"]`);
        if (activeLink) activeLink.classList.add('active');

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = ''; // Clear content

        // Load content logic
        switch (view) {
            case 'calendar':
                Calendar.init('main-content');
                break;
            case 'teams':
                Teams.init('main-content');
                break;
            case 'assignments':
                mainContent.innerHTML = '<div class="glass" style="padding: 20px;"><h2>Mis Turnos</h2><p>Cargando tus turnos... (En construcción)</p></div>';
                break;
            case 'reports':
                Reports.init('main-content');
                break;
            case 'users':
                Users.init('main-content');
                break;
            case 'settings':
                window.Profile = Profile;
                Profile.render('main-content');
                setTimeout(() => Profile.loadSwaps(), 50);
                break;
            case 'reminders':
                window.Reminders = Reminders;
                Reminders.init('main-content');
                break;
            case 'admin':
                Admin.init('main-content');
                break;
            default:
                mainContent.innerHTML = '<div class="glass" style="padding: 20px;"><h2>Bienvenido</h2><p>Selecciona una opción.</p></div>';
        }
    },

    renderDashboard() {
        // Update User Profile UI
        if (this.state.user) {
            const avatarBtn = document.getElementById('user-avatar-btn');
            if (avatarBtn) {
                avatarBtn.innerHTML = getAvatarHTML(this.state.user, '100%');
            }

            // Show Reports link only for admins/coordinators
            const reportLink = document.querySelector('a[href="#reports"]');
            if (reportLink) {
                reportLink.style.display = (this.state.user.role === 'admin' || this.state.user.role === 'coordinator') ? 'flex' : 'none';
            }

            // Show Users link only for Admin/Coordinator
            const usersLink = document.querySelector('a[href="#users"]');
            if (usersLink) {
                usersLink.style.display = (this.state.user.role === 'admin' || this.state.user.role === 'coordinator') ? 'flex' : 'none';
            }

            // Show Admin Panel link only for Admin
            const adminLink = document.querySelector('a[href="#admin"]');
            if (adminLink) {
                adminLink.style.display = this.state.user.role === 'admin' ? 'flex' : 'none';
            }

            // Show Reminders link for Admin/Coordinator
            const remindersLink = document.querySelector('a[href="#reminders"]');
            if (remindersLink) {
                remindersLink.style.display = (this.state.user.role === 'admin' || this.state.user.role === 'coordinator') ? 'flex' : 'none';
            }

            // — Swap Badge: show count of available swaps on settings link
            this.refreshSwapBadge();
        }

        // Default View
        if (!this.state.currentView || this.state.currentView === 'dashboard') {
            this.navigate('calendar');
        }
    },

    async refreshSwapBadge() {
        const user = this.state.user;
        if (!user) return;
        try {
            const res = await fetch(`api/swaps.php?user_id=${user.id}`);
            const swaps = await res.json();
            if (!Array.isArray(swaps)) return;
            // Count swaps available for me (not mine)
            const available = swaps.filter(s => s.requester_id != user.id).length;
            const settingsLink = document.querySelector('a[href="#settings"]');
            if (settingsLink) {
                // Remove previous badge
                const old = settingsLink.querySelector('.swap-badge');
                if (old) old.remove();
                if (available > 0) {
                    settingsLink.style.position = 'relative';
                    const badge = document.createElement('span');
                    badge.className = 'swap-badge';
                    badge.textContent = available;
                    badge.style.cssText = 'position:absolute;top:4px;right:4px;background:#ff5722;color:#fff;font-size:0.65em;font-weight:700;padding:2px 6px;border-radius:999px;line-height:1.4;pointer-events:none;';
                    settingsLink.appendChild(badge);
                }
            }
        } catch (e) { /* silent */ }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});


