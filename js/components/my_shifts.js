import { showToast } from '../utils.js';

export const MyShifts = {
    state: {
        shifts: []
    },

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        await this.fetchShifts();
        this.render();
    },

    async fetchShifts() {
        const user = JSON.parse(localStorage.getItem('krs_user'));
        if (!user) return;
        try {
            const res = await fetch(`api/assignments.php?user_id=${user.id}`);
            const data = await res.json();
            this.state.shifts = data;
        } catch (e) {
            console.error('Error fetching shifts', e);
            this.state.shifts = [];
        }
    },

    render() {
        const { shifts } = this.state;
        
        let html = `
            <div class="glass" style="padding: 20px; border-radius: 20px;">
                <h2 style="margin-bottom: 20px;"><i class="ph-bold ph-clipboard-text"></i> Mis Turnos</h2>
        `;

        if (!shifts || shifts.length === 0) {
            html += `<p class="text-muted" style="text-align: center; padding: 20px 0;">No tienes turnos asignados por el momento.</p>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            
            shifts.forEach(s => {
                const dateObj = new Date(s.event_date + 'T' + (s.event_time || '00:00'));
                const isPast = dateObj < new Date();
                const opacity = isPast ? '0.6' : '1';
                
                html += `
                    <div style="opacity: ${opacity}; display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: rgba(41,121,255,0.1); border-radius: 12px; color: var(--primary-color); flex-shrink: 0;">
                            <i class="ph-bold ph-calendar-blank" style="font-size: 20px;"></i>
                        </div>
                        <div style="flex: 1; min-width: 150px;">
                            <div style="font-weight: 600; font-size: 1.05em; margin-bottom: 4px;">${s.event_name}</div>
                            <div class="text-muted" style="font-size: 0.85em; display: flex; align-items: center; gap: 4px;">
                                <i class="ph-bold ph-clock"></i> ${s.event_date} &middot; ${s.event_time ? s.event_time.substring(0, 5) : ''}
                            </div>
                            <div style="margin-top: 8px;">
                                <span style="background: rgba(255,255,255,0.08); padding: 2px 10px; border-radius: 99px; font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${s.type}</span>
                                ${isPast ? `<span style="background: rgba(255,255,255,0.05); color: var(--text-muted); padding: 2px 10px; border-radius: 99px; font-size: 0.72em; font-weight: 700; margin-left: 6px;">COMPLETADO</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;
        this.container.innerHTML = html;
    }
};
