import { isPlainObject } from '../shared/validators.js';

const CACHE_PREFIX = 'mobilinho_review:';

/**
 * @param {string} prUrl
 * @returns {string}
 */
function cacheKey(prUrl) {
  return `${CACHE_PREFIX}${prUrl}`;
}

/**
 * @param {string} prUrl
 * @returns {Promise<object|null>}
 */
export async function getCachedReview(prUrl) {
  if (typeof prUrl !== 'string' || prUrl.length === 0) {
    return null;
  }
  const key = cacheKey(prUrl);
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];
  if (!isPlainObject(entry) || !isPlainObject(entry.review)) {
    return null;
  }
  return entry.review;
}

/**
 * @param {string} prUrl
 * @param {object} review
 */
export async function saveCachedReview(prUrl, review) {
  if (typeof prUrl !== 'string' || prUrl.length === 0) {
    throw new Error('prUrl inválido para cache');
  }
  if (!isPlainObject(review)) {
    throw new Error('review inválido para cache');
  }
  const key = cacheKey(prUrl);
  await chrome.storage.local.set({
    [key]: {
      prUrl,
      review,
      savedAt: Date.now(),
    },
  });
}

/**
 * @param {string} prUrl
 */
export async function clearCachedReview(prUrl) {
  if (typeof prUrl !== 'string') {
    return;
  }
  await chrome.storage.local.remove(cacheKey(prUrl));
}
