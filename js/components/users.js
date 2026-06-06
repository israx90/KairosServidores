import { showToast } from '../utils.js';
/**
 * Users Component
 * Handles User Management for Admins and Coordinators
 */

import { Modal } from './modal.js';

function avatarHtml(user, size = '32px') {
    const pic = user.profile_pic;
    const has = pic && pic !== 'null' && pic !== 'assets/default-avatar.svg' && pic !== '';
    if (has) {
        const fallback = initialsHtml(user.alias || user.name || '?', size).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<img src="${pic}" style="width:${size};height:${size};border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.outerHTML='${fallback}'">`;
    }
    return initialsHtml(user.alias || user.name || '?', size);
}
function initialsHtml(name, size = '32px') {
    const initials = name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const colors = ['#2979ff', '#e91e63', '#9c27b0', '#00bcd4', '#4caf50', '#ff5722', '#ffc107'];
    let h = 0; for (let c of name) h = c.charCodeAt(0) + ((h << 5) - h);
    const bg = colors[Math.abs(h) % colors.length];
    return `<div style="width:${size};height:${size};border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(${size} * 0.4);color:#fff;flex-shrink:0;">${initials}</div>`;
}


export const Users = {
    state: {
        users: [],
        teams: [],
        currentUserRole: null
    },

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        const user = JSON.parse(localStorage.getItem('krs_user'));
        this.state.currentUserRole = user ? user.role : 'guest';

        Modal.init();

        await Promise.all([this.fetchUsers(), this.fetchTeams()]);
        this.render();
    },

    async fetchUsers() {
        try {
            const response = await fetch('api/users.php');
            this.state.users = await response.json();
        } catch (error) {
            console.error('Error fetching users:', error);
            this.container.innerHTML = '<p class="text-danger">Error al cargar usuarios.</p>';
        }
    },

    async fetchTeams() {
        try {
            const res = await fetch('api/teams.php');
            this.state.teams = await res.json();
        } catch (e) {
            this.state.teams = [];
        }
    },

    render() {
        const { users, currentUserRole } = this.state;
        const isAdmin = currentUserRole === 'admin';

        let html = `
            <div class="glass" style="padding: 20px; border-radius: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h2><i class="ph-bold ph-users"></i> Gestión de Usuarios</h2>
                    <button id="create-user-btn" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Nuevo Usuario</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${users.map(u => `
                        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
                            <div style="display: flex; gap: 12px; align-items: center; flex: 1; min-width: 200px;">
                                ${avatarHtml(u, '44px')}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.name || u.alias}</div>
                                    <div class="text-muted" style="font-size: 0.78em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.email || ''}</div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <span style="background: rgba(41,121,255,0.15); color: var(--primary-color); padding: 2px 10px; border-radius: 99px; font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${this.translateRole(u.role)}</span>
                                        ${u.alias ? `<span class="text-muted" style="font-size: 0.78em;">@${u.alias}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0; margin-left: auto;">
                                <button class="btn btn-secondary btn-icon" style="width:36px;height:36px;min-height:36px;" onclick="Users.resetPassword(${u.id}, '${(u.name || u.alias).replace(/'/g, "\\'")}')" title="Contraseña">
                                    <i class="ph-bold ph-key" style="font-size:16px;"></i>
                                </button>
                                <button class="btn btn-secondary btn-icon" style="width:36px;height:36px;min-height:36px;" onclick="Users.editUser(${u.id})" title="Editar">
                                    <i class="ph-bold ph-pencil-simple" style="font-size:16px;"></i>
                                </button>
                                ${isAdmin ? `<button class="btn btn-danger btn-icon" style="width:36px;height:36px;min-height:36px;" onclick="Users.deleteUser(${u.id})" title="Eliminar"><i class="ph-bold ph-trash" style="font-size:16px;"></i></button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        window.Users = this;
        this.bindEvents();
    },

    translateRole(role) {
        const types = { 'admin': 'Admin', 'coordinator': 'Coordinador', 'server': 'Voluntario' };
        return types[role] || role;
    },

    bindEvents() {
        const btn = document.getElementById('create-user-btn');
        if (btn) btn.addEventListener('click', () => this.openCreateModal());
    },

    openCreateModal() {
        const isCoord = this.state.currentUserRole === 'coordinator';

        const roleOptions = isCoord
            ? `<option value="server">Voluntario</option>`
            : `
                <option value="server">Voluntario</option>
                <option value="coordinator">Coordinador</option>
                <option value="admin">Administrador</option>
            `;

        const teamOptions = this.state.teams.map(t =>
            `<option value="${t.id}">${t.name}</option>`
        ).join('');

        const content = `
            <form id="create-user-form">
                <div class="input-group">
                    <label>Alias (Usuario para Login)</label>
                    <input type="text" name="alias" class="form-control" placeholder="Ej. JuanPerez" required>
                </div>

                <div class="input-group">
                    <label>Rol</label>
                    <select name="role" class="form-control">
                        ${roleOptions}
                    </select>
                </div>

                <div class="input-group">
                    <label>Equipo <span class="text-muted" style="font-size:0.8em;">(opcional)</span></label>
                    <select name="team_id" class="form-control">
                        <option value="">— Sin equipo —</option>
                        ${teamOptions}
                    </select>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 0.9em; color: var(--text-muted);"><i class="ph-bold ph-info"></i> La contraseña inicial será <strong>KRS2026</strong>. El usuario deberá completar su perfil al iniciar sesión.</p>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%">Crear Usuario</button>
            </form>
        `;

        Modal.open('Nuevo Usuario', content);

        document.getElementById('create-user-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createUser(new FormData(e.target));
        });
    },

    async createUser(formData) {
        const data = Object.fromEntries(formData.entries());
        const teamId = data.team_id || null;
        delete data.team_id;
        try {
            const response = await fetch('api/users.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                if (teamId && result.data) {
                    const userRes = await fetch('api/users.php');
                    const allUsers = await userRes.json();
                    const newUser = allUsers.find(u => u.alias === result.data.alias);
                    if (newUser && teamId) {
                        await fetch('api/teams.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'add_member', team_id: parseInt(teamId), user_id: newUser.id })
                        });
                    }
                }
                this.showCredentialsModal(result.data.alias, result.data.password);
                this.init(this.container.id);
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    },

    showCredentialsModal(alias, password) {
        const content = `
            <div style="text-align: center;">
                <div style="margin-bottom: 20px;">
                    <i class="ph-duotone ph-check-circle" style="font-size: 48px; color: var(--success-color);"></i>
                </div>
                <h3 style="margin-bottom: 10px;">¡Usuario Creado!</h3>
                <p class="text-muted" style="margin-bottom: 20px;">Comparte estas credenciales con el usuario.</p>

                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                    <div style="margin-bottom: 10px;">
                        <span style="color: var(--text-muted); font-size: 0.8em;">Usuario / Alias</span>
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${alias}</div>
                    </div>
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.8em;">Contraseña</span>
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">${password}</div>
                    </div>
                </div>

                <button id="copy-creds-btn" class="btn btn-primary" style="width: 100%; justify-content: center;">
                    <i class="ph-bold ph-copy"></i> Copiar Credenciales
                </button>
            </div>
        `;

        Modal.open('Credenciales de Acceso', content);

        const copyBtn = document.getElementById('copy-creds-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const text = `Hola! Aquí tienes tus credenciales para KRS:\n\nLink: https://kairos-servidores-cjcr.vercel.app/\nUsuario: ${alias}\nContraseña: ${password}\n\nPor favor ingresa y completa tu perfil.`;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '<i class="ph-bold ph-check"></i> Copiado!';
                    setTimeout(() => Modal.close(), 1500);
                });
            };
        }
    },

    async resetPassword(userId, userName) {
        if (!confirm(`¿Restablecer contraseña para ${userName} a "KRS2026"?`)) return;

        try {
            const response = await fetch('api/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change_password',
                    user_id: userId,
                    new_password: 'KRS2026',
                    force_reset: true
                })
            });
            const result = await response.json();
            if (result.success || !result.message.includes('incorrecta')) {
                showToast('Contraseña restablecida exitosamente.', 'success');
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    },

    async deleteUser(userId) {
        if (!confirm('¿Eliminar usuario permanentemente?')) return;
        try {
            const response = await fetch('api/users.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId })
            });
            const result = await response.json();
            if (result.success) {
                this.init(this.container.id);
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    },

    editUser(userId) {
        const user = this.state.users.find(u => u.id == userId);
        if (!user) return;

        const isAdmin = this.state.currentUserRole === 'admin';

        const roleOptions = isAdmin ? `
            <option value="server" ${user.role === 'server' ? 'selected' : ''}>Voluntario</option>
            <option value="coordinator" ${user.role === 'coordinator' ? 'selected' : ''}>Coordinador</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
        ` : `<option value="${user.role}">${this.translateRole(user.role)}</option>`;

        const teamOptions = [
            `<option value="">— Sin equipo —</option>`,
            ...this.state.teams.map(t =>
                `<option value="${t.id}" ${user.team_id == t.id ? 'selected' : ''}>${t.name}</option>`
            )
        ].join('');

        const content = `
            <form id="edit-user-form">
                <input type="hidden" name="id" value="${user.id}">
                <input type="hidden" name="current_team_id" value="${user.team_id || ''}">
                <div class="input-group">
                    <label>Nombre Completo</label>
                    <input type="text" name="name" class="form-control" value="${user.name || ''}" required>
                </div>
                <div class="input-group">
                    <label>Alias</label>
                    <input type="text" name="alias" class="form-control" value="${user.alias || ''}">
                </div>
                <div class="input-group">
                    <label>Teléfono</label>
                    <input type="tel" name="phone" class="form-control" value="${user.phone || ''}">
                </div>
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" name="email" class="form-control" value="${user.email || ''}">
                </div>
                <div class="input-group">
                    <label>Fecha Nac.</label>
                    <input type="date" name="birthdate" class="form-control" value="${user.birthdate || ''}">
                </div>
                <div class="input-group">
                    <label>Rol</label>
                    <select name="role" class="form-control" ${!isAdmin ? 'disabled' : ''}>
                        ${roleOptions}
                    </select>
                </div>
                <div class="input-group">
                    <label>Equipo <span class="text-muted" style="font-size:0.8em;">(opcional)</span></label>
                    <select name="team_id" class="form-control">
                        ${teamOptions}
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%">Guardar Cambios</button>
            </form>
        `;

        Modal.open(`Editar: ${user.name || user.alias}`, content);

        document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            const newTeamId = data.team_id || null;
            const oldTeamId = data.current_team_id || null;
            delete data.team_id;
            delete data.current_team_id;

            try {
                const response = await fetch('api/users.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.success) {
                    if (newTeamId !== oldTeamId) {
                        if (oldTeamId) {
                            await fetch('api/teams.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'remove_member', team_id: parseInt(oldTeamId), user_id: parseInt(data.id) })
                            });
                        }
                        if (newTeamId) {
                            await fetch('api/teams.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'add_member', team_id: parseInt(newTeamId), user_id: parseInt(data.id) })
                            });
                        }
                    }
                    Modal.close();
                    this.init(this.container.id);
                } else {
                    showToast(result.message || 'Error', 'error');
                }
            } catch (err) {
                showToast('Error de conexión', 'error');
            }
        });
    }
};
