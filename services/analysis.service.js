import { chatJsonCompletion } from './openai.service.js';
import { buildReviewSystemPrompt, buildScoreSystemPrompt } from './prompts.js';
import { getCredentials } from './storage.service.js';
import { runPipeline } from './pipeline/pipeline.runner.js';
import './pipeline/steps/index.js';
import { reviewSteps } from './pipeline/steps/index.js';
import {
  preparePrPayload,
  buildMergeUserPayload,
} from './payload-guard.service.js';
import {
  acquireOperation,
  assertCallBudget,
} from './request-guard.service.js';
import { LIMITS } from '../shared/limits.js';
import { assertArray, isPlainObject } from '../shared/validators.js';
import { FINDING_CATEGORIES, FINDING_STATUS } from '../shared/constants.js';

/**
 * @param {object} prData
 * @param {string} [userNotes]
 */
export async function runFullReview(prData, userNotes = '', externalContext = '') {
  const release = acquireOperation('review');
  let callCount = 0;

  try {
    const credentials = await getCredentials();
    const safe = preparePrPayload(prData, userNotes, externalContext);

    const ctx = {
      safe,
      prUrl: safe.prUrl,
      userNotes: safe.userNotes,
      systemPromptBase: buildReviewSystemPrompt({
        prUrl: safe.prUrl,
        files: safe.compactFiles,
        existingComments: safe.existingComments,
        userNotes: safe.userNotes,
        externalContext: safe.externalContext,
      }),
      previousSummaries: {},
      /** @type {{ apiKey: string, model: string }} */
      _credentials: credentials,
      trackCall: () => {
        assertCallBudget(
          callCount,
          LIMITS.MAX_OPENAI_CALLS_PER_REVIEW,
          'review'
        );
        callCount += 1;
      },
    };

    const { stepResults } = await runPipeline(reviewSteps, ctx);

    ctx.trackCall();
    const mergeContent = buildMergeUserPayload(safe, stepResults);

    const final = await chatJsonCompletion({
      apiKey: credentials.apiKey,
      model: credentials.model,
      systemPrompt: `${ctx.systemPromptBase}

Consolide os resultados das etapas abaixo em um único JSON final (stepsSummary + findings).
Elimine duplicatas. Máximo ${LIMITS.MAX_FINDINGS} achados.
Reescreva cada githubComment seguindo o estilo humano/técnico definido no prompt (texto arejado, \\n\\n entre blocos).`,
      userContent: mergeContent,
      maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS_REVIEW,
    });

    return normalizeReviewResult(final, stepResults);
  } finally {
    release();
  }
}

/**
 * @param {object} prData
 * @param {string} [userNotes]
 */
export async function runScore(prData, userNotes = '', externalContext = '') {
  const release = acquireOperation('score');

  try {
    const credentials = await getCredentials();
    const safe = preparePrPayload(prData, userNotes, externalContext);

    assertCallBudget(0, LIMITS.MAX_OPENAI_CALLS_PER_SCORE, 'score');

    return chatJsonCompletion({
      apiKey: credentials.apiKey,
      model: credentials.model,
      systemPrompt: buildScoreSystemPrompt({
        prUrl: safe.prUrl,
        files: safe.compactFiles,
        existingComments: safe.existingComments,
        userNotes: safe.userNotes,
        externalContext: safe.externalContext,
      }),
      userContent: JSON.stringify({
        files: safe.compactFiles,
        existingComments: safe.existingComments,
        stats: safe.stats,
        userNotes: safe.userNotes || undefined,
        externalContextFromOtherReview: safe.externalContext || undefined,
      }),
      maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS_SCORE,
    });
  } finally {
    release();
  }
}

/**
 * @param {object} raw
 * @param {object[]} stepResults
 */
function normalizeReviewResult(raw, stepResults) {
  if (!isPlainObject(raw)) {
    throw new Error('Resultado de review inválido');
  }

  const findings = Array.isArray(raw.findings) ? raw.findings : [];
  const normalized = findings
    .filter((f) => isPlainObject(f))
    .map((f, i) => ({
      id: typeof f.id === 'string' ? f.id : `finding-${i}`,
      file: typeof f.file === 'string' ? f.file : '',
      line: Number(f.line) || 0,
      side: f.side === 'LEFT' ? 'LEFT' : 'RIGHT',
      category: normalizeCategory(f.category),
      title: typeof f.title === 'string' ? f.title : 'Achado',
      analysis: typeof f.analysis === 'string' ? f.analysis : '',
      githubComment: normalizeGithubComment(f.githubComment),
      status: FINDING_STATUS.PENDING,
    }))
    .filter((f) => f.file && f.line > 0)
    .slice(0, LIMITS.MAX_FINDINGS);

  return {
    stepsSummary: isPlainObject(raw.stepsSummary)
      ? raw.stepsSummary
      : buildStepsSummary(stepResults),
    findings: normalized,
    stepResults: stepResults.map((s) => ({
      id: s.id,
      label: s.label,
      summary: s.result?.summary ?? '',
    })),
  };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeGithubComment(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {unknown} cat
 */
function normalizeCategory(cat) {
  const upper = String(cat ?? 'NORMAL').toUpperCase();
  return FINDING_CATEGORIES.includes(upper) ? upper : 'NORMAL';
}

/**
 * @param {object[]} stepResults
 */
function buildStepsSummary(stepResults) {
  const map = {
    treeSit: '',
    validations: '',
    compilation: '',
    functional: '',
  };
  const keyMap = {
    'tree-sit': 'treeSit',
    validations: 'validations',
    compilation: 'compilation',
    functional: 'functional',
  };
  for (const s of stepResults) {
    const key = keyMap[s.id];
    if (key) {
      map[key] = s.result?.summary ?? '';
    }
  }
  return map;
}
