export default function handler(req, res) {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const publicVapidKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicVapidKey) {
        return res.status(500).json({ error: "Missing VAPID_PUBLIC_KEY in Environment Variables" });
    }

    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({ publicKey: publicVapidKey });
}
