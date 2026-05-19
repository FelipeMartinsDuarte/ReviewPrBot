import { LIMITS } from '../shared/limits.js';

/** @type {{ fileName: string, text: string }|null} */
let attached = null;

/**
 * @returns {{ fileName: string, text: string }|null}
 */
export function getAttachedContext() {
  if (!attached?.text?.trim()) {
    return null;
  }
  return attached;
}

/**
 * @param {File} file
 * @returns {Promise<{ fileName: string, text: string }>}
 */
export async function loadAttachedFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido');
  }
  if (!file.name.toLowerCase().endsWith('.txt')) {
    throw new Error('Use um arquivo .txt');
  }
  if (file.size > LIMITS.MAX_ATTACH_FILE_BYTES) {
    throw new Error(
      `Arquivo grande demais (máx. ${Math.round(LIMITS.MAX_ATTACH_FILE_BYTES / 1024)}KB)`
    );
  }

  const raw = await file.text();
  const text = raw.slice(0, LIMITS.MAX_EXTERNAL_CONTEXT_CHARS).trim();
  if (text.length === 0) {
    throw new Error('Arquivo vazio');
  }

  attached = { fileName: file.name, text };
  return attached;
}

export function clearAttachedContext() {
  attached = null;
}

/**
 * @param {boolean} include
 * @returns {string}
 */
export function getAttachedContextForApi(include) {
  if (!include) {
    return '';
  }
  return attached?.text?.trim() ?? '';
}
