const webpush = require('web-push');

export default function handler(req, res) {
    // Solo permitir GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const vapidKeys = webpush.generateVAPIDKeys();
        
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Claves VAPID Generadas</h2>
                <p>Copia estas claves y añádelas como <strong>Environment Variables</strong> en tu proyecto de Vercel.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <strong>VAPID_PUBLIC_KEY</strong><br>
                    <code style="word-break: break-all; color: #d32f2f;">${vapidKeys.publicKey}</code>
                </div>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
                    <strong>VAPID_PRIVATE_KEY</strong><br>
                    <code style="word-break: break-all; color: #d32f2f;">${vapidKeys.privateKey}</code>
                </div>
                <p style="color: red; margin-top: 20px;">⚠️ NUNCA compartas la clave privada públicamente en el código frontend.</p>
            </div>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
