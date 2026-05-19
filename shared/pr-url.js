/**
 * Página de diff do PR: URL contém /changes (com ou sem #diff-… no final).
 * @param {string} [url]
 * @returns {boolean}
 */
export function isPrChangesPage(url) {
  const value =
    typeof url === 'string' && url.length > 0
      ? url
      : typeof window !== 'undefined'
        ? window.location.href
        : '';
  return value.includes('/changes');
}

/**
 * URL base do PR para cache (sem hash nem query).
 * @param {string} [url]
 * @returns {string}
 */
export function getCanonicalPrUrl(url) {
  const value =
    typeof url === 'string' && url.length > 0
      ? url
      : typeof window !== 'undefined'
        ? window.location.href
        : '';
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return value.split('#')[0].split('?')[0];
  }
}
