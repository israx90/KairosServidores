/**
 * Reports Component
 * Generates Printable PDF Reports
 */

export const Reports = {
    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.renderSelector();
    },

    renderSelector() {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        this.container.innerHTML = `
            <div class="glass" style="padding: 20px; border-radius: 20px;">
                <h2><i class="ph-bold ph-file-pdf"></i> Reportes</h2>
                <div style="display: flex; gap: 10px; margin: 20px 0; align-items: flex-end;">
                    <div class="input-group" style="margin-bottom: 0; flex: 1;">
                        <label>Mes</label>
                        <select id="report-month" class="form-control">
                            <option value="1" ${currentMonth == 1 ? 'selected' : ''}>Enero</option>
                            <option value="2" ${currentMonth == 2 ? 'selected' : ''}>Febrero</option>
                            <option value="3" ${currentMonth == 3 ? 'selected' : ''}>Marzo</option>
                            <option value="4" ${currentMonth == 4 ? 'selected' : ''}>Abril</option>
                            <option value="5" ${currentMonth == 5 ? 'selected' : ''}>Mayo</option>
                            <option value="6" ${currentMonth == 6 ? 'selected' : ''}>Junio</option>
                            <option value="7" ${currentMonth == 7 ? 'selected' : ''}>Julio</option>
                            <option value="8" ${currentMonth == 8 ? 'selected' : ''}>Agosto</option>
                            <option value="9" ${currentMonth == 9 ? 'selected' : ''}>Septiembre</option>
                            <option value="10" ${currentMonth == 10 ? 'selected' : ''}>Octubre</option>
                            <option value="11" ${currentMonth == 11 ? 'selected' : ''}>Noviembre</option>
                            <option value="12" ${currentMonth == 12 ? 'selected' : ''}>Diciembre</option>
                        </select>
                    </div>
                    <div class="input-group" style="margin-bottom: 0; flex: 1;">
                        <label>Año</label>
                        <input type="number" id="report-year" class="form-control" value="${currentYear}">
                    </div>
                    <button id="generate-report-btn" class="btn btn-primary" style="height: 46px;">
                        Generar Reporte
                    </button>
                    <button id="print-report-btn" class="btn btn-secondary" style="height: 46px; display: none;">
                        <i class="ph-bold ph-printer"></i> Imprimir / PDF
                    </button>
                </div>
                
                <div id="report-content" class="report-preview" style="margin-top: 30px; display: none;">
                    <!-- Report Table will go here -->
                </div>
            </div>
        `;

        document.getElementById('generate-report-btn').addEventListener('click', () => this.generateReport());
        document.getElementById('print-report-btn').addEventListener('click', () => window.print());
    },

    async generateReport() {
        const month = document.getElementById('report-month').value;
        const year = document.getElementById('report-year').value;
        const container = document.getElementById('report-content');
        const printBtn = document.getElementById('print-report-btn');

        container.innerHTML = '<p>Cargando datos...</p>';
        container.style.display = 'block';

        try {
            const response = await fetch(`api/reports.php?month=${month}&year=${year}`);
            const data = await response.json();

            if (!data || data.length === 0) {
                container.innerHTML = '<p class="text-muted">No se encontraron eventos para este mes.</p>';
                printBtn.style.display = 'none';
                return;
            }

            let html = `
                <div class="report-header" style="text-align: center; margin-bottom: 30px;">
                    <h1>Reporte Mensual de Servicios</h1>
                    <p>KRS Servidores - ${month}/${year}</p>
                </div>
            `;

            data.forEach(event => {
                html += `
                    <div class="report-event" style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; page-break-inside: avoid;">
                        <h3 style="margin-bottom: 10px; color: #000;">${event.name} (${event.type})</h3>
                        <p style="margin-bottom: 10px; color: #555;">${event.event_date} - ${event.event_time}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                            <thead>
                                <tr style="background: #f0f0f0; text-align: left;">
                                    <th style="padding: 8px; border: 1px solid #ddd;">Rol</th>
                                    <th style="padding: 8px; border: 1px solid #ddd;">Servidor</th>
                                    <th style="padding: 8px; border: 1px solid #ddd;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${event.assignments.map(a => `
                                    <tr>
                                        <td style="padding: 8px; border: 1px solid #ddd;">${a.role}</td>
                                        <td style="padding: 8px; border: 1px solid #ddd;">${a.user_name || 'Sin asignar'}</td>
                                        <td style="padding: 8px; border: 1px solid #ddd;">${a.status}</td>
                                    </tr>
                                `).join('')}
                                ${event.assignments.length === 0 ? '<tr><td colspan="3" style="padding: 8px; text-align: center;">Sin asignaciones</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            });

            container.innerHTML = html;
            printBtn.style.display = 'inline-flex';

        } catch (error) {
            console.error(error);
            container.innerHTML = '<p class="text-danger">Error al generar reporte.</p>';
        }
    }
};
