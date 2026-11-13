// Web Push (RFC 8291 + VAPID RFC 8292) en JavaScript puro para Google Apps Script.
// Se empaqueta con esbuild en backend/WebPush.gs:  npm run build:push
import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { gcm } from '@noble/ciphers/aes.js';

const te = new TextEncoder();
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const b64u = (bytes) => Utilities.base64EncodeWebSafe(toSigned(bytes)).replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(Utilities.base64DecodeWebSafe(String(s).replace(/=+$/, '') + '==='.slice((String(s).length + 3) % 4)), (b) => b & 255);
const toSigned = (u8) => Array.from(u8, (b) => (b > 127 ? b - 256 : b));

/** Par de llaves VAPID nuevo: { publicKey, privateKey } en base64url */
export function generateKeys() {
  const sk = p256.utils.randomSecretKey();
  return { publicKey: b64u(p256.getPublicKey(sk, false)), privateKey: b64u(sk) };
}

/** Cifra el contenido para un navegador (aes128gcm, RFC 8188/8291) */
export function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const asPrivate = p256.utils.randomSecretKey(), asPublic = p256.getPublicKey(asPrivate, false);
  const shared = p256.getSharedSecret(asPrivate, uaPublic, true).slice(1); // coordenada x
  const ikm = hkdf(sha256, shared, auth, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = p256.utils.randomSecretKey().slice(0, 16);
  const cek = hkdf(sha256, ikm, salt, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sha256, ikm, salt, te.encode('Content-Encoding: nonce\0'), 12);
  const ct = gcm(cek, nonce).encrypt(concat(te.encode(payload), new Uint8Array([2])));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([65]), asPublic, ct);
}

/** Token VAPID (JWT ES256) para el servicio de push del navegador */
export function vapidHeader(endpoint, keys, subject) {
  const aud = endpoint.match(/^https?:\/\/[^/]+/)[0];
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = p256.sign(te.encode(`${head}.${body}`), unb64u(keys.privateKey), { prehash: true });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** Envía a varias suscripciones. Devuelve { enviados, expirados:[endpoint], errores:[...] } */
export function send(subs, payload, keys, subject) {
  const reqs = subs.map((s) => ({
    url: s.endpoint,
    method: 'post',
    contentType: 'application/octet-stream',
    payload: Utilities.newBlob(toSigned(encrypt(s, payload))),
    headers: { Authorization: vapidHeader(s.endpoint, keys, subject), 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'high' },
    muteHttpExceptions: true,
  }));
  const out = { enviados: 0, expirados: [], errores: [] };
  UrlFetchApp.fetchAll(reqs).forEach((r, i) => {
    const code = r.getResponseCode();
    if (code >= 200 && code < 300) out.enviados++;
    else if (code === 404 || code === 410) out.expirados.push(subs[i].endpoint);
    else out.errores.push(`${code} ${r.getContentText().slice(0, 120)}`);
  });
  return out;
}
