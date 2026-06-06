/**
 * InfinityFree Anti-Bot Bypass for fetch() requests (v4 - using official aes.js)
 */
(function() {
    var originalFetch = window.fetch;
    var isLoadingAes = false;
    var aesPromise = null;

    function loadSlowAES() {
        if (window.slowAES) return Promise.resolve(window.slowAES);
        if (aesPromise) return aesPromise;

        aesPromise = new Promise(function(resolve, reject) {
            // Load aes.js from the server (it bypasses the anti-bot)
            var script = document.createElement('script');
            script.src = '/aes.js';
            script.onload = function() {
                resolve(window.slowAES);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        return aesPromise;
    }

    function toNumbers(hexStr) {
        var arr = [];
        hexStr.replace(/(..)/g, function(m) { arr.push(parseInt(m, 16)); });
        return arr;
    }

    function toHex(arr) {
        var hex = '';
        for (var i = 0; i < arr.length; i++) {
            hex += (arr[i] < 16 ? '0' : '') + arr[i].toString(16);
        }
        return hex.toLowerCase();
    }

    function isAntiBotHtml(text) {
        return text && text.indexOf('slowAES.decrypt') !== -1 && text.indexOf('__test=') !== -1;
    }

    async function solveAndSetCookie(html) {
        try {
            var matches = html.match(/toNumbers\("([0-9a-f]{32})"\)/g);
            if (!matches || matches.length < 3) return false;

            var hexVals = [];
            for (var i = 0; i < matches.length; i++) {
                var m = matches[i].match(/toNumbers\("([0-9a-f]{32})"\)/);
                if (m) hexVals.push(m[1]);
            }
            if (hexVals.length < 3) return false;

            var a = toNumbers(hexVals[0]);
            var b = toNumbers(hexVals[1]);
            var c = toNumbers(hexVals[2]);

            // Ensure slowAES is loaded
            await loadSlowAES();

            if (!window.slowAES) {
                console.error('[fetch-fix] slowAES not found');
                return false;
            }

            // Use the exact same decrypt call as the server HTML:
            // slowAES.decrypt(c, 2, a, b)
            var plain = window.slowAES.decrypt(c, 2, a, b);
            var cookie = toHex(plain);

            document.cookie = '__test=' + cookie + '; max-age=21600; path=/';
            console.log('[fetch-fix] Cookie set successfully using slowAES: __test=' + cookie);

            // Mandatory validation redirect
            var redirectMatch = html.match(/location\.href="([^"]+)"/);
            if (redirectMatch && redirectMatch[1]) {
                var redirectUrl = redirectMatch[1];
                console.log('[fetch-fix] Validating cookie with server via GET:', redirectUrl);
                // Must do a GET to the validation URL so the server registers the session
                await originalFetch(redirectUrl, { method: 'GET', credentials: 'same-origin' });
            }

            return true;
        } catch (e) {
            console.error('[fetch-fix] solveAndSetCookie error:', e);
            return false;
        }
    }

    window.fetch = async function(url, options) {
        // Ensure options exists and credentials is set if missing
        options = options || {};
        if (!options.credentials) {
            options.credentials = 'same-origin';
        }

        try {
            const response = await originalFetch(url, options);
            const clone = response.clone();
            const text = await clone.text();

            if (isAntiBotHtml(text)) {
                console.log('[fetch-fix] Anti-bot detected for:', url);
                const solved = await solveAndSetCookie(text);
                if (solved) {
                    console.log('[fetch-fix] Retrying request after solving anti-bot...');
                    const retryResp = await originalFetch(url, options);
                    const retryClone = retryResp.clone();
                    const retryText = await retryClone.text();
                    
                    if (isAntiBotHtml(retryText)) {
                        console.error('[fetch-fix] Anti-bot still detected after retry!');
                        // Solve once more just in case
                        await solveAndSetCookie(retryText);
                        return originalFetch(url, options);
                    }
                    return retryResp;
                }
            }
            return response;
        } catch (error) {
            console.error('[fetch-fix] Fetch Error:', error);
            throw error;
        }
    };

    console.log('[fetch-fix] v5 loaded - Mandatory validation redirect added.');
})();
