/**
 * Nome legível do PR a partir da URL (repo + número).
 * @param {string} prUrl
 * @returns {string}
 */
export function getPrDisplayName(prUrl) {
  const m = String(prUrl ?? '').match(
    /github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/i
  );
  if (!m) {
    return 'Pull Request';
  }
  return `${m[1]} #${m[2]}`;
}

/**
 * Texto para o grupo [Portal web] SO`s — nome do PR, status e link em linhas separadas.
 * @param {string} prUrl
 * @param {'Aprovado'|'Pendente de Alteração'} statusLabel
 * @returns {string}
 */
export function buildBitrixSoMessage(prUrl, statusLabel) {
  const url = String(prUrl ?? '').trim();
  const label = String(statusLabel ?? '').trim();
  if (!url || !label) {
    return '';
  }
  const prName = getPrDisplayName(url);
  return `${label} — ${prName}\n${url}`;
}

/**
 * Chave estável para achar mensagens do mesmo PR (org/repo/pull/N).
 * @param {string} prUrl
 * @returns {string}
 */
export function getPrMatchKey(prUrl) {
  const m = String(prUrl ?? '').match(
    /github\.com\/([^/]+\/[^/]+\/pull\/\d+)/i
  );
  return m ? m[1].toLowerCase() : '';
}
