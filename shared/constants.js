/** @readonly */
export const EXTENSION_NAME = 'MobilinhoReviewer';

/** @readonly */
export const STORAGE_KEYS = Object.freeze({
  API_KEY: 'mobilinho_api_key_enc',
  MODEL: 'mobilinho_model',
});

/** @readonly */
export const FINDING_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

/** @readonly */
export const FINDING_CATEGORIES = Object.freeze([
  'CRITICO',
  'URGENTE',
  'NORMAL',
  'MELHORIA',
  'BUG',
]);

/** @readonly */
export const MESSAGE_TYPES = Object.freeze({
  GET_PAGE_STATE: 'GET_PAGE_STATE',
  GET_CONFIG: 'GET_CONFIG',
  SAVE_CONFIG: 'SAVE_CONFIG',
  SCRAPE_PR: 'SCRAPE_PR',
  RUN_REVIEW: 'RUN_REVIEW',
  RUN_SCORE: 'RUN_SCORE',
  OPEN_MODAL: 'OPEN_MODAL',
  APPLY_FINDING: 'APPLY_FINDING',
  REFRESH_AND_RESCRAPE: 'REFRESH_AND_RESCRAPE',
  GET_REVIEW_CACHE: 'GET_REVIEW_CACHE',
  SAVE_REVIEW_CACHE: 'SAVE_REVIEW_CACHE',
});

/** @readonly */
export const DEFAULT_MODEL = 'gpt-4o';

export { isPrChangesPage, getCanonicalPrUrl } from './pr-url.js';
