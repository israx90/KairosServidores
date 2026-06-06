/**
 * API Wrapper for Servidor KRS
 */

export const API = {
    baseUrl: 'api/',

    async request(endpoint, method = 'GET', data = null) {
        const headers = {
            'Content-Type': 'application/json'
        };

        const config = {
            method,
            headers,
            credentials: 'same-origin'
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, config);
            const text = await response.text();
            
            try {
                const result = JSON.parse(text);
                return result;
            } catch (e) {
                if (text.includes('aes.js') || text.includes('__test=')) {
                    console.error('Anti-bot interceptó la petición');
                    return { success: false, message: 'El servidor está verificando tu conexión. Por favor recarga la página.' };
                }
                console.error('API Error Parsing JSON:', e, text);
                return { success: false, message: 'Respuesta inválida del servidor.' };
            }
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, message: 'Error de conexión con el servidor.' };
        }
    },

    get(endpoint) {
        return this.request(endpoint, 'GET');
    },

    post(endpoint, data) {
        return this.request(endpoint, 'POST', data);
    },

    put(endpoint, data) {
        return this.request(endpoint, 'PUT', data);
    },

    delete(endpoint, data) {
        return this.request(endpoint, 'DELETE', data);
    }
};
