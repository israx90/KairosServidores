import { showToast } from '../utils.js';
/**
 * Teams Component
 * Handles Team Management (CRUD & Members)
 */

import { Modal } from './modal.js';

/** Genera avatar: foto o círculo con iniciales */
function avatarHtml(user, size = '30px') {
    const has = user.profile_pic &&
        user.profile_pic !== 'assets/default-avatar.svg' &&
        user.profile_pic !== '';
    if (has) {
        return `<img src="${user.profile_pic}" style="width:${size};height:${size};border-radius:50%;object-fit:cover;">`;
    }
    const initials = (user.name || '?').trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const colors = ['#2979ff', '#e91e63', '#9c27b0', '#00bcd4', '#4caf50', '#ff5722', '#ffc107'];
    let h = 0; for (let c of (user.name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
    const bg = colors[Math.abs(h) % colors.length];
    return `<div style="width:${size};height:${size};border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(${size} * 0.38);color:#fff;flex-shrink:0;">${initials}</div>`;
}


export const Teams = {
    state: {
        teams: [],
        users: [] // Needed for adding members
    },

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Ensure modal is initialized
        Modal.init();

        await this.fetchData();
        this.render();
    },

    async fetchData() {
        try {
            const [teamsRes, usersRes] = await Promise.all([
                fetch('api/teams.php'),
                fetch('api/users.php')
            ]);

            this.state.teams = await teamsRes.json();
            this.state.users = await usersRes.json();
        } catch (error) {
            console.error('Error fetching data:', error);
            this.container.innerHTML = '<p class="text-danger">Error al cargar datos.</p>';
        }
    },

    render() {
        const { teams } = this.state;
        // Get user role
        const user = JSON.parse(localStorage.getItem('krs_user'));
        const role = user ? user.role : 'guest';
        const canEdit = role === 'admin' || role === 'coordinator';

        let html = `
            <div class="glass" style="padding: 20px; border-radius: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2><i class="ph-bold ph-users-three"></i> Gestión de Equipos</h2>
                    ${canEdit ? '<button id="create-team-btn" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Nuevo Equipo</button>' : ''}
                </div>

                <div class="teams-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                    ${teams.map(team => `
                        <div class="glass" style="padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                                <div>
                                    <h3 style="margin-bottom: 5px;">${team.name}</h3>
                                    <p class="text-muted" style="font-size: 0.9em;">Coord: ${team.coordinator_name || 'Sin Asignar'}</p>
                                </div>
                                ${canEdit ? `
                                <div class="dropdown">
                                    <button class="btn btn-secondary btn-sm" onclick="Teams.editTeam(${team.id})"><i class="ph-bold ph-pencil-simple"></i></button>
                                </div>` : ''}
                            </div>
                            
                            <div style="margin-bottom: 15px;">
                                <p style="font-size: 0.9em; margin-bottom: 5px;">Miembros: <span class="text-gold">${team.member_count}</span></p>
                            </div>

                            <button class="btn btn-secondary" style="width: 100%; font-size: 0.9em;" onclick="Teams.viewDetails(${team.id})">
                                Ver Miembros
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        window.Teams = this; // Expose for onclick
        this.bindEvents();
    },

    bindEvents() {
        const createBtn = document.getElementById('create-team-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.openCreateModal();
            });
        }
    },

    openCreateModal() {
        const content = `
            <form id="create-team-form">
                <div class="input-group">
                    <label>Nombre del Equipo</label>
                    <input type="text" name="name" class="form-control" required placeholder="Ej. Cámara, Streaming...">
                </div>
                <!-- Coordinator Selection could go here -->
                <button type="submit" class="btn btn-primary" style="width: 100%">Crear Equipo</button>
            </form>
        `;

        Modal.open('Nuevo Equipo', content);

        document.getElementById('create-team-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            this.createTeam(formData.get('name'));
        });
    },

    async createTeam(name) {
        try {
            const response = await fetch('api/teams.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const result = await response.json();
            if (result.success) {
                // alert('Equipo creado');
                Modal.close();
                this.init(this.container.id); // Refresh
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al crear equipo', 'error');
        }
    },

    async viewDetails(teamId) {
        // Fetch detailed team data (members)
        try {
            const response = await fetch(`api/teams.php?id=${teamId}`);
            const team = await response.json();

            this.openDetailsModal(team);
        } catch (e) {
            console.error(e);
            showToast('Error al cargar detalles', 'error');
        }
    },

    openDetailsModal(team) {
        // Get user role
        const user = JSON.parse(localStorage.getItem('krs_user'));
        const role = user ? user.role : 'guest';
        const canEdit = role === 'admin' || role === 'coordinator';

        const content = `
            <div style="margin-bottom: 20px;">
                <p><strong>Coordinador:</strong> ${team.coordinator_name || 'No asignado'}</p>
            </div>

            <h4 style="margin-bottom: 10px;">Miembros (${team.members ? team.members.length : 0})</h4>
            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px;">
                ${team.members && team.members.length > 0 ?
                team.members.map(m => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatarHtml(m, '30px')}
                                <span>${m.name}</span>
                            </div>
                            ${canEdit ? `<button class="btn btn-danger btn-sm" onclick="Teams.removeMember(${team.id}, ${m.id})"><i class="ph-bold ph-trash"></i></button>` : ''}
                        </div>
                    `).join('')
                : '<p class="text-muted">Sin miembros aún.</p>'
            }
            </div>

            ${canEdit ? `
            <form id="add-member-form" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                <h4 style="margin-bottom: 10px;">Añadir Miembro</h4>
                <div class="input-group">
                    <select name="user_id" class="form-control" required>
                        <option value="">Seleccionar Usuario...</option>
                        ${this.state.users.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-success" style="width: 100%">Añadir al Equipo</button>
            </form>` : ''}

            ${!canEdit && user && (!team.members || !team.members.find(m => m.id == user.id)) ? `
                <div style="margin-top: 20px; text-align: center;">
                    <button id="join-team-btn" class="btn btn-primary" style="width: 100%;">
                        <i class="ph-bold ph-hand-waving"></i> Ser parte de este equipo
                    </button>
                </div>
            ` : ''}
        `;

        Modal.open(`Equipo: ${team.name}`, content);

        const addForm = document.getElementById('add-member-form');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                this.addMember(team.id, formData.get('user_id'));
            });
        }

        const joinBtn = document.getElementById('join-team-btn');
        if (joinBtn) {
            joinBtn.onclick = () => {
                if (confirm(`¿Quieres unirte al equipo ${team.name}?`)) {
                    this.addMember(team.id, user.id);
                }
            };
        }
    },

    async addMember(teamId, userId) {
        try {
            const response = await fetch('api/teams.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_member', team_id: teamId, user_id: userId })
            });
            const result = await response.json();
            if (result.success) {
                this.viewDetails(teamId); // Refresh modal
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    },

    async removeMember(teamId, userId) {
        if (!confirm('¿Quitar usuario del equipo?')) return;

        try {
            const response = await fetch('api/teams.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_member', team_id: teamId, user_id: userId })
            });
            const result = await response.json();
            if (result.success) {
                this.viewDetails(teamId); // Refresh modal
            } else {
                showToast(result.message || 'Error', 'error');
            }
        } catch (e) {
            showToast('Error de conexión', 'error');
        }
    },

    editTeam(teamId) {
        // Simple prompt for now, could be a modal
        const newName = prompt('Nuevo nombre del equipo:');
        if (newName) {
            // Update logic...
        }
    }
};


