import { STORAGE_KEYS } from '../shared/constants.js';
import { encryptSecret, decryptSecret } from '../shared/crypto-storage.js';
import { assertAllowedModel, isAllowedModel } from '../shared/model-options.js';
import { assertNonEmptyString, isNonEmptyString } from '../shared/validators.js';

/**
 * @typedef {{ hasApiKey: boolean, model: string }} ConfigStatus
 */

/**
 * @returns {Promise<ConfigStatus>}
 */
export async function getConfigStatus() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
  ]);
  const rawModel = stored[STORAGE_KEYS.MODEL];
  const model =
    typeof rawModel === 'string' && isAllowedModel(rawModel)
      ? rawModel
      : '';
  return {
    hasApiKey: isNonEmptyString(stored[STORAGE_KEYS.API_KEY]),
    model,
  };
}

/**
 * @returns {Promise<{ apiKey: string, model: string }>}
 */
export async function getCredentials() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.MODEL,
  ]);
  const encrypted = stored[STORAGE_KEYS.API_KEY];
  const model = stored[STORAGE_KEYS.MODEL];

  if (typeof encrypted !== 'string' || encrypted.length === 0) {
    throw new Error('Chave API não configurada');
  }
  if (typeof model !== 'string' || !isAllowedModel(model)) {
    throw new Error('Modelo OpenAI não configurado ou inválido');
  }

  const apiKey = await decryptSecret(encrypted);
  return {
    apiKey: assertNonEmptyString(apiKey, 'apiKey'),
    model: assertAllowedModel(model),
  };
}

/**
 * @param {{ apiKey: string, model: string }} config
 * @returns {Promise<void>}
 */
export async function saveCredentials(config) {
  const apiKey = assertNonEmptyString(config.apiKey, 'apiKey');
  const model = assertAllowedModel(config.model);
  const encrypted = await encryptSecret(apiKey);
  await chrome.storage.local.set({
    [STORAGE_KEYS.API_KEY]: encrypted,
    [STORAGE_KEYS.MODEL]: model,
  });
}
