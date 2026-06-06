/**
 * API Wrapper & Supabase Emulation Layer for Servidor KRS
 * Intercepts all fetch requests to api/ and routes them to Supabase
 */

const { createClient } = window.supabase;
const supabase = createClient(
    'https://sogmgtmphblxzdxwvazt.supabase.co',
    'sb_publishable_lnjvweRtNSRgiYoDzMhH2w_Nm-sTpUM'
);

// Helper to construct a standard wrapped response
function jsonResponse(data, message = "OK", success = true) {
    return new Response(JSON.stringify({
        success,
        message,
        data
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Helper to construct a raw JSON response
function rawResponse(data) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Get current user helper from cache
function getCurrentUser() {
    try {
        const u = localStorage.getItem('krs_user');
        return u ? JSON.parse(u) : null;
    } catch (e) {
        return null;
    }
}

// Get bcrypt library from any known namespace
function getBcrypt() {
    if (window.dcodeIO && window.dcodeIO.bcrypt) return window.dcodeIO.bcrypt;
    if (window.bcrypt) return window.bcrypt;
    if (typeof bcrypt !== 'undefined') return bcrypt;
    return null;
}

// Intercept window.fetch
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    let urlStr = typeof url === 'string' ? url : (url instanceof Request ? url.url : url.toString());

    // Check if it's a local API call (not Supabase or external)
    const isLocalApi = urlStr.includes('api/') && !urlStr.includes('supabase.co');
    if (isLocalApi) {
        try {
            return await handleMockApi(urlStr, options);
        } catch (error) {
            console.error('Mock API Error:', error);
            return jsonResponse(null, 'Error interno del emulador: ' + error.message, false);
        }
    }

    // Default to normal fetch
    return originalFetch.apply(this, arguments);
};

async function handleMockApi(urlStr, options) {
    const urlObj = new URL(urlStr, window.location.origin);
    const path = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    const method = (options.method || 'GET').toUpperCase();
    
    // Parse body if present
    let body = {};
    let isFormData = false;
    if (options.body) {
        if (options.body instanceof FormData) {
            isFormData = true;
            body = options.body;
        } else {
            try {
                body = JSON.parse(options.body);
            } catch (e) {}
        }
    }

    const currentUser = getCurrentUser();

    // ----------------------------------------------------
    // 1. AUTH ENDPOINT (api/auth.php)
    // ----------------------------------------------------
    if (path.endsWith('auth.php')) {
        if (method === 'POST') {
            const action = body.action;

            if (action === 'login') {
                const { username, password } = body;
                if (!username || !password) {
                    return jsonResponse(null, "Usuario y contraseña requeridos.", false);
                }

                // Call the secure RPC function for login
                const { data, error } = await supabase.rpc('verify_login', {
                    p_username: username,
                    p_password: password
                });

                if (error) {
                    console.error('Supabase RPC login error:', error);
                    return jsonResponse(null, 'Error de conexión con la base de datos: ' + error.message, false);
                }

                if (data && data.success) {
                    const userData = data.data;
                    // Sanitize profile_pic: remove any stale default avatar path
                    if (userData && (userData.profile_pic === 'default_avatar.svg' || userData.profile_pic === 'assets/default-avatar.svg' || userData.profile_pic === 'null')) {
                        userData.profile_pic = null;
                    }
                    return jsonResponse(userData, data.message);
                } else {
                    return jsonResponse(null, data ? data.message : "Contraseña incorrecta.", false);
                }
            }

            else if (action === 'change_password') {
                const { user_id, current_password, new_password, force_reset } = body;
                if (!user_id || !new_password) {
                    return jsonResponse(null, "Faltan datos requeridos.", false);
                }

                // Call the secure RPC function for password change
                const { data, error } = await supabase.rpc('change_password', {
                    p_user_id: user_id,
                    p_current_password: current_password || '',
                    p_new_password: new_password,
                    p_force_reset: force_reset || false
                });

                if (error) {
                    console.error('Supabase RPC change_password error:', error);
                    return jsonResponse(null, 'Error de base de datos: ' + error.message, false);
                }

                if (data && data.success) {
                    // Update localStorage user if it's the current user
                    if (currentUser && currentUser.id == user_id) {
                        currentUser.is_temp_password = force_reset ? true : false;
                        localStorage.setItem('krs_user', JSON.stringify(currentUser));
                    }
                    return jsonResponse(null, data.message);
                } else {
                    return jsonResponse(null, data ? data.message : "Error al cambiar contraseña.", false);
                }
            }
        }
    }

    // ----------------------------------------------------
    // 2. USERS ENDPOINT (api/users.php)
    // ----------------------------------------------------
    if (path.endsWith('users.php')) {
        if (method === 'GET') {
            const id = searchParams.get('id');
            
            // Query users, team memberships and teams
            const { data: users, error: userErr } = await supabase.from('public_users').select('*');
            if (userErr) throw userErr;

            const { data: memberships, error: memErr } = await supabase.from('team_members').select('*');
            if (memErr) throw memErr;

            const { data: teams, error: teamErr } = await supabase.from('teams').select('*');
            if (teamErr) throw teamErr;

            // Map user details with team details
            const mappedUsers = users.map(u => {
                delete u.password_hash;
                const membership = memberships.find(m => m.user_id === u.id);
                if (membership) {
                    const team = teams.find(t => t.id === membership.team_id);
                    return {
                        ...u,
                        team_id: membership.team_id,
                        team_name: team ? team.name : null
                    };
                }
                return { ...u, team_id: null, team_name: null };
            });

            if (id) {
                const user = mappedUsers.find(u => u.id == id);
                return rawResponse(user || null);
            } else {
                // Apply coordinator restriction
                let filteredUsers = mappedUsers;
                if (currentUser && currentUser.role === 'coordinator') {
                    filteredUsers = mappedUsers.filter(u => u.role === 'server');
                }
                // Order by name ASC
                filteredUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                return rawResponse(filteredUsers);
            }
        }

        else if (method === 'POST') {
            const { alias, name, email, phone, role } = body;
            if (!alias) {
                return jsonResponse(null, "El Alias es obligatorio.", false);
            }

            const userName = name || alias;
            const userEmail = email || null;
            const userPhone = phone || '';
            const userRole = role || 'server';

            // Call secure RPC for user creation (handles hashing server-side)
            const { data, error } = await supabase.rpc('create_user_with_hash', {
                p_name: userName,
                p_alias: alias,
                p_email: userEmail,
                p_phone: userPhone,
                p_role: userRole
            });

            if (error) {
                console.error('Supabase RPC create_user_with_hash error:', error);
                return jsonResponse(null, "Error: " + error.message, false);
            }

            if (data && data.success) {
                return jsonResponse(data.data, data.message);
            } else {
                return jsonResponse(null, data ? data.message : "Error al crear usuario.", false);
            }
        }

        else if (method === 'PUT') {
            const { id, name, alias, email, phone, birthdate, role } = body;
            if (!id) return rawResponse({ success: false, message: 'User ID required' });

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (alias !== undefined) updates.alias = alias;
            if (email !== undefined) updates.email = email;
            if (phone !== undefined) updates.phone = phone;
            if (birthdate !== undefined) updates.birthdate = birthdate;
            if (role !== undefined && currentUser && currentUser.role === 'admin') updates.role = role;

            const { error } = await supabase
                .from('public_users')
                .update(updates)
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'User Updated' });
        }

        else if (method === 'DELETE') {
            const { id } = body;
            if (!id) return rawResponse({ success: false, message: 'User ID required' });

            // Delete cascading dependencies first
            await supabase.from('assignments').delete().eq('user_id', id);
            await supabase.from('team_members').delete().eq('user_id', id);
            await supabase.from('swaps').delete().eq('requester_id', id);
            await supabase.from('swaps').delete().eq('target_user_id', id);

            const { error } = await supabase
                .from('public_users')
                .delete()
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Usuario Eliminado' });
        }
    }

    // ----------------------------------------------------
    // 3. TEAMS ENDPOINT (api/teams.php)
    // ----------------------------------------------------
    if (path.endsWith('teams.php')) {
        if (method === 'GET') {
            const id = searchParams.get('id');

            const { data: users, error: userErr } = await supabase.from('public_users').select('id, name, role, profile_pic');
            if (userErr) throw userErr;

            if (id) {
                // Fetch team
                const { data: team, error: teamErr } = await supabase.from('teams').select('*').eq('id', id).single();
                if (teamErr) throw teamErr;

                if (team) {
                    const coord = users.find(u => u.id === team.coordinator_id);
                    team.coordinator_name = coord ? coord.name : null;

                    // Fetch members
                    const { data: memberships, error: memErr } = await supabase.from('team_members').select('*').eq('team_id', id);
                    if (memErr) throw memErr;

                    team.members = memberships.map(m => {
                        const u = users.find(usr => usr.id === m.user_id);
                        return u ? { id: u.id, name: u.name, role: u.role, profile_pic: u.profile_pic } : null;
                    }).filter(Boolean);
                }

                return rawResponse(team);
            } else {
                // Fetch all teams
                const { data: teams, error: teamErr } = await supabase.from('teams').select('*');
                if (teamErr) throw teamErr;

                const { data: memberships, error: memErr } = await supabase.from('team_members').select('team_id');
                if (memErr) throw memErr;

                const mappedTeams = teams.map(t => {
                    const coord = users.find(u => u.id === t.coordinator_id);
                    const count = memberships.filter(m => m.team_id === t.id).length;
                    return {
                        ...t,
                        coordinator_name: coord ? coord.name : null,
                        member_count: count
                    };
                });

                return rawResponse(mappedTeams);
            }
        }

        else if (method === 'POST') {
            const action = body.action;

            if (action === 'add_member') {
                const { team_id, user_id } = body;
                if (!team_id || !user_id) {
                    return rawResponse({ success: false, message: 'Team ID and User ID required' });
                }

                const { error } = await supabase
                    .from('team_members')
                    .insert([{ team_id, user_id }]);

                if (error) {
                    if (error.code === '23505') {
                        return rawResponse({ success: false, message: 'User is already in this team' });
                    }
                    return rawResponse({ success: false, message: 'Error: ' + error.message });
                }
                return rawResponse({ success: true, message: 'Member Added to Team' });
            }

            else if (action === 'remove_member') {
                const { team_id, user_id } = body;
                if (!team_id || !user_id) {
                    return rawResponse({ success: false, message: 'Team ID and User ID required' });
                }

                const { error } = await supabase
                    .from('team_members')
                    .delete()
                    .eq('team_id', team_id)
                    .eq('user_id', user_id);

                if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
                return rawResponse({ success: true, message: 'Member Removed from Team' });
            }

            else {
                // Create team
                const { name, coordinator_id } = body;
                if (!name) {
                    return rawResponse({ success: false, message: 'Team Name required' });
                }

                const { data, error } = await supabase
                    .from('teams')
                    .insert([{ name, coordinator_id: coordinator_id || null }])
                    .select();

                if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
                return rawResponse({ success: true, message: 'Team Created', id: data[0].id });
            }
        }

        else if (method === 'PUT') {
            const { id, name, coordinator_id } = body;
            if (!id) return rawResponse({ success: false, message: 'Team ID required' });

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (coordinator_id !== undefined) updates.coordinator_id = coordinator_id || null;

            const { error } = await supabase
                .from('teams')
                .update(updates)
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Team Updated' });
        }

        else if (method === 'DELETE') {
            const { id } = body;
            if (!id) return rawResponse({ success: false, message: 'Team ID required' });

            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Team Deleted' });
        }
    }

    // ----------------------------------------------------
    // 4. EVENTS ENDPOINT (api/events.php)
    // ----------------------------------------------------
    if (path.endsWith('events.php')) {
        if (method === 'GET') {
            const id = searchParams.get('id');

            const { data: eventTypes, error: typeErr } = await supabase.from('event_types').select('*');
            if (typeErr) throw typeErr;

            if (id) {
                const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', id).single();
                if (evErr) throw evErr;

                if (event) {
                    const et = eventTypes.find(type => type.name === event.type);
                    event.color = et ? et.color : '#2979ff';
                }
                return rawResponse(event);
            } else {
                const { data: events, error: evErr } = await supabase.from('events').select('*').order('event_date', { ascending: true }).order('event_time', { ascending: true });
                if (evErr) throw evErr;

                const mappedEvents = events.map(e => {
                    const et = eventTypes.find(type => type.name === e.type);
                    return {
                        ...e,
                        color: et ? et.color : '#2979ff'
                    };
                });
                return rawResponse(mappedEvents);
            }
        }

        else if (method === 'POST') {
            const action = body.action;

            if (action === 'batch_create') {
                const eventsList = body.events;
                if (!Array.isArray(eventsList)) {
                    return rawResponse({ success: false, message: 'Events array required' });
                }

                let createdCount = 0;
                let errorCount = 0;

                for (const e of eventsList) {
                    const { error } = await supabase
                        .from('events')
                        .insert([{
                            name: e.name,
                            event_date: e.event_date,
                            event_time: e.event_time || '00:00:00',
                            type: e.type || 'General'
                        }]);

                    if (error) errorCount++;
                    else createdCount++;
                }

                return rawResponse({
                    success: true,
                    message: `${createdCount} events created. ${errorCount} failed (duplicates).`
                });
            } else {
                // Create single event
                const { name, event_date, event_time, type } = body;
                if (!name || !event_date || !event_time || !type) {
                    return rawResponse({ success: false, message: 'All fields (name, date, time, type) are required' });
                }

                const cleanDate = event_date.replace(/[^0-9\-]/g, '');
                const cleanTime = event_time || '00:00:00';

                const { data, error } = await supabase
                    .from('events')
                    .insert([{
                        name,
                        event_date: cleanDate,
                        event_time: cleanTime,
                        type
                    }])
                    .select();

                if (error) {
                    if (error.code === '23505') {
                        return rawResponse({ success: false, message: 'Duplicate event: An event with this name already exists at this time.' });
                    }
                    return rawResponse({ success: false, message: 'Error: ' + error.message });
                }
                return rawResponse({ success: true, message: 'Event Created', id: data[0].id });
            }
        }

        else if (method === 'PUT') {
            const { id, name, event_date, event_time, type } = body;
            if (!id) return rawResponse({ success: false, message: 'Event ID required' });

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (event_date !== undefined) updates.event_date = event_date;
            if (event_time !== undefined) updates.event_time = event_time;
            if (type !== undefined) updates.type = type;

            const { error } = await supabase
                .from('events')
                .update(updates)
                .eq('id', id);

            if (error) {
                if (error.code === '23505') {
                    return rawResponse({ success: false, message: 'Duplicate event conflict.' });
                }
                return rawResponse({ success: false, message: 'Error: ' + error.message });
            }
            return rawResponse({ success: true, message: 'Event Updated' });
        }

        else if (method === 'DELETE') {
            const action = body.action;

            if (action === 'batch_delete') {
                const ids = body.ids;
                if (!Array.isArray(ids)) {
                    return rawResponse({ success: false, message: 'IDs array required' });
                }

                const { error } = await supabase
                    .from('events')
                    .delete()
                    .in('id', ids);

                if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
                return rawResponse({ success: true, message: 'Events Deleted' });
            } else {
                const { id } = body;
                if (!id) return rawResponse({ success: false, message: 'Event ID required' });

                const { error } = await supabase
                    .from('events')
                    .delete()
                    .eq('id', id);

                if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
                return rawResponse({ success: true, message: 'Event Deleted' });
            }
        }
    }

    // ----------------------------------------------------
    // 5. ASSIGNMENTS ENDPOINT (api/assignments.php)
    // ----------------------------------------------------
    if (path.endsWith('assignments.php')) {
        if (method === 'GET') {
            const event_id = searchParams.get('event_id');
            const user_id = searchParams.get('user_id');

            if (event_id) {
                // Get assignments for a specific event
                const { data: assignments, error: assErr } = await supabase
                    .from('assignments')
                    .select('*')
                    .eq('event_id', event_id);
                if (assErr) throw assErr;

                if (assignments.length === 0) return rawResponse([]);

                const { data: users, error: usrErr } = await supabase.from('public_users').select('id, name, alias, profile_pic, phone');
                if (usrErr) throw usrErr;

                const { data: teams, error: tmErr } = await supabase.from('teams').select('id, name');
                if (tmErr) throw tmErr;

                const mapped = assignments.map(a => {
                    const u = users.find(usr => usr.id === a.user_id);
                    const t = teams.find(team => team.id === a.team_id);
                    return {
                        ...a,
                        user_name: u ? u.name : 'Desconocido',
                        user_alias: u ? u.alias : '',
                        profile_pic: u ? u.profile_pic : 'assets/default-avatar.svg',
                        phone: u ? u.phone : null,
                        team_name: t ? t.name : null
                    };
                });
                return rawResponse(mapped);
            } else if (user_id) {
                // Get assignments for a specific user
                const { data: assignments, error: assErr } = await supabase
                    .from('assignments')
                    .select('*')
                    .eq('user_id', user_id);
                if (assErr) throw assErr;

                if (assignments.length === 0) return rawResponse([]);

                const { data: events, error: evErr } = await supabase.from('events').select('*');
                if (evErr) throw evErr;

                const mapped = assignments.map(a => {
                    const e = events.find(ev => ev.id === a.event_id);
                    return e ? {
                        ...a,
                        event_name: e.name,
                        event_date: e.event_date,
                        event_time: e.event_time,
                        type: e.type
                    } : null;
                }).filter(Boolean);

                // Sort by event date
                mapped.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
                return rawResponse(mapped);
            } else {
                return rawResponse({ success: false, message: 'Event ID or User ID required' });
            }
        }

        else if (method === 'POST') {
            const { event_id, user_id, team_id, role } = body;
            if (!event_id || !user_id || !role) {
                return rawResponse({ success: false, message: 'Event, User, and Role required' });
            }

            const { data, error } = await supabase
                .from('assignments')
                .insert([{
                    event_id,
                    user_id,
                    team_id: team_id || null,
                    role,
                    status: 'pending'
                }])
                .select();

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Assignment Created', id: data[0].id });
        }

        else if (method === 'PUT') {
            const { id, status, role, team_id } = body;
            if (!id) return rawResponse({ success: false, message: 'Assignment ID required' });

            const updates = {};
            if (status !== undefined) updates.status = status;
            if (role !== undefined) updates.role = role;
            if (team_id !== undefined) updates.team_id = team_id || null;

            const { error } = await supabase
                .from('assignments')
                .update(updates)
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Assignment Updated' });
        }

        else if (method === 'DELETE') {
            const { id } = body;
            if (!id) return rawResponse({ success: false, message: 'Assignment ID required' });

            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', id);

            if (error) return rawResponse({ success: false, message: 'Error: ' + error.message });
            return rawResponse({ success: true, message: 'Assignment Deleted' });
        }
    }

    // ----------------------------------------------------
    // 6. SWAPS ENDPOINT (api/swaps.php)
    // ----------------------------------------------------
    if (path.endsWith('swaps.php')) {
        if (method === 'GET') {
            const userId = searchParams.get('user_id');
            if (userId) {
                const { data: swaps, error: swErr } = await supabase.from('swaps').select('*').eq('status', 'pending');
                if (swErr) throw swErr;

                if (swaps.length === 0) return rawResponse([]);

                // Fetch details
                const { data: assignments, error: assErr } = await supabase.from('assignments').select('*');
                if (assErr) throw assErr;

                const { data: events, error: evErr } = await supabase.from('events').select('*');
                if (evErr) throw evErr;

                const { data: users, error: usrErr } = await supabase.from('public_users').select('id, name');
                if (usrErr) throw usrErr;

                const mappedSwaps = swaps.map(s => {
                    const a = assignments.find(assign => assign.id === s.assignment_id);
                    if (!a) return null;

                    const e = events.find(ev => ev.id === a.event_id);
                    if (!e) return null;

                    const u = users.find(usr => usr.id === s.requester_id);

                    return {
                        ...s,
                        event_name: e.name,
                        event_date: e.event_date,
                        event_time: e.event_time,
                        role: a.role,
                        requester_name: u ? u.name : 'Desconocido'
                    };
                }).filter(Boolean);

                // Sort by event date
                mappedSwaps.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
                return rawResponse(mappedSwaps);
            } else {
                return rawResponse([]);
            }
        }

        else if (method === 'POST') {
            const action = body.action;

            if (action === 'request_swap') {
                const { assignment_id, requester_id } = body;
                if (!assignment_id || !requester_id) {
                    return jsonResponse(null, "Faltan datos", false);
                }

                // Check pending swap
                const { data: existing, error: checkErr } = await supabase
                    .from('swaps')
                    .select('id')
                    .eq('assignment_id', assignment_id)
                    .eq('status', 'pending');
                if (checkErr) throw checkErr;

                if (existing.length > 0) {
                    return jsonResponse(null, "Ya existe una solicitud pendiente para este turno.", false);
                }

                const { error } = await supabase
                    .from('swaps')
                    .insert([{
                        assignment_id,
                        requester_id,
                        status: 'pending'
                    }]);

                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse(null, "Solicitud de cambio creada.");
            }

            else if (action === 'accept_swap') {
                const { swap_id, acceptor_id } = body;
                if (!swap_id || !acceptor_id) {
                    return jsonResponse(null, "Faltan datos", false);
                }

                // Get swap details
                const { data: swap, error: fetchErr } = await supabase
                    .from('swaps')
                    .select('*')
                    .eq('id', swap_id)
                    .eq('status', 'pending')
                    .single();
                
                if (fetchErr || !swap) {
                    return jsonResponse(null, "Solicitud no encontrada o ya procesada.", false);
                }

                if (swap.requester_id == acceptor_id) {
                    return jsonResponse(null, "No puedes aceptar tu propia solicitud.", false);
                }

                // Update assignment user
                const { error: assignErr } = await supabase
                    .from('assignments')
                    .update({ user_id: acceptor_id })
                    .eq('id', swap.assignment_id);
                if (assignErr) throw assignErr;

                // Close swap request
                const { error: swapErr } = await supabase
                    .from('swaps')
                    .update({ status: 'approved', target_user_id: acceptor_id })
                    .eq('id', swap_id);
                if (swapErr) throw swapErr;

                return jsonResponse(null, "¡Cambio realizado con éxito!");
            }

            else if (action === 'reject_swap') {
                const { swap_id } = body;
                if (!swap_id) {
                    return jsonResponse(null, "Swap ID requerido", false);
                }

                const { error } = await supabase
                    .from('swaps')
                    .update({ status: 'rejected' })
                    .eq('id', swap_id);

                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse(null, "Solicitud rechazada.");
            }
        }
    }

    // ----------------------------------------------------
    // 7. EVENT TYPES ENDPOINT (api/event_types.php)
    // ----------------------------------------------------
    if (path.endsWith('event_types.php')) {
        if (method === 'GET') {
            const { data, error } = await supabase.from('event_types').select('*').order('name', { ascending: true });
            if (error) return jsonResponse({ error: error.message }, "Error", false);
            return jsonResponse(data);
        }

        else if (method === 'POST') {
            const { id, name, color, text_color } = body;
            if (!name) return jsonResponse(null, "Missing name", false);

            const typeColor = color || '#ffffff';
            const typeTextColor = text_color || '#000000';

            if (id) {
                // Update
                const { error } = await supabase
                    .from('event_types')
                    .update({ name, color: typeColor, text_color: typeTextColor })
                    .eq('id', id);
                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse(null, "Type updated");
            } else {
                // Create
                const { data, error } = await supabase
                    .from('event_types')
                    .insert([{ name, color: typeColor, text_color: typeTextColor }])
                    .select();
                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse({ id: data[0].id, name }, "Type created");
            }
        }

        else if (method === 'DELETE') {
            const { id } = body;
            if (!id) return jsonResponse(null, "Missing ID", false);

            const { error } = await supabase
                .from('event_types')
                .delete()
                .eq('id', id);

            if (error) return jsonResponse(null, "Error: " + error.message, false);
            return jsonResponse(null, "Type deleted");
        }
    }

    // ----------------------------------------------------
    // 8. SERVICE ROLES ENDPOINT (api/service_roles.php)
    // ----------------------------------------------------
    if (path.endsWith('service_roles.php')) {
        if (method === 'GET') {
            const { data, error } = await supabase.from('service_roles').select('*').order('name', { ascending: true });
            if (error) return jsonResponse({ error: error.message }, "Error", false);
            return jsonResponse(data);
        }

        else if (method === 'POST') {
            const { id, name } = body;
            if (!name) return jsonResponse(null, "Missing name", false);

            if (id) {
                // Update
                const { error } = await supabase
                    .from('service_roles')
                    .update({ name })
                    .eq('id', id);
                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse(null, "Role updated");
            } else {
                // Create
                const { data, error } = await supabase
                    .from('service_roles')
                    .insert([{ name }])
                    .select();
                if (error) return jsonResponse(null, "Error: " + error.message, false);
                return jsonResponse({ id: data[0].id, name }, "Role created");
            }
        }

        else if (method === 'DELETE') {
            const { id } = body;
            if (!id) return jsonResponse(null, "Missing ID", false);

            const { error } = await supabase
                .from('service_roles')
                .delete()
                .eq('id', id);

            if (error) return jsonResponse(null, "Error: " + error.message, false);
            return jsonResponse(null, "Role deleted");
        }
    }

    // ----------------------------------------------------
    // 9. MONTH SUMMARY ENDPOINT (api/month_summary.php)
    // ----------------------------------------------------
    if (path.endsWith('month_summary.php')) {
        if (method === 'GET') {
            const year = searchParams.get('year') || new Date().getFullYear();
            const month = searchParams.get('month') || (new Date().getMonth() + 1);
            const monthStr = String(month).padStart(2, '0');
            const prefix = `${year}-${monthStr}-`;

            // Get events starting with prefix (using gte and lte for date columns)
            const startDate = `${year}-${monthStr}-01`;
            const lastDay = new Date(year, month, 0).getDate(); // Gets the last day of the month
            const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`; 
            const { data: events, error: evErr } = await supabase
                .from('events')
                .select('id, event_date')
                .gte('event_date', startDate)
                .lte('event_date', endDate);
            if (evErr) throw evErr;

            if (events.length === 0) return rawResponse([]);

            const eventIds = events.map(e => e.id);

            // Get assignments for these events
            const { data: assignments, error: assErr } = await supabase
                .from('assignments')
                .select('id, event_id, user_id, status')
                .in('event_id', eventIds);
            if (assErr) throw assErr;

            // Get users to populate avatars
            const userIds = [...new Set(assignments.map(a => a.user_id))];
            let allUsers = [];
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('public_users')
                    .select('id, name, alias, profile_pic')
                    .in('id', userIds);
                if (usersData) allUsers = usersData;
            }

            // Group by event_date
            const summaryMap = {};
            events.forEach(e => {
                const date = e.event_date;
                if (!summaryMap[date]) {
                    summaryMap[date] = {
                        event_date: date,
                        event_count: 0,
                        assigned_count: 0,
                        users: []
                    };
                }
                summaryMap[date].event_count++;
                
                // Count assignments for this event
                const eventAssignments = assignments.filter(a => a.event_id === e.id);
                summaryMap[date].assigned_count += eventAssignments.length;

                // Add to users array (with basic details)
                eventAssignments.forEach(a => {
                    const u = allUsers.find(user => user.id === a.user_id);
                    if (u) {
                        summaryMap[date].users.push({
                            id: u.id,
                            alias: u.alias || u.name,
                            profile_pic: u.profile_pic || 'assets/default-avatar.svg',
                            status: a.status
                        });
                    }
                });
            });

            // Sort by event date
            const result = Object.values(summaryMap);
            result.sort((a, b) => a.event_date.localeCompare(b.event_date));
            return rawResponse(result);
        }
    }

    // ----------------------------------------------------
    // 10. REPORTS ENDPOINT (api/reports.php)
    // ----------------------------------------------------
    if (path.endsWith('reports.php')) {
        if (method === 'GET') {
            const month = searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0');
            const year = searchParams.get('year') || String(new Date().getFullYear());
            const monthStr = String(month).padStart(2, '0');
            const prefix = `${year}-${monthStr}-`;

            // Query all events, assignments and users for the specified month
            const { data: events, error: evErr } = await supabase
                .from('events')
                .select('*')
                .like('event_date', `${prefix}%`);
            if (evErr) throw evErr;

            if (events.length === 0) return rawResponse([]);

            const eventIds = events.map(e => e.id);

            const { data: assignments, error: assErr } = await supabase
                .from('assignments')
                .select('*')
                .in('event_id', eventIds);
            if (assErr) throw assErr;

            const { data: users, error: usrErr } = await supabase
                .from('public_users')
                .select('id, name, alias');
            if (usrErr) throw usrErr;

            const report = events.map(e => {
                const eventAssigns = assignments.filter(a => a.event_id === e.id);
                const mappedAssigns = eventAssigns.map(a => {
                    const u = users.find(usr => usr.id === a.user_id);
                    return {
                        role: a.role,
                        user_name: u ? u.name : 'Desconocido',
                        status: a.status
                    };
                });

                return {
                    id: e.id,
                    name: e.name,
                    date: e.event_date,
                    time: e.event_time,
                    type: e.type,
                    assignments: mappedAssigns
                };
            });

            // Sort by date then time
            report.sort((a, b) => {
                const dateComp = a.date.localeCompare(b.date);
                if (dateComp !== 0) return dateComp;
                return a.time.localeCompare(b.time);
            });

            return rawResponse(report);
        }
    }

    // ----------------------------------------------------
    // 11. REMINDERS ENDPOINT (api/reminders.php)
    // ----------------------------------------------------
    if (path.endsWith('reminders.php')) {
        if (method === 'GET') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            // Get events for tomorrow
            const { data: events, error: evErr } = await supabase
                .from('events')
                .select('*')
                .eq('event_date', tomorrowStr)
                .order('event_time', { ascending: true });
            if (evErr) throw evErr;

            if (events.length === 0) return rawResponse([]);

            const eventIds = events.map(e => e.id);

            const { data: assignments, error: assErr } = await supabase
                .from('assignments')
                .select('*')
                .in('event_id', eventIds);
            if (assErr) throw assErr;

            const { data: users, error: usrErr } = await supabase
                .from('public_users')
                .select('id, name, alias, phone');
            if (usrErr) throw usrErr;

            const mappedEvents = events.map(e => {
                const eventAssigns = assignments.filter(a => a.event_id === e.id);
                const mappedAssigns = eventAssigns.map(a => {
                    const u = users.find(usr => usr.id === a.user_id);
                    return u ? {
                        id: a.id,
                        role: a.role,
                        status: a.status,
                        user_id: u.id,
                        user_name: u.name,
                        alias: u.alias,
                        phone: u.phone
                    } : null;
                }).filter(Boolean);

                mappedAssigns.sort((a, b) => a.role.localeCompare(b.role));

                return {
                    ...e,
                    assignments: mappedAssigns
                };
            }).filter(e => e.assignments.length > 0);

            return rawResponse(mappedEvents);
        }
    }

    // ----------------------------------------------------
    // 12. UPLOAD PROFILE PICTURE (api/upload_profile.php)
    // ----------------------------------------------------
    if (path.endsWith('upload_profile.php')) {
        if (method === 'POST') {
            if (!currentUser) {
                return jsonResponse(null, "No autorizado.", false);
            }

            if (!isFormData) {
                return jsonResponse(null, "No se recibió ninguna imagen.", false);
            }

            const imageFile = body.get('image');
            if (!imageFile) {
                return jsonResponse(null, "No se recibió ninguna imagen.", false);
            }

            // Convert file to base64 Data URL
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(imageFile);
            });

            // Update user in Supabase
            const { error } = await supabase
                .from('public_users')
                .update({ profile_pic: base64Data })
                .eq('id', currentUser.id);

            if (error) {
                return jsonResponse(null, "Error al actualizar la base de datos.", false);
            }

            // Update current user cache
            currentUser.profile_pic = base64Data;
            localStorage.setItem('krs_user', JSON.stringify(currentUser));

            return jsonResponse({ url: base64Data }, "Foto de perfil actualizada.");
        }
    }

    return jsonResponse(null, "Acción o endpoint no emulado: " + path, false);
}

// Keep the old API interface exports just in case
export const API = {
    baseUrl: 'api/',
    async request(endpoint, method = 'GET', data = null) {
        const headers = { 'Content-Type': 'application/json' };
        const config = { method, headers };
        if (data) config.body = JSON.stringify(data);
        const res = await window.fetch(`api/${endpoint}`, config);
        return await res.json();
    },
    get(endpoint) { return this.request(endpoint, 'GET'); },
    post(endpoint, data) { return this.request(endpoint, 'POST', data); },
    put(endpoint, data) { return this.request(endpoint, 'PUT', data); },
    delete(endpoint, data) { return this.request(endpoint, 'DELETE', data); }
};
