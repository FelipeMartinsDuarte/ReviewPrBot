import { registerReviewStep } from '../pipeline.runner.js';
import { treeSitStep } from './tree-sit.step.js';
import { validationsStep } from './validations.step.js';
import { compilationStep } from './compilation.step.js';
import { functionalStep } from './functional.step.js';

registerReviewStep(treeSitStep);
registerReviewStep(validationsStep);
registerReviewStep(compilationStep);
registerReviewStep(functionalStep);

export { reviewSteps } from '../pipeline.runner.js';
