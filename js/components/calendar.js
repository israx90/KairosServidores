/**
 * Calendar Component
 * Handles Event Display, Creation, and Editing
 */

import { Modal } from './modal.js';
import { getAvatarHTML } from '../utils.js';

export const Calendar = {
    state: {
        events: [],
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
        users: [],
        eventTypes: [], // Loaded dynamically from API
        monthSummary: [] // Coverage data per day
    },

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        Modal.init();

        await Promise.all([this.fetchEvents(), this.fetchUsers(), this.fetchEventTypes(), this.fetchMonthSummary()]);
        this.render();
    },

    async fetchEvents() {
        try {
            const response = await fetch('api/events.php');
            this.state.events = await response.json();
            // Parse dates safely (avoid UTC shift: "2026-02-26" → local midnight)
            this.state.events.sort((a, b) => {
                const da = new Date(a.event_date + 'T' + (a.event_time || '00:00:00'));
                const db = new Date(b.event_date + 'T' + (b.event_time || '00:00:00'));
                return da - db;
            });
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    },

    async fetchUsers() {
        try {
            // Only fetch users if logged in
            const user = JSON.parse(localStorage.getItem('krs_user'));
            if (user) {
                const response = await fetch('api/users.php');
                this.state.users = await response.json();
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    },

    async fetchEventTypes() {
        try {
            const response = await fetch('api/event_types.php');
            const data = await response.json();
            // Support both plain array and wrapped {data: [...]}
            this.state.eventTypes = Array.isArray(data) ? data
                : (data.data && Array.isArray(data.data) ? data.data : []);
        } catch (error) {
            console.error('Error fetching event types:', error);
            // Fallback
            this.state.eventTypes = [
                { id: 1, name: 'General' },
                { id: 2, name: 'Jovenes' },
                { id: 3, name: 'Especial' }
            ];
        }
    },

    async fetchMonthSummary() {
        try {
            const { currentMonth, currentYear } = this.state;
            const response = await fetch(`api/month_summary.php?year=${currentYear}&month=${currentMonth + 1}`);
            this.state.monthSummary = await response.json();
        } catch (error) {
            console.error('Error fetching month summary:', error);
            this.state.monthSummary = [];
        }
    },

    renderMonthlySummary() {
        const { currentMonth, currentYear, monthSummary, events } = this.state;
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mi\u00e9', 'Jue', 'Vie', 'S\u00e1b'];

        // Only show days that have events this month
        const monthEvents = events.filter(e => {
            const d = new Date(e.event_date + 'T12:00:00');
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        // Group by date
        const dateMap = {};
        monthEvents.forEach(e => {
            if (!dateMap[e.event_date]) dateMap[e.event_date] = [];
            dateMap[e.event_date].push(e);
        });

        // Build assignment lookup from monthSummary
        const coverageLookup = {};
        if (Array.isArray(monthSummary)) {
            monthSummary.forEach(r => { coverageLookup[r.event_date] = r; });
        }

        const sortedDates = Object.keys(dateMap).sort();
        if (sortedDates.length === 0) {
            return `
                <div style="text-align: center; padding: 20px;">
                    <i class="ph-duotone ph-calendar-x" style="font-size: 40px; color: var(--text-muted); margin-bottom: 8px;"></i>
                    <p class="text-muted" style="font-size: 0.9em; margin: 0;">No hay eventos programados este mes.</p>
                </div>`;
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const rows = sortedDates.map(dateStr => {
            const d = new Date(dateStr + 'T12:00:00');
            const dayNum = d.getDate();
            const dayName = dayNames[d.getDay()];
            const evts = dateMap[dateStr];
            const coverage = coverageLookup[dateStr];
            const isCovered = coverage && parseInt(coverage.assigned_count) > 0;
            const isToday = dateStr === todayStr;
            const isPast = new Date(dateStr + 'T23:59:59') < today;

            const statusCls = isCovered ? 'summary-badge covered' : 'summary-badge uncovered';
            const statusIcon = isCovered ? '<i class="ph-bold ph-check"></i>' : '<i class="ph-bold ph-warning"></i>';
            const statusText = isCovered ? `${coverage.assigned_count} vol.` : '\u00a1Vac\u00edo!';
            const todayMark = isToday ? ' style="border-left-color: #ff8c00; padding-left: 6px;"' : '';
            const pastStyle = isPast ? 'opacity: 0.4;' : '';

            // Build event chips
            const eventChips = evts.map(e => {
                const chipColor = e.color || 'var(--primary-color)';
                const time = e.event_time ? e.event_time.substring(0, 5) : '';
                return `
                    <div class="event-chip" style="--chip-color: ${chipColor};">
                        <span class="chip-time" style="color: ${chipColor}">${time}</span>
                        <span class="chip-name">${e.name}</span>
                    </div>
                `;
            }).join('');

            // First event ID for click handler
            const firstEventId = evts[0].id;

            return `
                <div class="summary-item" onclick="Calendar.viewDetails(${firstEventId})" style="cursor: pointer; ${pastStyle}">
                    <div class="summary-date"${todayMark}>
                        <span class="summary-day-name">${dayName}</span>
                        <span class="summary-day-num">${dayNum}</span>
                    </div>
                    <div class="summary-body">
                        ${eventChips}
                    </div>
                    <div class="summary-status">
                        <div class="${statusCls}">${statusIcon} ${statusText}</div>
                    </div>
                </div>`;
        }).join('');

        // Count stats
        const coveredCount = sortedDates.filter(d => coverageLookup[d] && parseInt(coverageLookup[d].assigned_count) > 0).length;
        const uncoveredCount = sortedDates.length - coveredCount;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 0.8em; color: var(--text-muted);"><i class="ph-bold ph-chart-bar" style="margin-right: 4px;"></i>Cobertura</span>
                <div style="display: flex; gap: 12px; font-size: 0.8em;">
                    <span style="color: #00e676;"><i class="ph-bold ph-check-circle"></i> ${coveredCount}</span>
                    <span style="color: #ff1744;"><i class="ph-bold ph-warning-circle"></i> ${uncoveredCount}</span>
                </div>
            </div>
            <div class="summary-table" style="flex: 1; padding-bottom: 20px;">
                ${rows}
            </div>
        `;
    },


    render() {
        const { currentMonth, currentYear } = this.state;
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        const user = JSON.parse(localStorage.getItem('krs_user'));
        const isAdmin = user && (user.role === 'admin' || user.role === 'coordinator');

        let html = `
            <div class="glass" style="padding: 16px; border-radius: 20px; min-height: calc(100vh - 140px); display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <button id="prev-month" class="btn btn-secondary" style="padding: 10px;"><i class="ph-bold ph-caret-left"></i></button>
                    <h2 style="margin: 0; font-size: 1.3em;">${monthNames[currentMonth]} ${currentYear}</h2>
                    <button id="next-month" class="btn btn-secondary" style="padding: 10px;"><i class="ph-bold ph-caret-right"></i></button>
                </div>

                ${this.renderMonthlySummary()}

                ${isAdmin ? `
                <div style="margin-top: 14px; text-align: right;">
                    <button id="add-event-btn" class="btn btn-primary"><i class="ph-bold ph-plus"></i> Nuevo Evento</button>
                </div>
                ` : ''}
            </div>
        `;


        this.container.innerHTML = html;
        window.Calendar = this;
        this.bindEvents();
    },

    renderMobileList(events, year, month) {
        // Today's date (noon to avoid TZ issues)
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        // Filter: only events from today onwards in this month
        const monthEvents = events.filter(e => {
            const d = new Date(e.event_date + 'T12:00:00');
            return d.getFullYear() === year &&
                d.getMonth() === month &&
                d >= today;
        });

        if (monthEvents.length === 0) {
            return '<div class="text-muted" style="text-align: center; padding: 20px;">No hay eventos próximos este mes.</div>';
        }

        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        return monthEvents.map(e => {
            const date = new Date(e.event_date + 'T12:00:00');
            const dayName = dayNames[date.getDay()];
            const dayNumber = date.getDate();
            const chipColor = e.color || 'var(--primary-color)';

            return `
                <div class="glass" onclick="Calendar.viewDetails(${e.id})" style="padding: 15px; border: 1px solid rgba(255,255,255,0.1); border-left: 5px solid ${chipColor}; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="text-align: center; background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 8px; min-width: 50px;">
                            <div style="font-size: 0.8em; color: var(--text-secondary);">${dayName.substring(0, 3)}</div>
                            <div style="font-size: 1.2em; font-weight: bold;">${dayNumber}</div>
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-weight: bold; font-size: 1.05em; color: ${chipColor === '#ffffff' ? 'inherit' : chipColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.name}</div>
                            <div style="color: var(--text-muted); font-size: 0.85em;">${e.event_time ? e.event_time.substring(0, 5) : ''} - ${e.type}</div>
                        </div>
                    </div>
                    <i class="ph-bold ph-caret-right" style="color: var(--text-secondary);"></i>
                </div>
            `;
        }).join('');
    },

    renderDays(startDay, daysInMonth, events, year, month, isAdmin) {
        let html = '';

        // Today for highlighting
        const now = new Date();
        const todayYear = now.getFullYear();
        const todayMonth = now.getMonth();
        const todayDay = now.getDate();

        // Today at midnight for comparison
        const todayMidnight = new Date(todayYear, todayMonth, todayDay);

        // Empty cells before start
        for (let i = 0; i < startDay; i++) {
            html += `<div class="calendar-day empty" style="min-height: 100px; background: rgba(0,0,0,0.2); border-radius: 10px;"></div>`;
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cellDate = new Date(year, month, day);

            // Skip past days (before today)
            const isPast = cellDate < todayMidnight;
            const isToday = year === todayYear && month === todayMonth && day === todayDay;

            // Only show future (or today) events
            const dayEvents = isPast ? [] : events.filter(e => e.event_date === dateStr);

            const pastStyle = isPast
                ? 'opacity: 0.35; pointer-events: none;'
                : '';

            const todayStyle = isToday
                ? 'border: 1.5px solid #ff8c00;'
                : 'border: 1px solid rgba(255,255,255,0.05);';

            html += `
                <div class="calendar-day" style="min-height: 100px; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 10px; position: relative; ${todayStyle} ${pastStyle}">
                    <div style="font-weight: bold; margin-bottom: 5px; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 4px;">
                        ${isToday ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: #ff8c00; display: inline-block;"></span>` : ''}
                        <span style="color: ${isToday ? '#ff8c00' : 'rgba(255,255,255,0.7)'}; font-weight: ${isToday ? '800' : 'bold'}">${day}</span>
                    </div>
                    <div class="day-events">
                        ${dayEvents.map(e => {
                // Use color directly from API JOIN (no need to lookup eventTypes)
                const chipColor = e.color || 'var(--primary-color)';
                const isLight = chipColor === '#ffffff' || chipColor === '#FFD700' || chipColor === '#ffff00';
                const textColor = isLight ? '#000' : '#fff';
                return `
                            <div class="event-chip"
                                onclick="Calendar.viewDetails(${e.id})"
                                style="background: ${chipColor}; color: ${textColor}; padding: 4px 6px; border-radius: 4px; font-size: 0.8em; margin-bottom: 4px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;"
                                title="${e.name} (${e.event_time})">
                                ${e.event_time.substring(0, 5)} ${e.name}
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
        }

        return html;
    },

    bindEvents() {
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        const addBtn = document.getElementById('add-event-btn');

        if (prevBtn) {
            prevBtn.onclick = async () => {
                this.state.currentMonth--;
                if (this.state.currentMonth < 0) {
                    this.state.currentMonth = 11;
                    this.state.currentYear--;
                }
                await this.fetchMonthSummary();
                this.render();
            };
        }

        if (nextBtn) {
            nextBtn.onclick = async () => {
                this.state.currentMonth++;
                if (this.state.currentMonth > 11) {
                    this.state.currentMonth = 0;
                    this.state.currentYear++;
                }
                await this.fetchMonthSummary();
                this.render();
            };
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => this.openCreateModal());
        }
    },

    async openCreateModal() {
        // Always refresh event types fresh from API when opening modal
        await this.fetchEventTypes();

        const content = `
            <form id="create-event-form">
                <div class="input-group">
                    <label>Nombre del Evento</label>
                    <input type="text" name="name" class="form-control" required placeholder="Ej. Culto General">
                </div>
                
                <!-- Date / Range Logic -->
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <div style="flex: 1;">
                         <label>Fecha de Inicio</label>
                        <input type="date" name="event_date" id="start_date" class="form-control" required>
                    </div>
                    <div style="display: flex; align-items: center; margin-top: 25px;">
                        <input type="checkbox" id="range_check" style="margin-right: 5px;"> 
                        <label for="range_check" style="margin: 0; font-size: 0.9em; cursor: pointer;">Rango de Fechas / Recurrencia</label>
                    </div>
                </div>

                <div id="recurrence-options" style="display: none; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <div class="input-group">
                        <label>Fecha Fin</label>
                        <input type="date" name="end_date" id="end_date" class="form-control">
                    </div>
                    <div class="input-group">
                        <label>Frecuencia</label>
                        <select name="frequency" class="form-control">
                            <option value="once">Unico (Solo en el rango si aplica)</option>
                            <option value="weekly">Cada Semana (Mismo día)</option>
                            <option value="biweekly">Semana por Medio</option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label>Hora</label>
                    <input type="time" name="event_time" class="form-control" required>
                     <!-- Browsers handle AM/PM in time input based on locale, usually enough. -->
                </div>
                <div class="input-group">
                    <label>Tipo de Evento</label>
                    <select name="type" id="event-type-select" class="form-control" style="border-left: 4px solid var(--primary-color); transition: border-color 0.2s;">
                        ${(this.state.eventTypes.length > 0 ? this.state.eventTypes : [{ name: 'General', color: '#FFD700' }])
                .map(t => `<option value="${t.name}" data-color="${t.color || '#ffffff'}">${t.name}</option>`).join('')}
                    </select>
                    <div id="type-color-preview" style="display:flex; align-items:center; gap:8px; margin-top:6px; font-size:0.85em; color:var(--text-muted);"></div>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%">Crear Evento(s)</button>
            </form>
        `;

        Modal.open('Nuevo Evento', content);

        // UI Logic for checkbox
        const rangeCheck = document.getElementById('range_check');
        const recurOptions = document.getElementById('recurrence-options');
        const endDateInput = document.getElementById('end_date');

        rangeCheck.addEventListener('change', (e) => {
            recurOptions.style.display = e.target.checked ? 'block' : 'none';
            endDateInput.required = e.target.checked;
        });

        // Color preview for type select
        const typeSelect = document.getElementById('event-type-select');
        const colorPreview = document.getElementById('type-color-preview');
        const updateTypeColor = () => {
            const opt = typeSelect.options[typeSelect.selectedIndex];
            const color = opt ? opt.dataset.color : '#ffffff';
            typeSelect.style.borderLeftColor = color;
            colorPreview.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};"></span> ${opt ? opt.value : ''}`;
        };
        if (typeSelect) {
            typeSelect.addEventListener('change', updateTypeColor);
            updateTypeColor(); // Initialize on open
        }

        document.getElementById('create-event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Handle Batch Logic Client-Side based on Frequency
            if (rangeCheck.checked && data.frequency !== 'once') {
                const events = this.generateRecurringEvents(data);
                this.createBatchEvents(events);
            } else {
                this.createEvent(data);
            }
        });
    },

    generateRecurringEvents(data) {
        const events = [];

        // Parse dates as LOCAL time (not UTC) to avoid timezone shift
        // new Date("YYYY-MM-DD") parses as UTC midnight, which in Bolivia (UTC-4)
        // becomes the previous day at 20:00 local. Using new Date(y,m,d,12) is LOCAL.
        const parseLocalDate = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d, 12, 0, 0, 0); // noon local time
        };

        // Format date back to YYYY-MM-DD using LOCAL components (not UTC)
        const toLocalDateStr = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        let current = parseLocalDate(data.event_date);
        const end = parseLocalDate(data.end_date);

        while (current <= end) {
            events.push({
                name: data.name,
                event_date: toLocalDateStr(current),  // ← local date, no UTC shift
                event_time: data.event_time,
                type: data.type
            });

            // Increment
            if (data.frequency === 'weekly') {
                current.setDate(current.getDate() + 7);
            } else if (data.frequency === 'biweekly') {
                current.setDate(current.getDate() + 14);
            } else {
                break; // Safety
            }
        }
        return events;
    },

    async createBatchEvents(events) {
        try {
            const response = await fetch('api/events.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'batch_create', events: events })
            });
            const result = await response.json();
            if (result.success) {
                alert(result.message);
                Modal.close();
                this.init(this.container.id);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error al crear eventos');
        }
    },

    async createEvent(data) {
        try {
            const response = await fetch('api/events.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                Modal.close();
                this.init(this.container.id); // Refresh
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            console.error(e);
            alert('Error al crear evento');
        }
    },

    async deleteEvent(eventId) {
        if (!confirm('¿Eliminar este evento permanentemente?')) return;

        try {
            const response = await fetch('api/events.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: eventId })
            });
            const result = await response.json();
            if (result.success) {
                this.init(this.container.id); // Refresh
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error al procesar solicitud');
        }
    },

    async viewDetails(eventId) {
        const event = this.state.events.find(e => e.id == eventId);
        if (!event) return;

        // Fetch Assignments ALWAYS (public read)
        const user = JSON.parse(localStorage.getItem('krs_user'));
        let assignments = [];

        try {
            const response = await fetch(`api/assignments.php?event_id=${eventId}`);
            assignments = await response.json();
        } catch (e) {
            console.error(e);
        }

        this.openAssignmentModal(event, assignments, user);
    },

    async openAssignmentModal(event, assignments, user) {
        const isAdmin = user && (user.role === 'admin' || user.role === 'coordinator');
        const isVolunteer = user && user.role === 'server';
        const isAssigned = assignments.some(a => a.user_id == user?.id);

        // Fetch Roles Dynamically if Admin OR Volunteer (for self-assign)
        let roles = [];
        if (user) {
            try {
                const response = await fetch('api/service_roles.php');
                const json = await response.json();
                const roleData = Array.isArray(json) ? json : (json.data || []);
                roles = roleData.map(r => r.name);
            } catch (e) {
                console.error("Error fetching roles", e);
                // Fallback roles
                roles = ['Cámara 1', 'Cámara 2', 'Streaming', 'Pantalla', 'Sonido', 'Comunidad', 'Fotografía'];
            }
        }

        let content = `
            <div style="margin-bottom: 20px;">
                <p><strong>Fecha:</strong> ${event.event_date}</p>
                <p><strong>Hora:</strong> ${event.event_time}</p>
                <p><strong>Tipo:</strong> ${event.type}</p>
            </div>
        `;

        // Assignments List
        content += `
            <h4 style="margin-bottom: 10px;">Voluntarios Asignados</h4>
            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px;">
                ${assignments.length > 0 ? assignments.map(a => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${getAvatarHTML({ name: a.user_name, alias: a.alias, profile_pic: a.profile_pic }, '32px')}
                            <div>
                                <div>${a.user_name}</div>
                                <div class="text-gold" style="font-size: 0.8em;">${a.role}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            ${(user && user.id == a.user_id) ? `
                                <button class="btn btn-warning btn-sm" onclick="Calendar.requestSwap(${a.id}, ${event.id})" title="Solicitar Cambio"><i class="ph-bold ph-arrows-left-right"></i></button>
                            ` : ''}
                            ${isAdmin || (user && user.id == a.user_id) ? `
                                <button class="btn btn-danger btn-sm" onclick="Calendar.deleteAssignment(${a.id}, ${event.id})"><i class="ph-bold ph-trash"></i></button>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : '<p class="text-muted">Nadie ha sido asignado aún.</p>'}
            </div>
        `;

        // Volunteer Self-Assign Button ("Apoyare")
        if (isVolunteer && !isAssigned) {
            content += `
            <div style="margin-top: 20px; text-align: center;">
                <button id="self-assign-btn" class="btn btn-primary" style="width: 100%; font-size: 1.1em;">
                    <i class="ph-bold ph-hand-waving"></i> ¡Apoyaré!
                </button>
                <form id="self-assign-form" style="display: none; margin-top: 15px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; text-align: left;">
                    <h4 style="margin-bottom: 10px;">Selecciona tu rol</h4>
                    <div class="input-group">
                        <label>Rol / Función</label>
                        <select name="role" class="form-control" required>
                            ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" class="btn btn-success" style="width: 100%">Confirmar Asistencia</button>
                </form>
            </div>
            `;
        }

        // Admin Assignment Form
        if (isAdmin) {
            content += `
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">
            <form id="assign-user-form" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                <h4 style="margin-bottom: 10px;">Asignar Voluntario</h4>
                <div class="input-group">
                    <label>Usuario</label>
                    <select name="user_id" class="form-control" required>
                        <option value="">Seleccionar...</option>
                        ${this.state.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label>Rol / Función</label>
                    <select name="role" class="form-control" required>
                        ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn btn-success" style="width: 100%">Asignar</button>
                <button type="button" class="btn btn-danger" style="width: 100%; margin-top: 10px;" onclick="Calendar.deleteEvent(${event.id})">Eliminar Evento</button>
            </form>
            `;
        } else if (!user) {
            content += `<p class="text-muted" style="font-size: 0.9em; margin-top: 10px; text-align: center;">Inicia sesión para editar o asignarte a un turno.</p>`;
        }

        Modal.open(`Detalles: ${event.name}`, content);

        // Bind Self-Assign Toggle
        const selfAssignBtn = document.getElementById('self-assign-btn');
        if (selfAssignBtn) {
            selfAssignBtn.onclick = () => {
                const form = document.getElementById('self-assign-form');
                form.style.display = 'block';
                selfAssignBtn.style.display = 'none';
            };
        }

        // Bind Self-Assign Submit
        const selfAssignForm = document.getElementById('self-assign-form');
        if (selfAssignForm) {
            selfAssignForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                this.createAssignment(event.id, user.id, formData.get('role'));
            });
        }

        if (isAdmin) {
            const form = document.getElementById('assign-user-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    this.createAssignment(event.id, data.user_id, data.role);
                });
            }
        }
    },

    async createAssignment(eventId, userId, role) {
        try {
            const response = await fetch('api/assignments.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId, user_id: userId, role: role })
            });
            const result = await response.json();
            if (result.success) {
                this.viewDetails(eventId); // Refresh modal
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
        }
    },

    async deleteAssignment(assignmentId, eventId) {
        if (!confirm('¿Quitar asignación?')) return;

        try {
            const response = await fetch('api/assignments.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: assignmentId })
            });
            const result = await response.json();
            if (result.success) {
                this.viewDetails(eventId); // Refresh modal
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
        }
    },

    async requestSwap(assignmentId, eventId) {
        if (!confirm('¿Quieres solicitar un cambio para este turno? Aparecerá en el tablero de cambios.')) return;

        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user) return;

        try {
            const response = await fetch('api/swaps.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_swap',
                    assignment_id: assignmentId,
                    requester_id: user.id
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Solicitud de cambio creada exitosamente.');
                this.viewDetails(eventId); // Refresh modal
            } else {
                alert('Error: ' + result.message);
            }
        } catch (e) {
            alert('Error de conexión');
        }
    }
};
