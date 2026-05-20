import { FINDING_STATUS } from './constants.js';
import { LIMITS } from './limits.js';

/**
 * Monta contexto da revisão FelipeDosReview para a etapa de score.
 * Inclui achados recusados, aceitos e pendentes.
 * @param {object|null} review
 * @returns {object|null}
 */
export function buildReviewContextForScore(review) {
  if (!review || typeof review !== 'object') {
    return null;
  }

  const findings = Array.isArray(review.findings) ? review.findings : [];
  const groups = {
    rejected: [],
    accepted: [],
    pending: [],
  };

  for (const f of findings) {
    const status = f.status ?? FINDING_STATUS.PENDING;
    const compact = compactFinding(f);
    if (status === FINDING_STATUS.REJECTED) {
      groups.rejected.push(compact);
    } else if (status === FINDING_STATUS.ACCEPTED) {
      groups.accepted.push(compact);
    } else {
      groups.pending.push(compact);
    }
  }

  return {
    stepsSummary: review.stepsSummary ?? {},
    counts: {
      rejected: groups.rejected.length,
      accepted: groups.accepted.length,
      pending: groups.pending.length,
      total: findings.length,
    },
    rejectedFindings: groups.rejected,
    acceptedFindings: groups.accepted,
    pendingFindings: groups.pending,
  };
}

/**
 * @param {object} f
 */
function compactFinding(f) {
  return {
    id: String(f.id ?? ''),
    file: String(f.file ?? ''),
    line: f.line ?? null,
    category: String(f.category ?? 'NORMAL'),
    title: truncate(String(f.title ?? ''), 300),
    analysis: truncate(String(f.analysis ?? ''), LIMITS.MAX_SCORE_FINDING_TEXT_CHARS),
    githubComment: truncate(String(f.githubComment ?? ''), LIMITS.MAX_SCORE_FINDING_TEXT_CHARS),
    status: f.status ?? FINDING_STATUS.PENDING,
  };
}

/**
 * @param {string} s
 * @param {number} max
 */
function truncate(s, max) {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
}

/**
 * @param {object|null} ctx
 * @returns {string}
 */
export function stringifyReviewContextForScore(ctx) {
  if (!ctx) {
    return '';
  }
  const raw = JSON.stringify(ctx);
  if (raw.length <= LIMITS.MAX_SCORE_REVIEW_CONTEXT_CHARS) {
    return raw;
  }
  return raw.slice(0, LIMITS.MAX_SCORE_REVIEW_CONTEXT_CHARS);
}
