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
        return `<img src="${pic}" style="width:${size};height:${size};border-radius:50%;object-fit:cover;" onerror="this.outerHTML='${fallback}'">`;
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

        // Get Role from LocalStorage (Sync with Session roughly)
        // Ideally we fetch from 'api/auth.php?action=me' but for now trust LS + Backend Rejection
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2><i class="ph-bold ph-users"></i> Gestión de Usuarios</h2>
                    <button id="create-user-btn" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Nuevo Usuario</button>
                </div>

                <div class="table-responsive" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; color: var(--text-main);">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left;">
                                <th style="padding: 10px;">Usuario</th>
                                <th style="padding: 10px;">Rol</th>
                                <th style="padding: 10px;">Alias / Teléfono</th>
                                <th style="padding: 10px; text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <td style="padding: 10px; display: flex; align-items: center; gap: 10px;">
                                        ${avatarHtml(u, '36px')}
                                        <div>
                                            <div style="font-weight: 500;">${u.name}</div>
                                            <div class="text-muted" style="font-size: 0.8em;">${u.email}</div>
                                        </div>
                                    </td>
                                    <td style="padding: 10px;">
                                        <span class="badge" style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.85em;">
                            ${this.translateRole(u.role)}
                                        </span>
                                    </td>
                                    <td style="padding: 10px; font-size: 0.9em;">
                                        <div>${u.alias || '-'}</div>
                                        <div class="text-muted">${u.phone || '-'}</div>
                                    </td>
                                    <td style="padding: 10px; text-align: right;">
                                        <div style="display: flex; gap: 5px; justify-content: flex-end;">
                                            <button class="btn btn-secondary btn-sm" onclick="Users.resetPassword(${u.id}, '${u.name}')" title="Restablecer Contraseña">
                                                <i class="ph-bold ph-key"></i>
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="Users.editUser(${u.id})">
                                                <i class="ph-bold ph-pencil-simple"></i>
                                            </button>
                                            ${isAdmin ? `
                                            <button class="btn btn-danger btn-sm" onclick="Users.deleteUser(${u.id})">
                                                <i class="ph-bold ph-trash"></i>
                                            </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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
        delete data.team_id; // don't send to users API
        try {
            const response = await fetch('api/users.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                // Assign to team if selected
                if (teamId && result.data) {
                    // We need the new user's id — fetch by alias
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
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
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
                const text = `Hola! Aquí tienes tus credenciales para KRS:\n\nLink: https://servidoreskrs.page.gd/\nUsuario: ${alias}\nContraseña: ${password}\n\nPor favor ingresa y completa tu perfil.`;
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
                    force_reset: true // Signal to backend this is an admin reset
                })
            });
            const result = await response.json();
            if (result.success || !result.message.includes('incorrecta')) {
                // Note: auth.php might return generic success even if some logic varies, check response
                alert('Contraseña restablecida exitosamente.');
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
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
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
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
                    // Handle team assignment change
                    if (newTeamId !== oldTeamId) {
                        // Remove from old team
                        if (oldTeamId) {
                            await fetch('api/teams.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'remove_member', team_id: parseInt(oldTeamId), user_id: parseInt(data.id) })
                            });
                        }
                        // Add to new team
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
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                alert('Error de conexión');
            }
        });
    }
};
