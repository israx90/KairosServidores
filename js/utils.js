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
