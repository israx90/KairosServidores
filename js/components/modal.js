/**
 * Modal Component
 * Reusable accessible modal
 */

export const Modal = {
    init() {
        if (!document.getElementById('krs-modal')) {
            const modalHtml = `
                <div id="krs-modal-overlay" class="modal-overlay">
                    <div id="krs-modal" class="modal">
                        <div class="modal-header">
                            <h3 id="krs-modal-title">Titulo</h3>
                            <button id="krs-modal-close" class="close-modal"><i class="ph-bold ph-x"></i></button>
                        </div>
                        <div id="krs-modal-content">
                            <!-- Content -->
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Bind Close Events
            document.getElementById('krs-modal-close').addEventListener('click', () => this.close());
            document.getElementById('krs-modal-overlay').addEventListener('click', (e) => {
                if (e.target.id === 'krs-modal-overlay') this.close();
            });
        }
    },

    open(title, contentHtml) {
        this.init(); // Ensure elements exist

        document.getElementById('krs-modal-title').textContent = title;
        document.getElementById('krs-modal-content').innerHTML = contentHtml;

        const overlay = document.getElementById('krs-modal-overlay');
        overlay.classList.add('active');
    },

    close() {
        const overlay = document.getElementById('krs-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            // Optional: Clear content after transition
            setTimeout(() => {
                document.getElementById('krs-modal-content').innerHTML = '';
            }, 300);
        }
    }
};
