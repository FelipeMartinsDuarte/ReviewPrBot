/**
 * Remove dados sensíveis de mensagens de erro / log.
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeErrorMessage(input) {
  const text = String(input ?? 'Erro desconhecido');
  return text
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, 'sk-[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/"api[_-]?key"\s*:\s*"[^"]+"/gi, '"api_key":"[REDACTED]"')
    .slice(0, 400);
}

/**
 * Garante que objeto não contenha credenciais antes de log/serialização.
 * @param {object} obj
 */
export function stripCredentials(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  const clone = { ...obj };
  delete clone.apiKey;
  delete clone.credentials;
  return clone;
}
