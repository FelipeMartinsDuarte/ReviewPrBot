import { LIMITS } from '../../shared/limits.js';
import { assertArray } from '../../shared/validators.js';

/**
 * @typedef {object} PipelineStep
 * @property {string} id
 * @property {string} label
 * @property {(ctx: object) => Promise<object>} run
 */

/**
 * @param {PipelineStep[]} steps
 * @param {object} initialContext
 */
export async function runPipeline(steps, initialContext) {
  assertArray(steps, 'steps');

  if (steps.length > LIMITS.MAX_PIPELINE_STEPS) {
    throw new Error(
      `Pipeline excede ${LIMITS.MAX_PIPELINE_STEPS} steps (proteção anti-loop)`
    );
  }

  const stepResults = [];
  let context = { ...initialContext };
  const seenIds = new Set();

  for (const step of steps) {
    if (!step?.id || typeof step.run !== 'function') {
      throw new Error(`Step inválido: ${step?.id ?? 'unknown'}`);
    }
    if (seenIds.has(step.id)) {
      throw new Error(`Step duplicado detectado: ${step.id} (proteção anti-loop)`);
    }
    seenIds.add(step.id);

    const result = await step.run(context);
    stepResults.push({ id: step.id, label: step.label, result });
    context = {
      ...context,
      [`${step.id}Result`]: result,
      previousSummaries:
        result.previousSummaries ?? context.previousSummaries ?? {},
    };
  }

  return { stepResults, context };
}

/** @type {PipelineStep[]} */
export const reviewSteps = [];

/**
 * @param {PipelineStep} step
 */
export function registerReviewStep(step) {
  if (!step?.id || typeof step.run !== 'function') {
    throw new Error('Step deve ter id e run');
  }
  if (reviewSteps.length >= LIMITS.MAX_PIPELINE_STEPS) {
    throw new Error(
      `Limite de ${LIMITS.MAX_PIPELINE_STEPS} steps no pipeline atingido`
    );
  }
  reviewSteps.push(step);
}
