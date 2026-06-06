/**
 * Profile Component
 * Handles User Profile View & Edit
 */

import { API } from '../api.js';
import { getAvatarHTML, getInitialsAvatar, showToast } from '../utils.js';

export const Profile = {
    async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user) return;

        container.innerHTML = `
            <div class="glass" style="padding: 30px; border-radius: 20px; max-width: 800px; margin: 0 auto;">
                ${user.is_temp_password == 1 ? `
                <div style="background: rgba(41, 121, 255, 0.2); border: 1px solid var(--primary-color); padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                    <h3 style="margin-bottom: 5px;">👋 ¡Bienvenido a KRS!</h3>
                    <p>Para comenzar, por favor completa tu perfil y cambia tu contraseña temporal.</p>
                </div>
                ` : ''}

                <h2 style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                    <i class="ph-bold ph-user-circle"></i> Mi Perfil
                </h2>

                <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; gap: 40px;">
                     <!-- Profile Header / Picture -->
                    <div style="grid-column: 1 / -1; display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
                         <div style="position: relative; width: 100px; height: 100px;">
                            <div id="profile-preview-wrap" style="width:100px;height:100px;border-radius:50%;overflow:hidden;border:3px solid var(--primary-color);">
                                ${getAvatarHTML(user, '100px')}
                            </div>
                            
                            <button onclick="document.getElementById('profile-upload').click()" 
                                class="btn btn-primary"
                                style="position: absolute; bottom: 0; right: 0; padding: 8px; border-radius: 50%; width: 36px; height: 36px; min-width: unset;">
                                <i class="ph-bold ph-camera"></i>
                            </button>
                            <input type="file" id="profile-upload" accept="image/*" style="display: none;">
                        </div>
                            <h3>${user.name}</h3>
                            <p class="text-gold">${this.translateRole(user.role).toUpperCase()}</p>
                        </div>
                    </div>

                    <!-- Personal Info Form -->
                    <div>
                        <h3>Información Personal</h3>
                        <form id="profile-form">
                            <div class="input-group">
                                <label>Nombre Completo</label>
                                <input type="text" name="name" class="form-control" value="${user.name}" required>
                            </div>
                            <div class="input-group">
                                <label>Alias (Como te llaman)</label>
                                <input type="text" name="alias" class="form-control" value="${user.alias || ''}">
                            </div>
                            <div class="input-group">
                                <label>Email</label>
                                <input type="email" name="email" class="form-control" value="${user.email || ''}" required>
                            </div>
                            <div class="input-group">
                                <label>Teléfono</label>
                                <input type="tel" name="phone" class="form-control" value="${user.phone || ''}">
                            </div>
                             <div class="input-group">
                                <label>Fecha de Nacimiento</label>
                                <input type="date" name="birthdate" class="form-control" value="${user.birthdate || ''}">
                            </div>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </form>
                    </div>

                    <!-- Security / Password -->
                    <div>
                        <h3>Seguridad</h3>
                        <form id="password-form" style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 12px;">
                            <div class="input-group">
                                <label>Contraseña Actual</label>
                                <div style="position: relative;">
                                    <input type="password" name="current_password" id="profile-current-password" class="form-control" required style="padding-right: 40px; width: 100%; box-sizing: border-box;">
                                    <button type="button" class="toggle-password-btn" data-target="profile-current-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 0; margin: 0; color: var(--text-color); cursor: pointer; font-size: 1.2rem; display: flex; align-items: center;" tabindex="-1">
                                        <i class="ph-bold ph-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Nueva Contraseña</label>
                                <div style="position: relative;">
                                    <input type="password" name="new_password" id="profile-new-password" class="form-control" required minlength="6" style="padding-right: 40px; width: 100%; box-sizing: border-box;">
                                    <button type="button" class="toggle-password-btn" data-target="profile-new-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 0; margin: 0; color: var(--text-color); cursor: pointer; font-size: 1.2rem; display: flex; align-items: center;" tabindex="-1">
                                        <i class="ph-bold ph-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-danger">Cambiar Contraseña</button>
                        </form>
                    </div>
                </div>

                <!-- Swaps Section -->
                <div style="grid-column: 1 / -1; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 25px;">
                    <h3 style="margin-bottom: 15px;"><i class="ph-bold ph-arrows-left-right"></i> Cambios de Turno</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button id="tab-my-swaps" class="btn btn-primary" onclick="Profile.showSwapTab('my')">Mis Solicitudes</button>
                        <button id="tab-available-swaps" class="btn btn-secondary" onclick="Profile.showSwapTab('available')">Disponibles</button>
                    </div>
                    <div id="swaps-content"><p class="text-muted">Cargando...</p></div>
                </div>
            </div>
        </div>

        <!-- Cropper Modal -->
            <div id="cropper-modal" class="modal-overlay">
                <div class="modal" style="width: 90%; max-width: 500px;">
                    <div class="modal-header">
                        <h3>Ajustar Foto</h3>
                        <button class="close-modal" onclick="document.getElementById('cropper-modal').classList.remove('active')">&times;</button>
                    </div>
                    <div style="height: 300px; background: #000; margin-bottom: 15px;">
                        <img id="cropper-image" src="" style="max-width: 100%;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="document.getElementById('cropper-modal').classList.remove('active')">Cancelar</button>
                        <button id="crop-btn" class="btn btn-primary">Guardar Foto</button>
                    </div>
                </div>
            </div>
        `;

        // Bind Events
        document.getElementById('profile-form').addEventListener('submit', (e) => this.handleUpdateProfile(e, user.id));
        document.getElementById('password-form').addEventListener('submit', (e) => this.handleChangePassword(e, user.id));

        // Image Upload Logic
        const uploadInput = document.getElementById('profile-upload');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Setup Eye Icons for passwords
        const toggleBtns = container.querySelectorAll('.toggle-password-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                const eyeIcon = this.querySelector('i');
                if (targetInput.type === 'password') {
                    targetInput.type = 'text';
                    eyeIcon.classList.remove('ph-eye');
                    eyeIcon.classList.add('ph-eye-slash');
                } else {
                    targetInput.type = 'password';
                    eyeIcon.classList.remove('ph-eye-slash');
                    eyeIcon.classList.add('ph-eye');
                }
            });
        });
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const image = document.getElementById('cropper-image');
            image.src = event.target.result;

            // Show Modal
            document.getElementById('cropper-modal').classList.add('active');

            // Initialize Cropper (destroy previous if exists)
            if (this.cropper) {
                this.cropper.destroy();
            }

            // Small delay to ensure modal is visible before initializing Cropper
            setTimeout(() => {
                this.cropper = new Cropper(image, {
                    aspectRatio: 1, // Square
                    viewMode: 1,
                    autoCropArea: 1,
                });
            }, 100);

            // Bind Save Button ONCE using a named handler
            const cropBtn = document.getElementById('crop-btn');
            const newBtn = cropBtn.cloneNode(true);
            cropBtn.parentNode.replaceChild(newBtn, cropBtn);
            newBtn.addEventListener('click', () => this.uploadCroppedImage());
        };
        reader.readAsDataURL(file);
    },

    async uploadCroppedImage() {
        if (!this.cropper) return;

        const cropBtn = document.getElementById('crop-btn');
        if (cropBtn) {
            cropBtn.innerHTML = 'Subiendo...';
            cropBtn.disabled = true;
        }

        this.cropper.getCroppedCanvas({
            width: 300,
            height: 300
        }).toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'profile.webp');

            try {
                const response = await fetch('api/upload_profile.php', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();

                if (result.success) {
                    // Update Local Storage
                    const user = JSON.parse(localStorage.getItem('krs_user'));
                    user.profile_pic = result.data.url.startsWith('data:image') ? result.data.url : result.data.url + '?t=' + new Date().getTime();
                    localStorage.setItem('krs_user', JSON.stringify(user));

                    // Update profile preview (now a wrapper div)
                    const previewWrap = document.getElementById('profile-preview-wrap');
                    if (previewWrap) {
                        previewWrap.innerHTML = `<img src="${user.profile_pic}" style="width:100px;height:100px;object-fit:cover;border-radius:50%;" loading="lazy">`;
                    }

                    // Update main avatar in header if exists
                    const headerAvatar = document.getElementById('user-avatar-btn');
                    if (headerAvatar) {
                        headerAvatar.innerHTML = `<img src="${user.profile_pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" loading="lazy">`;
                    }

                    showToast('Foto de perfil actualizada', 'success');
                    document.getElementById('cropper-modal').classList.remove('active');
                } else {
                    showToast(result.message || 'Error al actualizar', 'error');
                }
            } catch (error) {
                console.error(error);
                showToast('Error al subir la imagen', 'error');
            } finally {
                const btn = document.getElementById('crop-btn');
                if (btn) {
                    btn.innerHTML = 'Guardar Foto';
                    btn.disabled = false;
                }
            }
        }, 'image/webp', 0.8);
    },

    async handleUpdateProfile(e, userId) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.id = userId;

        try {
            const response = await fetch('api/users.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showToast('Perfil actualizado correctamente', 'success');
                // Update local storage user data
                const currentUser = JSON.parse(localStorage.getItem('krs_user'));
                const updatedUser = { ...currentUser, ...data };
                localStorage.setItem('krs_user', JSON.stringify(updatedUser));
            } else {
                showToast(result.message || 'Error al actualizar perfil', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error al conectar con el servidor', 'error');
        }
    },

    async handleChangePassword(e, userId) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.user_id = userId;
        data.action = 'change_password';

        try {
            const response = await fetch('api/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showToast('Contraseña cambiada exitosamente', 'success');
                e.target.reset();
            } else {
                showToast(result.message || 'Error al cambiar contraseña', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error al conectar con el servidor', 'error');
        }
    },

    translateRole(role) {
        const roles = {
            admin: 'Administrador',
            coordinator: 'Coordinador',
            server: 'Servidor'
        };
        return roles[role] || role;
    },

    // ── SWAPS ──────────────────────────────────────────────────────────
    _swapTab: 'my',

    async loadSwaps() {
        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user) return;
        window.Profile = this;
        await this.showSwapTab(this._swapTab);
    },

    async showSwapTab(tab) {
        this._swapTab = tab;
        const user = JSON.parse(localStorage.getItem('krs_user'));
        const container = document.getElementById('swaps-content');
        if (!container) return;

        // Toggle button styles
        document.getElementById('tab-my-swaps').className = tab === 'my' ? 'btn btn-primary' : 'btn btn-secondary';
        document.getElementById('tab-available-swaps').className = tab === 'available' ? 'btn btn-primary' : 'btn btn-secondary';

        container.innerHTML = '<p class="text-muted">Cargando...</p>';

        try {
            const res = await fetch(`api/swaps.php?user_id=${user.id}`);
            const swaps = await res.json();

            if (tab === 'my') {
                // My pending requests
                const mine = swaps.filter(s => s.requester_id == user.id);
                if (mine.length === 0) {
                    container.innerHTML = '<p class="text-muted">No tienes solicitudes de cambio activas.</p>';
                    return;
                }
                container.innerHTML = mine.map(s => `
                    <div class="glass" style="padding: 12px 16px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${s.event_name}</div>
                            <div style="font-size: 0.85em; color: var(--text-secondary);">${s.event_date} · ${s.event_time ? s.event_time.substring(0, 5) : ''} · Rol: <strong>${s.role}</strong></div>
                        </div>
                        <span style="background: rgba(255,193,7,0.2); color: #ffc107; padding: 4px 10px; border-radius: 20px; font-size: 0.8em;">⏳ Pendiente</span>
                    </div>
                `).join('');
            } else {
                // Available swaps (not mine)
                const available = swaps.filter(s => s.requester_id != user.id);
                if (available.length === 0) {
                    container.innerHTML = '<p class="text-muted">No hay cambios disponibles para aceptar.</p>';
                    return;
                }
                container.innerHTML = available.map(s => `
                    <div class="glass" style="padding: 12px 16px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${s.event_name}</div>
                            <div style="font-size: 0.85em; color: var(--text-secondary);">${s.event_date} · ${s.event_time ? s.event_time.substring(0, 5) : ''} · Rol: <strong>${s.role}</strong></div>
                            <div style="font-size: 0.8em; margin-top: 4px;">Solicitado por: <strong>${s.requester_name}</strong></div>
                        </div>
                        <button class="btn btn-success btn-sm" onclick="Profile.acceptSwap(${s.id})">
                            <i class="ph-bold ph-check"></i> Tomar turno
                        </button>
                    </div>
                `).join('');
            }
        } catch (e) {
            container.innerHTML = '<p class="text-danger">Error al cargar cambios.</p>';
        }
    },

    async acceptSwap(swapId) {
        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user) return;
        if (!confirm('¿Confirmas que quieres tomar este turno?')) return;

        try {
            const res = await fetch('api/swaps.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept_swap', swap_id: swapId, acceptor_id: user.id })
            });
            const result = await res.json();
            if (result.success) {
                showToast('¡Turno tomado exitosamente!', 'success');
                this.showSwapTab('available');
            } else {
                showToast(result.message || 'Error al tomar turno', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    }
};
