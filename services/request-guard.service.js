import { LIMITS } from '../shared/limits.js';

/** @type {Map<string, boolean>} */
const inFlight = new Map();

/** @type {Map<string, number>} */
const lastCompletedAt = new Map();

/** @type {number[]} */
const callTimestamps = [];

/**
 * @typedef {'review'|'score'} OperationType
 */

/**
 * Bloqueia operação concorrente e aplica cooldown.
 * @param {OperationType} operation
 * @returns {() => void} release — deve ser chamado em finally
 */
export function acquireOperation(operation) {
  if (inFlight.get(operation)) {
    throw new Error(
      'Já existe uma operação em andamento. Aguarde a conclusão antes de tentar novamente.'
    );
  }

  const cooldown =
    operation === 'review'
      ? LIMITS.COOLDOWN_REVIEW_MS
      : LIMITS.COOLDOWN_SCORE_MS;
  const last = lastCompletedAt.get(operation) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldown) {
    const waitSec = Math.ceil((cooldown - elapsed) / 1000);
    throw new Error(
      `Aguarde ${waitSec}s antes de executar "${operation}" novamente (proteção de tokens).`
    );
  }

  pruneOldCalls();
  if (callTimestamps.length >= LIMITS.MAX_OPENAI_CALLS_PER_MINUTE) {
    throw new Error(
      'Limite de chamadas por minuto atingido. Aguarde ~60s (proteção de tokens).'
    );
  }

  inFlight.set(operation, true);

  return () => {
    inFlight.delete(operation);
    lastCompletedAt.set(operation, Date.now());
  };
}

/**
 * Registra uma chamada OpenAI concluída (rate limit global).
 */
export function recordOpenAiCall() {
  pruneOldCalls();
  callTimestamps.push(Date.now());
}

/**
 * @param {number} current
 * @param {number} max
 * @param {string} label
 */
export function assertCallBudget(current, max, label) {
  if (current >= max) {
    throw new Error(
      `Orçamento de chamadas OpenAI esgotado (${max}) em ${label}. Operação interrompida.`
    );
  }
}

function pruneOldCalls() {
  const cutoff = Date.now() - 60_000;
  while (callTimestamps.length > 0 && callTimestamps[0] < cutoff) {
    callTimestamps.shift();
  }
}
