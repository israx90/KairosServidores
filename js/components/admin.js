/**
 * Admin Panel Component
 */
export const Admin = {
    state: {
        activeTab: 'events', // events, types, roles, swaps
        events: [],
        types: [],
        roles: [],
        swaps: [],
        selectedEvents: [],
        eventFilter: { type: '', month: '' }  // Filter state
    },

    async init(containerId) {
        window.Admin = this; // Fix scope immediately
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Check permissions
        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user || user.role !== 'admin') {
            this.container.innerHTML = '<p class="text-danger">Acceso denegado.</p>';
            return;
        }

        await this.fetchData();
        this.render();
    },

    async fetchData() {
        try {
            const [eventsRes, typesRes, rolesRes] = await Promise.all([
                fetch('api/events.php'),
                fetch('api/event_types.php'),
                fetch('api/service_roles.php')
            ]);

            // Helper to unwrap response
            const unwrap = async (res, name) => {
                const json = await res.json();
                if (Array.isArray(json)) return json;
                if (json && (json.data && Array.isArray(json.data) || Array.isArray(json))) return json.data || json;
                // Fallback for wrapped responses
                if (json && json.success && Array.isArray(json.data)) return json.data;

                console.error(`${name} API Error/Format Unknown:`, json);
                return [];
            };

            this.state.events = await unwrap(eventsRes, 'Events');
            this.state.types = await unwrap(typesRes, 'Types');
            this.state.roles = await unwrap(rolesRes, 'Roles');

            // Fetch swaps
            try {
                const user = JSON.parse(localStorage.getItem('krs_user'));
                const swapsRes = await fetch(`api/swaps.php?user_id=${user?.id || 0}`);
                const swapsData = await swapsRes.json();
                this.state.swaps = Array.isArray(swapsData) ? swapsData : [];
            } catch { this.state.swaps = []; }

        } catch (e) {
            console.error('Error loading admin data', e);
            this.state.events = [];
            this.state.types = [];
            this.state.roles = [];
        }
    },

    render() {
        const { activeTab } = this.state;

        let html = `
            <div class="glass" style="padding: 20px; border-radius: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <h2 style="margin: 0;"><i class="ph-bold ph-shield-check"></i> Panel de Administrador</h2>
                    <button class="btn btn-primary" onclick="Admin.generateMonthlyReport()">
                        <i class="ph-bold ph-file-pdf"></i> Generar Reporte Mensual
                    </button>
                </div>

                <!-- Tabs -->
                <div id="admin-tabs-container" style="display: flex; gap: 10px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; white-space: nowrap; scrollbar-width: none;">
                    <button data-tab="events" class="btn ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}"><i class="ph-bold ph-calendar"></i> Eventos</button>
                    <button data-tab="types" class="btn ${activeTab === 'types' ? 'btn-primary' : 'btn-secondary'}"><i class="ph-bold ph-tag"></i> Tipos de Evento</button>
                    <button data-tab="roles" class="btn ${activeTab === 'roles' ? 'btn-primary' : 'btn-secondary'}"><i class="ph-bold ph-users-three"></i> Roles de Servicio</button>
                    <button data-tab="swaps" class="btn ${activeTab === 'swaps' ? 'btn-primary' : 'btn-secondary'}">
                        <i class="ph-bold ph-arrows-left-right"></i> Cambios de Turno ${this.state.swaps.length > 0 ? `<span style="background:#ff5722;color:#fff;padding:2px 8px;border-radius:999px;font-size:0.75em;margin-left:5px;">${this.state.swaps.length}</span>` : ''}
                    </button>
                </div>

                <!-- Content -->
                <div id="admin-content" style="animation: fadeIn 0.3s ease;">
                    ${this.renderTabContent()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.bindEvents();
    },

    bindEvents() {
        // Tab Navigation (Event Delegation)
        const tabsContainer = document.getElementById('admin-tabs-container');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const tab = e.target.dataset.tab;
                    if (tab) {
                        console.log('Tab clicked:', tab);
                        this.switchTab(tab);
                    }
                }
            });
        }

        this.bindFormEvents();
    },

    switchTab(tab) {
        this.state.activeTab = tab;
        this.render();
    },

    renderTabContent() {
        switch (this.state.activeTab) {
            case 'events': return this.renderEventsTab();
            case 'types': return this.renderTypesTab();
            case 'roles': return this.renderRolesTab();
            case 'swaps': return this.renderSwapsTab();
            default: return '';
        }
    },

    bindFormEvents() {
        // Types Form
        const typeForm = document.getElementById('add-type-form');
        if (typeForm) {
            typeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());

                if (data.id) {
                    this.updateType(data);
                } else {
                    this.createType(data);
                }
            });
        }

        // Roles Form
        const roleForm = document.getElementById('add-role-form');
        if (roleForm) {
            roleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());

                if (data.id && data.id.trim() !== '') {
                    data.id = parseInt(data.id); // ensure number
                    this.updateRole(data);
                } else {
                    delete data.id; // remove empty id so server creates
                    this.createRole(data);
                }
            });
        }
    },

    // --- EVENTS TAB ---
    renderEventsTab() {
        // Get unique types and months for filters
        const allTypes = [...new Set(this.state.events.map(e => e.type))].sort();
        const allMonths = [...new Set(this.state.events.map(e => e.event_date.substring(0, 7)))].sort();
        const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        // Apply filters
        const { type: fType, month: fMonth } = this.state.eventFilter;
        const filtered = this.state.events.filter(e => {
            if (fType && e.type !== fType) return false;
            if (fMonth && !e.event_date.startsWith(fMonth)) return false;
            return true;
        });

        const selCount = this.state.selectedEvents.length;

        return `
            <!-- Filters -->
            <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
                <select id="filter-type" class="form-control" style="width: auto; padding: 8px 14px; font-size: 0.88em;" onchange="Admin.applyFilter('type', this.value)">
                    <option value="">Todos los tipos</option>
                    ${allTypes.map(t => `<option value="${t}" ${fType === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <select id="filter-month" class="form-control" style="width: auto; padding: 8px 14px; font-size: 0.88em;" onchange="Admin.applyFilter('month', this.value)">
                    <option value="">Todos los meses</option>
                    ${allMonths.map(m => {
            const [y, mo] = m.split('-');
            return `<option value="${m}" ${fMonth === m ? 'selected' : ''}>${monthNames[parseInt(mo)]} ${y}</option>`;
        }).join('')}
                </select>
                ${fType || fMonth ? `<button class="btn btn-secondary btn-sm" onclick="Admin.clearFilters()"><i class="ph-bold ph-x"></i> Limpiar</button>` : ''}
                <span class="text-muted" style="font-size:0.85em; margin-left: auto;">${filtered.length} evento(s)</span>
            </div>

            <!-- Actions bar -->
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <button id="delete-selected-btn" class="btn btn-danger btn-sm" onclick="Admin.deleteSelectedEvents()" ${selCount === 0 ? 'disabled' : ''}>
                    <i class="ph-bold ph-trash"></i> Eliminar Seleccionados (${selCount})
                </button>
            </div>

            <div style="max-height: 500px; overflow-y: auto;" id="events-table-wrapper" class="table-responsive">
                <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <th style="padding: 10px; text-align: left; width: 40px;"><input type="checkbox" id="check-all-events" onclick="Admin.toggleAllEvents(this)"></th>
                            <th style="padding: 10px; text-align: left;">Evento</th>
                            <th style="padding: 10px; text-align: left;">Fecha</th>
                            <th style="padding: 10px; text-align: left;">Hora</th>
                            <th style="padding: 10px; text-align: left;">Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(e => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.02)'" onmouseout="this.style.backgroundColor='transparent'">
                                <td style="padding: 10px;">
                                    <input type="checkbox" value="${e.id}"
                                    ${this.state.selectedEvents.includes(e.id) ? 'checked' : ''}
                                    onchange="Admin.toggleEventSelection(${e.id})">
                                </td>
                                <td style="padding: 10px; font-weight: 500;">${e.name}</td>
                                <td style="padding: 10px;">${e.event_date}</td>
                                <td style="padding: 10px;">${e.event_time ? e.event_time.substring(0, 5) : ''}</td>
                                <td style="padding: 10px;">
                                    <span style="background: var(--bg-card); padding: 4px 8px; border-radius: 4px; font-size: 0.85em; display: inline-block;">
                                        ${e.type}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    applyFilter(key, value) {
        this.state.eventFilter[key] = value;
        // Only re-render the events tab content, not the full admin panel
        const contentEl = document.getElementById('admin-content');
        if (contentEl) contentEl.innerHTML = this.renderEventsTab();
    },

    clearFilters() {
        this.state.eventFilter = { type: '', month: '' };
        const contentEl = document.getElementById('admin-content');
        if (contentEl) contentEl.innerHTML = this.renderEventsTab();
    },

    toggleEventSelection(id) {
        if (this.state.selectedEvents.includes(id)) {
            this.state.selectedEvents = this.state.selectedEvents.filter(eid => eid !== id);
        } else {
            this.state.selectedEvents.push(id);
        }
        // Update only the delete button count — do NOT re-render (avoids scroll-to-top)
        const btn = document.getElementById('delete-selected-btn');
        if (btn) {
            const count = this.state.selectedEvents.length;
            btn.innerHTML = `<i class="ph-bold ph-trash"></i> Eliminar Seleccionados (${count})`;
            btn.disabled = count === 0;
        }
    },

    toggleAllEvents(checkbox) {
        // Toggle only visible (filtered) rows
        const rows = document.querySelectorAll('#events-table-wrapper tbody input[type="checkbox"]');
        const ids = Array.from(rows).map(cb => parseInt(cb.value));
        if (checkbox.checked) {
            ids.forEach(id => { if (!this.state.selectedEvents.includes(id)) this.state.selectedEvents.push(id); });
            rows.forEach(cb => cb.checked = true);
        } else {
            this.state.selectedEvents = this.state.selectedEvents.filter(id => !ids.includes(id));
            rows.forEach(cb => cb.checked = false);
        }
        // Update button without full re-render
        const btn = document.getElementById('delete-selected-btn');
        if (btn) {
            const count = this.state.selectedEvents.length;
            btn.innerHTML = `<i class="ph-bold ph-trash"></i> Eliminar Seleccionados (${count})`;
            btn.disabled = count === 0;
        }
    },

    async deleteSelectedEvents() {
        if (!confirm(`¿Eliminar ${this.state.selectedEvents.length} eventos? No se puede deshacer.`)) return;

        try {
            const response = await fetch('api/events.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'batch_delete', ids: this.state.selectedEvents })
            });
            const result = await response.json();
            if (result.success) {
                alert('Eventos eliminados');
                this.state.selectedEvents = [];
                await this.fetchData();
                this.render();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
        }
    },

    // --- TYPES TAB ---
    renderTypesTab() {
        const colors = [
            { name: 'Gold', hex: '#FFD700', text: '#000000' },
            { name: 'Purple', hex: '#9C27B0', text: '#FFFFFF' },
            { name: 'Blue', hex: '#2196F3', text: '#FFFFFF' },
            { name: 'Pink', hex: '#E91E63', text: '#FFFFFF' },
            { name: 'Orange', hex: '#FF5722', text: '#FFFFFF' },
            { name: 'Teal', hex: '#009688', text: '#FFFFFF' },
            { name: 'Lime', hex: '#CDDC39', text: '#000000' },
            { name: 'White', hex: '#FFFFFF', text: '#000000' }
        ];

        return `
            <div style="margin-bottom: 20px;">
                <form id="add-type-form" style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
                    <input type="hidden" name="id" id="type-id-input">
                    <div class="input-group" style="margin: 0; flex: 2; min-width: 200px;">
                        <label>Nombre</label>
                        <input type="text" name="name" id="type-name-input" class="form-control" placeholder="Ej. Concierto" required>
                    </div>
                    
                    <div class="input-group" style="margin: 0; flex: 3; min-width: 300px;">
                        <label>Color (Paleta KAIROS)</label>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            ${colors.map(c => `
                                <label style="cursor: pointer;">
                                    <input type="radio" name="color_select" value="${c.hex}|${c.text}" style="display: none;" onchange="Admin.selectColor(this)">
                                    <div class="color-swatch" style="width: 30px; height: 30px; background: ${c.hex}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2);" title="${c.name}"></div>
                                </label>
                            `).join('')}
                        </div>
                        <input type="hidden" name="color" id="color-input" value="#ffffff">
                        <input type="hidden" name="text_color" id="text-color-input" value="#000000">
                    </div>

                    <button type="submit" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Guardar</button>
                    ${document.getElementById('type-id-input') && document.getElementById('type-id-input').value ?
                `<button type="button" class="btn btn-secondary" onclick="Admin.resetTypeForm()">Cancelar</button>` : ''}
                </form>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
                ${this.state.types.map(t => `
                    <div class="glass" style="padding: 15px; border-left: 5px solid ${t.color}; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: ${t.color};">${t.name}</span>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-secondary btn-sm" onclick="Admin.editType(${t.id})"><i class="ph-bold ph-pencil-simple"></i></button>
                            ${t.name !== 'General' ? `<button class="btn btn-danger btn-sm" onclick="Admin.deleteType(${t.id})"><i class="ph-bold ph-trash"></i></button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    selectColor(radio) {
        const [hex, text] = radio.value.split('|');
        document.getElementById('color-input').value = hex;
        document.getElementById('text-color-input').value = text;

        // Highlight selection
        if (document.querySelectorAll('.color-swatch').length > 0) {
            document.querySelectorAll('.color-swatch').forEach(el => el.style.border = '2px solid rgba(255,255,255,0.2)');
            if (radio.nextElementSibling) radio.nextElementSibling.style.border = '2px solid #fff';
        }
    },

    editType(id) {
        const type = this.state.types.find(t => t.id === id);
        if (!type) return;

        const idInput = document.getElementById('type-id-input');
        const nameInput = document.getElementById('type-name-input');

        if (idInput && nameInput) {
            idInput.value = type.id;
            nameInput.value = type.name;
            document.getElementById('color-input').value = type.color;
            document.getElementById('text-color-input').value = type.text_color;

            const btn = document.querySelector('#add-type-form button[type="submit"]');
            if (btn) btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Actualizar';

            this.state.editingType = type.id;
            this.render();

            setTimeout(() => {
                document.getElementById('type-id-input').value = type.id;
                document.getElementById('type-name-input').value = type.name;
                document.getElementById('color-input').value = type.color;
                document.getElementById('text-color-input').value = type.text_color;
                const btn = document.querySelector('#add-type-form button[type="submit"]');
                if (btn) btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Actualizar';
            }, 0);
        }
    },

    resetTypeForm() {
        this.state.editingType = null;
        this.render();
    },

    async createType(data) {
        try {
            const response = await fetch('api/event_types.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await this.fetchData();
            this.resetTypeForm();
        } catch (e) {
            console.error(e);
        }
    },

    async updateType(data) {
        try {
            const response = await fetch('api/event_types.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await this.fetchData();
            this.resetTypeForm();
        } catch (e) {
            console.error(e);
        }
    },

    async deleteType(id) {
        if (!confirm('¿Eliminar este tipo de evento?')) return;
        try {
            await fetch('api/event_types.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            await this.fetchData();
            this.render();
        } catch (e) { console.error(e); }
    },

    // --- ROLES TAB ---
    renderRolesTab() {
        return `
            <div style="margin-bottom: 20px;">
                <form id="add-role-form" style="display: flex; gap: 10px; align-items: flex-end;">
                    <input type="hidden" name="id" id="role-id-input">
                    <div class="input-group" style="margin: 0; flex: 1;">
                        <label>Nuevo Rol / Función</label>
                        <input type="text" name="name" id="role-name-input" class="form-control" placeholder="Ej. Logística" required>
                    </div>
                    <button type="submit" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Guardar</button>
                    ${document.getElementById('role-id-input') && document.getElementById('role-id-input').value ?
                `<button type="button" class="btn btn-secondary" onclick="Admin.resetRoleForm()">Cancelar</button>` : ''}
                </form>
            </div>

            <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-top: 15px;">
                ${this.state.roles.map(r => `
                    <li class="glass" style="padding: 15px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--primary-color);">
                        <span style="font-weight: 500; font-size: 1.05em;">${r.name}</span>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-secondary btn-sm" onclick="Admin.editRole(${r.id})"><i class="ph-bold ph-pencil-simple"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="Admin.deleteRole(${r.id})"><i class="ph-bold ph-trash"></i></button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    },

    editRole(id) {
        const role = this.state.roles.find(r => r.id === id);
        if (!role) return;

        // Fill inputs directly — no re-render needed (avoids losing listeners)
        const idInput = document.getElementById('role-id-input');
        const nameInput = document.getElementById('role-name-input');
        const submitBtn = document.querySelector('#add-role-form button[type="submit"]');

        if (idInput && nameInput) {
            idInput.value = role.id;
            nameInput.value = role.name;
            nameInput.focus();
            if (submitBtn) submitBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Actualizar';

            // Show cancel button if not present
            let cancelBtn = document.getElementById('role-cancel-btn');
            if (!cancelBtn) {
                cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.id = 'role-cancel-btn';
                cancelBtn.className = 'btn btn-secondary';
                cancelBtn.innerHTML = 'Cancelar';
                cancelBtn.onclick = () => Admin.resetRoleForm();
                document.getElementById('add-role-form').appendChild(cancelBtn);
            }
        }
    },

    resetRoleForm() {
        const idInput = document.getElementById('role-id-input');
        const nameInput = document.getElementById('role-name-input');
        const submitBtn = document.querySelector('#add-role-form button[type="submit"]');
        const cancelBtn = document.getElementById('role-cancel-btn');
        if (idInput) idInput.value = '';
        if (nameInput) { nameInput.value = ''; nameInput.focus(); }
        if (submitBtn) submitBtn.innerHTML = '<i class="ph-bold ph-plus"></i> Guardar';
        if (cancelBtn) cancelBtn.remove();
    },

    async createRole(data) {
        try {
            await fetch('api/service_roles.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await this.fetchData();
            this.render();
        } catch (e) { console.error(e); }
    },

    async updateRole(data) {
        try {
            await fetch('api/service_roles.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await this.fetchData();
            this.render();
        } catch (e) { console.error(e); }
    },

    async deleteRole(id) {
        if (!confirm('¿Eliminar este rol?')) return;
        try {
            await fetch('api/service_roles.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            await this.fetchData();
            this.render();
        } catch (e) { console.error(e); }
    },

    // --- SWAPS TAB ---
    renderSwapsTab() {
        const swaps = this.state.swaps;
        if (swaps.length === 0) {
            return '<p class="text-muted" style="padding: 20px 0;">No hay solicitudes de cambio de turno pendientes.</p>';
        }
        return `
            <div style="max-height: 500px; overflow-y: auto;">
                ${swaps.map(s => `
                <div class="glass" style="padding: 15px 20px; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-weight: 600; font-size: 1em;">${s.event_name}</div>
                        <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 2px;">
                            ${s.event_date} &middot; ${s.event_time ? s.event_time.substring(0, 5) : ''} &middot; Rol: <strong>${s.role}</strong>
                        </div>
                        <div style="font-size: 0.82em; margin-top: 4px;">
                            Solicitado por: <strong>${s.requester_name}</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-danger btn-sm" onclick="Admin.rejectSwap(${s.id})">
                            <i class="ph-bold ph-x"></i> Rechazar
                        </button>
                    </div>
                </div>
                `).join('')}
            </div>
        `;
    },

    async rejectSwap(id) {
        if (!confirm('¿Rechazar esta solicitud de cambio?')) return;
        try {
            // Mark as rejected by updating status via a custom endpoint
            // For now delete the swap row (cleanest approach)
            await fetch('api/swaps.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject_swap', swap_id: id })
            });
            await this.fetchData();
            this.render();
        } catch (e) { console.error(e); }
    },

    // --- REPORTS ---
    async generateMonthlyReport() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("La librería para PDF aún no está cargada. Inténtalo de nuevo en un segundo.");
            return;
        }

        const btn = document.querySelector('button[onclick="Admin.generateMonthlyReport()"]');
        if (btn) btn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Generando...';

        try {
            const date = new Date();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            const response = await fetch(`api/reports.php?month=${month}&year=${year}`);
            const data = await response.json();

            // Stats dictionary: { role: { user_name: count } }
            const stats = {};
            data.forEach(event => {
                if (event.assignments) {
                    event.assignments.forEach(a => {
                        if (!stats[a.role]) stats[a.role] = {};
                        if (!stats[a.role][a.user_name]) stats[a.role][a.user_name] = 0;
                        stats[a.role][a.user_name]++;
                    });
                }
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.setTextColor(40, 40, 40);
            doc.text("Reporte Mensual de Servicio", 14, 22);

            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`KRS Servidores - ${monthNames[month - 1]} ${year}`, 14, 30);

            let currentY = 40;

            // Generate Tables per Area
            for (const [role, users] of Object.entries(stats)) {
                const tableData = Object.entries(users)
                    .sort((a, b) => b[1] - a[1]) // highest count first
                    .map(([name, count]) => [name, count + (count === 1 ? ' vez' : ' veces')]);

                if (tableData.length > 0) {
                    doc.autoTable({
                        startY: currentY,
                        head: [[`Rol: ${role}`, 'Servicios Realizados']],
                        body: tableData,
                        theme: 'striped',
                        headStyles: { fillColor: [41, 121, 255] },
                        margin: { top: 10, left: 14, right: 14 }
                    });

                    currentY = doc.lastAutoTable.finalY + 15;

                    // Prevent page break cut-offs manually if it gets too close to bottom
                    if (currentY > 260) {
                        doc.addPage();
                        currentY = 20;
                    }
                }
            }

            if (Object.keys(stats).length === 0) {
                doc.setFontSize(11);
                doc.text("No se registraron voluntarios sirviendo este mes.", 14, currentY);
            }

            doc.save(`KRS_Reporte_${monthNames[month - 1]}_${year}.pdf`);

        } catch (e) {
            console.error(e);
            alert("Error al generar el reporte PDF.");
        } finally {
            if (btn) btn.innerHTML = '<i class="ph-bold ph-file-pdf"></i> Generar Reporte Mensual';
        }
    }
};
