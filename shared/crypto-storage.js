const SALT = 'mobilinho-reviewer-v1';
const ALGO = { name: 'AES-GCM', length: 256 };

/**
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey() {
  const extensionId = chrome.runtime.id;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${SALT}:${extensionId}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    ALGO,
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * @param {string} plainText
 * @returns {Promise<string>} base64 iv+ciphertext
 */
export async function encryptSecret(plainText) {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * @param {string} encryptedBase64
 * @returns {Promise<string>}
 */
export async function decryptSecret(encryptedBase64) {
  const key = await deriveKey();
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(dec);
}
