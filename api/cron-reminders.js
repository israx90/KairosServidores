const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = 'https://sogmgtmphblxzdxwvazt.supabase.co';
// Need the service_role key to bypass RLS if needed, or public key if public read is ok
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_lnjvweRtNSRgiYoDzMhH2w_Nm-sTpUM'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// VAPID keys should be set in Vercel Environment Variables
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const myWhatsAppNumber = '+59174573450'; // User's requested number

export default async function handler(req, res) {
    // Only allow GET for cron (or POST if triggered manually)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    if (!publicVapidKey || !privateVapidKey) {
        console.error("Faltan VAPID keys en las variables de entorno.");
        return res.status(500).json({ error: "Missing VAPID keys" });
    }

    webpush.setVapidDetails(
        'mailto:admin@krs-servidores.com', // Must be a mailto or URL
        publicVapidKey,
        privateVapidKey
    );

    try {
        // 1. Get tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const y = tomorrow.getFullYear();
        const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const d = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${y}-${m}-${d}`;

        console.log("Revisando eventos para la fecha:", tomorrowStr);

        // 2. Fetch tomorrow's events
        const { data: events, error: evErr } = await supabase
            .from('events')
            .select('id, name, event_time, type')
            .eq('event_date', tomorrowStr);

        if (evErr) throw evErr;
        if (!events || events.length === 0) {
            return res.status(200).json({ message: "No hay eventos para mañana." });
        }

        const eventIds = events.map(e => e.id);

        // 3. Fetch assignments for these events
        const { data: assignments, error: assErr } = await supabase
            .from('assignments')
            .select('id, event_id, user_id, role, status')
            .in('event_id', eventIds);

        if (assErr) throw assErr;
        if (!assignments || assignments.length === 0) {
            return res.status(200).json({ message: "No hay servidores asignados para mañana." });
        }

        // Only send to those who haven't confirmed yet (optional, but good UX)
        // Actually, let's send to everyone, or maybe just those pending. 
        // We will send to everyone so they remember.
        
        const userIds = [...new Set(assignments.map(a => a.user_id))];

        // 4. Fetch push subscriptions for these users
        const { data: subscriptions, error: subErr } = await supabase
            .from('push_subscriptions')
            .select('user_id, subscription_json, endpoint')
            .in('user_id', userIds);

        if (subErr) throw subErr;
        if (!subscriptions || subscriptions.length === 0) {
            return res.status(200).json({ message: "Ningún usuario asignado tiene notificaciones activas." });
        }

        // 5. Send notifications
        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            // Find what they are assigned to
            const userAssignments = assignments.filter(a => a.user_id === sub.user_id);
            if (userAssignments.length === 0) continue;

            const assignment = userAssignments[0]; // Just notify for the first one if multiple
            const event = events.find(e => e.id === assignment.event_id);
            
            // Build the WhatsApp confirmation link
            const waText = `Hola, confirmo mi asistencia para el servicio de *${assignment.role}* (Evento: ${event.name}) mañana a las ${event.event_time}.`;
            const waLink = `https://wa.me/${myWhatsAppNumber.replace('+', '')}?text=${encodeURIComponent(waText)}`;

            const payload = JSON.stringify({
                title: "¡Recordatorio de Servicio!",
                body: `Mañana tienes servicio de ${assignment.role} a las ${event.event_time}. ¡Por favor confirma tu asistencia!`,
                icon: "/assets/logo.png", // Make sure this exists, or use default
                data: {
                    url: waLink,
                    eventId: event.id
                },
                actions: [
                    {
                        action: "confirm-wa",
                        title: "Confirmar por WhatsApp"
                    }
                ]
            });

            try {
                const subObj = JSON.parse(sub.subscription_json);
                await webpush.sendNotification(subObj, payload);
                successCount++;
            } catch (err) {
                console.error('Error sending push to endpoint:', sub.endpoint, err);
                failCount++;
                // If status is 410 (Gone), the user revoked permission, we should delete the subscription
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
            }
        }

        return res.status(200).json({
            message: "Proceso completado",
            successCount,
            failCount
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
