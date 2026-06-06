import { showToast } from '../utils.js';
/**
 * Reminders Component
 * Shows tomorrow's assignments with WhatsApp reminder buttons
 */

export const Reminders = {
    _eventCache: {},

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="glass" style="padding: 25px; border-radius: 20px;">
                <h2 style="margin-bottom: 5px;">
                    <i class="ph-bold ph-bell-ringing"></i> Recordatorios de Mañana
                </h2>
                <p class="text-muted" style="margin-bottom: 20px; font-size: 0.9em;">
                    Envía un recordatorio de WhatsApp a cada servidor asignado para mañana.
                </p>
                <div id="reminders-content">
                    <div style="text-align:center; padding: 30px;">
                        <i class="ph-bold ph-spinner" style="font-size: 2em; animation: spin 1s linear infinite;"></i>
                        <p style="margin-top: 10px;">Cargando asignaciones...</p>
                    </div>
                </div>
            </div>
        `;

        await this.loadReminders();
    },

    async loadReminders() {
        const content = document.getElementById('reminders-content');
        if (!content) return;

        try {
            const res = await fetch('api/reminders.php');
            const events = await res.json();

            if (!Array.isArray(events) || events.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px; opacity: 0.6;">
                        <i class="ph-bold ph-check-circle" style="font-size: 3em; color: #4caf50;"></i>
                        <p style="margin-top: 15px; font-size: 1em;">No hay eventos programados para mañana.</p>
                    </div>
                `;
                return;
            }

            // Format tomorrow's date nicely
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toLocaleDateString('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            let html = `
                <div style="background: rgba(41,121,255,0.1); border: 1px solid var(--primary-color); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; font-size: 0.9em;">
                    📅 <strong>${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</strong>
                    &nbsp;·&nbsp; ${events.reduce((acc, e) => acc + e.assignments.length, 0)} persona(s) asignada(s)
                </div>
            `;

            events.forEach(event => {
                const time = event.event_time ? event.event_time.substring(0, 5) : '';
                html += `
                    <div class="glass" style="padding: 18px 20px; border-radius: 14px; margin-bottom: 16px; border-left: 4px solid var(--primary-color);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                            <div>
                                <div style="font-weight: 700; font-size: 1.05em;">${event.name}</div>
                                <div style="font-size: 0.82em; color: var(--text-secondary); margin-top: 2px;">
                                    ${time} &middot; <span style="text-transform: capitalize;">${event.type}</span>
                                </div>
                            </div>
                            <button class="btn btn-secondary btn-sm" onclick="Reminders.sendAll(${event.id})">
                                <i class="ph-bold ph-paper-plane-tilt"></i> Enviar a todos
                            </button>
                        </div>

                        ${event.assignments.map(a => {
                    const msg = this.buildMessage(a, event);
                    const phone = this.formatPhone(a.phone);
                    const waUrl = phone
                        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
                        : null;

                    return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                                    <div>
                                        <div style="font-weight: 600;">${a.user_name}${a.alias && a.alias !== a.user_name ? ` <span style="font-size:0.8em; opacity:0.6;">(${a.alias})</span>` : ''}</div>
                                        <div style="font-size: 0.82em; color: var(--text-secondary);">
                                            <i class="ph-bold ph-wrench"></i> ${a.role}
                                            ${a.phone ? `&nbsp;&middot;&nbsp; <i class="ph-bold ph-phone"></i> ${a.phone}` : '<span style="opacity:0.5;">&nbsp;· Sin teléfono</span>'}
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        ${waUrl
                            ? `<a href="${waUrl}" target="_blank" class="btn btn-sm"
                                                style="background: #25D366; color: #fff; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-weight: 600; font-size: 0.85em;">
                                                <i class="ph-bold ph-whatsapp-logo"></i> Enviar WhatsApp
                                               </a>`
                            : `<span class="btn btn-secondary btn-sm" style="opacity:0.4; cursor:not-allowed;" title="Sin número registrado">Sin número</span>`
                        }
                                    </div>
                                </div>
                            `;
                }).join('')}
                    </div>
                `;
            });

            // Cache events by id for sendAll
            events.forEach(ev => { Reminders._eventCache[ev.id] = ev; });

            content.innerHTML = html;

        } catch (e) {
            console.error(e);
            content.innerHTML = `<p class="text-danger">Error al cargar los recordatorios.</p>`;
        }
    },

    buildMessage(assignment, event) {
        const name = assignment.alias || assignment.user_name.split(' ')[0];
        const time = event.event_time ? event.event_time.substring(0, 5) : '';
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayName = tomorrow.toLocaleDateString('es-ES', { weekday: 'long' });

        return `¡Que tal ${name}! 👋 Te recuerdo que para mañana (${dayName}) te anotaste para el servicio de *${event.name}* a las *${time}* en el rol de *${assignment.role}*. ¡Muchas gracias por tu apoyo! 🙏🏼🔥`;
    },

    formatPhone(phone) {
        if (!phone) return null;
        // Remove spaces, dashes, parentheses
        let cleaned = phone.replace(/[\s\-\(\)]/g, '');
        // If already has country code (starts with +), just remove +
        if (cleaned.startsWith('+')) return cleaned.substring(1);
        // Bolivia default country code
        if (!cleaned.startsWith('591')) return '591' + cleaned;
        return cleaned;
    },

    sendAll(eventId) {
        const event = this._eventCache[eventId];
        if (!event) return;
        const withPhone = event.assignments.filter(a => a.phone);
        if (withPhone.length === 0) {
            showToast('Ningún servidor tiene número de teléfono registrado.', 'error');
            return;
        }
        // Open each WhatsApp in sequence with a small delay
        withPhone.forEach((a, i) => {
            setTimeout(() => {
                const msg = this.buildMessage(a, event);
                const phone = this.formatPhone(a.phone);
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            }, i * 800);
        });
    }
};


