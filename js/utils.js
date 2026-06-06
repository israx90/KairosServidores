/**
 * KRS Utility Functions
 * Shared helpers to avoid circular imports
 */

/**
 * Genera HTML de avatar: foto de perfil si existe, o círculo con iniciales.
 * @param {object} user - Objeto con name, alias, profile_pic
 * @param {string} size - CSS size (ej. '40px', '100%')
 * @returns {string} HTML string
 */
export function getAvatarHTML(user, size = '40px') {
    const pic = user && user.profile_pic;
    const hasPic = pic &&
        pic !== 'null' &&
        pic !== 'assets/default-avatar.svg' &&
        pic !== '';

    if (hasPic) {
        // Create the fallback HTML
        const fallback = getInitialsAvatar(user ? (user.alias || user.name) : '?', size);

        // Return img tag cleanly without complex inline JS that causes syntax errors.
        // If image fails, hide it and the container will show the background or we can just return initials if we can't reliably catch it inline.
        // Actually, the safest way without quoting hell is encoding the fallback as base64, but let's just use string replacement on error.
        const safeFallback = fallback.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<img src="${pic}" alt="Avatar" style="width:${size};height:${size};object-fit:cover;border-radius:50%;" onerror="this.outerHTML='${safeFallback}'">`;
    }

    return getInitialsAvatar(user ? (user.alias || user.name) : '?', size);
}

/**
 * Genera el HTML del círculo con iniciales.
 * @param {string} nameOrAlias
 * @param {string} size
 * @returns {string} HTML string
 */
export function getInitialsAvatar(nameOrAlias, size = '40px') {
    const initials = (nameOrAlias || '?')
        .trim()
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const colors = ['#2979ff', '#e91e63', '#9c27b0', '#00bcd4', '#4caf50', '#ff5722', '#ffc107'];
    let hash = 0;
    for (let i = 0; i < (nameOrAlias || '').length; i++) {
        hash = nameOrAlias.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    const fontSize = `calc(${size} * 0.4)`;
    return `<div style="width:${size};height:${size};border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize};color:#fff;letter-spacing:1px;flex-shrink:0;">${initials}</div>`;
}

/**
 * Muestra una notificación Toast elegante (mejor que los alerts).
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - 'success', 'error', o 'info'.
 */
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 9999; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
        'success': 'var(--success-color, #4caf50)',
        'error': 'var(--danger-color, #f44336)',
        'info': 'var(--primary-color, #2979ff)'
    };
    const icons = {
        'success': '<i class="ph-bold ph-check-circle"></i>',
        'error': '<i class="ph-bold ph-warning-circle"></i>',
        'info': '<i class="ph-bold ph-info"></i>'
    };

    toast.style.cssText = `
        background: rgba(15, 20, 30, 0.95);
        border-left: 4px solid ${bgColors[type] || bgColors['info']};
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: inherit;
        font-size: 0.95rem;
        backdrop-filter: blur(10px);
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
    `;

    toast.innerHTML = `
        <div style="color: ${bgColors[type] || bgColors['info']}; font-size: 1.2rem; display: flex;">
            ${icons[type] || icons['info']}
        </div>
        <div>${message}</div>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
