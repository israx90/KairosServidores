var SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
var INV_SBOX = [];
for (var i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
var RCON = [1,2,4,8,16,32,64,128,27,54];
function mul(a, b) {
    var p = 0;
    for (var i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        var hi = a & 0x80;
        a = (a << 1) & 0xff;
        if (hi) a ^= 0x1b;
        b >>= 1;
    }
    return p;
}
function keyExpansion(key) {
    var w = new Array(176);
    for (var i = 0; i < 16; i++) w[i] = key[i];
    for (var i = 16; i < 176; i += 4) {
        var t0 = w[i-4], t1 = w[i-3], t2 = w[i-2], t3 = w[i-1];
        if (i % 16 === 0) {
            var tmp = t0;
            t0 = SBOX[t1] ^ RCON[(i / 16) - 1];
            t1 = SBOX[t2];
            t2 = SBOX[t3];
            t3 = SBOX[tmp];
        }
        w[i]   = w[i-16] ^ t0;
        w[i+1] = w[i-15] ^ t1;
        w[i+2] = w[i-14] ^ t2;
        w[i+3] = w[i-13] ^ t3;
    }
    return w;
}
function aesDecryptBlock(cipherBlock, expandedKey) {
    var s = cipherBlock.slice();
    for (var i = 0; i < 16; i++) s[i] ^= expandedKey[160 + i];
    for (var r = 9; r >= 1; r--) {
        var t;
        t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
        t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
        t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
        for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
        for (var i = 0; i < 16; i++) s[i] ^= expandedKey[r * 16 + i];
        for (var c = 0; c < 16; c += 4) {
            var a0 = s[c], a1 = s[c+1], a2 = s[c+2], a3 = s[c+3];
            s[c]   = mul(14, a0) ^ mul(11, a1) ^ mul(13, a2) ^ mul(9, a3);
            s[c+1] = mul(9, a0)  ^ mul(14, a1) ^ mul(11, a2) ^ mul(13, a3);
            s[c+2] = mul(13, a0) ^ mul(9, a1)  ^ mul(14, a2) ^ mul(11, a3);
            s[c+3] = mul(11, a0) ^ mul(13, a1) ^ mul(9, a2)  ^ mul(14, a3);
        }
    }
    var t;
    t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
    t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
    t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
    for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    for (var i = 0; i < 16; i++) s[i] ^= expandedKey[i];
    return s;
}
function aesCbcDecrypt(ciphertext, key, iv) {
    var expandedKey = keyExpansion(key);
    var decrypted = aesDecryptBlock(ciphertext, expandedKey);
    for (var i = 0; i < 16; i++) decrypted[i] ^= iv[i];
    return decrypted;
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
var a=toNumbers('f655ba9d09a112d4968c63579db590b4'),b=toNumbers('98344c2eee86c3994890592585b49f80'),c=toNumbers('3124805f89b6807f09efc7bd6f0884d4');
console.log(toHex(aesCbcDecrypt(c, a, b)));