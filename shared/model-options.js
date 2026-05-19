import { DEFAULT_MODEL } from './constants.js';

/**
 * Modelos permitidos (sem texto livre — evita typo e chamadas inválidas).
 * @readonly
 */
export const OPENAI_MODELS = Object.freeze([
  {
    id: 'gpt-4o',
    label: 'GPT-4o — recomendado para diff e code review',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini — rápido e econômico',
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1 — alta qualidade',
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini — equilíbrio custo/qualidade',
  },
  {
    id: 'o4-mini',
    label: 'o4-mini — raciocínio (OpenAI)',
  },
  {
    id: 'o3-mini',
    label: 'o3-mini — raciocínio leve',
  },
]);

/** @type {ReadonlySet<string>} */
const ALLOWED_IDS = new Set(OPENAI_MODELS.map((m) => m.id));

/**
 * @param {unknown} modelId
 * @returns {boolean}
 */
export function isAllowedModel(modelId) {
  return typeof modelId === 'string' && ALLOWED_IDS.has(modelId);
}

/**
 * @param {unknown} modelId
 * @returns {string}
 */
export function assertAllowedModel(modelId) {
  const id = typeof modelId === 'string' ? modelId.trim() : '';
  if (!ALLOWED_IDS.has(id)) {
    throw new Error('Selecione um modelo válido da lista');
  }
  return id;
}

/**
 * @param {unknown} modelId
 * @returns {string}
 */
export function normalizeStoredModel(modelId) {
  return isAllowedModel(modelId) ? modelId : DEFAULT_MODEL;
}

/**
 * @param {string} selectId
 * @param {string} [selectedId]
 * @param {string} [className]
 */
export function buildModelSelectHtml(
  selectId,
  selectedId = DEFAULT_MODEL,
  className = ''
) {
  const selected = normalizeStoredModel(selectedId);
  const options = OPENAI_MODELS.map((m) => {
    const sel = m.id === selected ? ' selected' : '';
    return `<option value="${escapeAttr(m.id)}"${sel}>${escapeHtml(m.label)}</option>`;
  }).join('');

  const cls = className ? ` class="${escapeAttr(className)}"` : '';
  return `<select id="${escapeAttr(selectId)}"${cls}>${options}</select>`;
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
