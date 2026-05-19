import { chatJsonCompletion } from '../../openai.service.js';
import { buildStepFocus, GITHUB_COMMENT_INSTRUCTIONS } from '../../prompts.js';
import { buildStepUserPayload } from '../../payload-guard.service.js';
import { LIMITS } from '../../../shared/limits.js';

/**
 * @param {string} stepId
 * @param {string} label
 * @param {object} ctx
 */
export async function runFocusedStep(stepId, label, ctx) {
  const credentials = ctx._credentials;
  if (!credentials?.apiKey || !credentials?.model) {
    throw new Error('Credenciais ausentes no pipeline');
  }

  if (typeof ctx.trackCall === 'function') {
    ctx.trackCall();
  }

  const safe = ctx.safe;
  if (!safe) {
    throw new Error('Payload seguro ausente no contexto');
  }

  const focus = buildStepFocus(stepId);
  const systemPrompt = `${ctx.systemPromptBase}

## Etapa atual: ${label}
${focus}

Retorne JSON: { "summary": "string", "findings": [] }
Máximo ${LIMITS.MAX_FINDINGS_PER_STEP} findings nesta etapa.
Cada finding: id, file, line, side ("RIGHT"|"LEFT"), category, title, analysis, githubComment.

${GITHUB_COMMENT_INSTRUCTIONS}`;

  const userContent = buildStepUserPayload(safe, ctx.previousSummaries ?? {});

  return chatJsonCompletion({
    apiKey: credentials.apiKey,
    model: credentials.model,
    systemPrompt,
    userContent,
    maxOutputTokens: LIMITS.MAX_OUTPUT_TOKENS_STEP,
  });
}

/**
 * @param {string} stepId
 * @param {string} label
 */
export function createStep(stepId, label) {
  return {
    id: stepId,
    label,
    async run(ctx) {
      const result = await runFocusedStep(stepId, label, ctx);
      const summaries = { ...(ctx.previousSummaries ?? {}) };
      summaries[stepId] =
        typeof result.summary === 'string' ? result.summary : '';
      return {
        ...result,
        previousSummaries: summaries,
      };
    },
  };
}
