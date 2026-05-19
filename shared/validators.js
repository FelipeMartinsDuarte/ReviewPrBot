/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {string}
 */
export function assertNonEmptyString(value, name) {
  if (!isNonEmptyString(value)) {
    throw new Error(`${name} deve ser uma string não vazia`);
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function assertPositiveInteger(value, name) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error(`${name} deve ser um inteiro positivo`);
  }
  return num;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} arr
 * @param {string} name
 * @returns {unknown[]}
 */
export function assertArray(arr, name) {
  if (!Array.isArray(arr)) {
    throw new Error(`${name} deve ser um array`);
  }
  return arr;
}

/**
 * @param {unknown} url
 * @param {RegExp} pattern
 * @returns {boolean}
 */
export function isUrlMatching(url, pattern) {
  return isNonEmptyString(url) && pattern.test(url);
}
