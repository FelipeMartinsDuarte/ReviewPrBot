import {
  GITHUB_SELECTORS,
  GITHUB_REVIEW_EVENT,
} from '../shared/github-selectors.js';
import { LIMITS } from '../shared/limits.js';
import { buildPrReviewSummaryText } from './pr-review-summary.js';

/**
 * @typedef {'approve'|'request_changes'} PrReviewDecision
 */

/**
 * Abre "Finish your review", seleciona approve/request changes e preenche o comentário.
 * Não clica em Submit review — o revisor confirma no GitHub.
 *
 * @param {PrReviewDecision} decision
 * @param {object|null} review
 * @param {object|null} score
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function preparePrReviewDraft(decision, review, score) {
  const summary = buildPrReviewSummaryText(review, score, decision);
  if (!summary.trim()) {
    return {
      success: false,
      message: 'Nada para resumir. Rode Revisar PR ou Medir Score antes.',
    };
  }

  const opened = await openReviewDialog();
  if (!opened) {
    return {
      success: false,
      message:
        'Não encontrei o botão "Submit review" na página. Confirme que está em /changes e que você pode revisar este PR.',
    };
  }

  const radioValue =
    decision === 'approve'
      ? GITHUB_REVIEW_EVENT.APPROVE
      : GITHUB_REVIEW_EVENT.REQUEST_CHANGES;

  const radio = await waitForReviewRadio(radioValue);
  if (!radio) {
    return {
      success: false,
      message: `Opção "${decision === 'approve' ? 'Approve' : 'Request changes'}" não encontrada no diálogo.`,
    };
  }

  if (radio.disabled) {
    return {
      success: false,
      message:
        'Esta opção está desabilitada (ex.: autor do PR não pode aprovar o próprio PR). Use outra conta de revisor.',
    };
  }

  selectReviewRadio(radio);

  const textarea = await waitForReviewCommentTextarea();
  if (!textarea) {
    return {
      success: false,
      message: 'Campo "Leave a comment" do review não encontrado.',
    };
  }

  const capped = summary.slice(0, LIMITS.MAX_PR_REVIEW_SUMMARY_CHARS);
  setTextareaValue(textarea, capped);
  textarea.focus();

  const label =
    decision === 'approve' ? 'Approve' : 'Request changes';
  return {
    success: true,
    message: `${label} selecionado no GitHub.`,
  };
}

/**
 * @returns {Promise<boolean>}
 */
async function openReviewDialog() {
  if (isReviewDialogOpen()) {
    return true;
  }

  const btn = findReviewMenuButton();
  if (!btn) {
    return false;
  }

  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(300);
  btn.click();

  for (let i = 0; i < LIMITS.MAX_REVIEW_DIALOG_WAIT_ITERATIONS; i++) {
    if (isReviewDialogOpen()) {
      return true;
    }
    await delay(LIMITS.REVIEW_DIALOG_WAIT_MS);
  }
  return isReviewDialogOpen();
}

function isReviewDialogOpen() {
  const title = document.querySelector(GITHUB_SELECTORS.reviewDialogTitle);
  if (title?.textContent?.includes('Finish your review')) {
    return true;
  }
  return Boolean(
    document.querySelector(GITHUB_SELECTORS.reviewDialogBody)
  );
}

/**
 * @returns {HTMLButtonElement|null}
 */
function findReviewMenuButton() {
  const candidates = document.querySelectorAll(
    GITHUB_SELECTORS.reviewMenuButton
  );
  for (const el of candidates) {
    if (!(el instanceof HTMLButtonElement) || el.disabled) {
      continue;
    }
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (/submit\s*review/i.test(text) || /review/i.test(text)) {
      return el;
    }
  }
  return candidates[0] instanceof HTMLButtonElement
    ? candidates[0]
    : null;
}

/**
 * @param {string} value
 * @returns {Promise<HTMLInputElement|null>}
 */
async function waitForReviewRadio(value) {
  const selector = GITHUB_SELECTORS.reviewEventRadio(value);
  for (let i = 0; i < LIMITS.MAX_REVIEW_DIALOG_WAIT_ITERATIONS; i++) {
    const radio = document.querySelector(selector);
    if (radio instanceof HTMLInputElement) {
      return radio;
    }
    await delay(LIMITS.REVIEW_DIALOG_WAIT_MS);
  }
  return null;
}

/**
 * @param {HTMLInputElement} radio
 */
function selectReviewRadio(radio) {
  const label = document.querySelector(`label[for="${radio.id}"]`);
  if (label instanceof HTMLLabelElement) {
    label.click();
  } else {
    radio.click();
  }
  radio.checked = true;
  radio.dispatchEvent(new Event('input', { bubbles: true }));
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @returns {Promise<HTMLTextAreaElement|null>}
 */
async function waitForReviewCommentTextarea() {
  for (let i = 0; i < LIMITS.MAX_REVIEW_DIALOG_WAIT_ITERATIONS; i++) {
    const scoped = document.querySelector(
      GITHUB_SELECTORS.reviewCommentTextarea
    );
    if (scoped instanceof HTMLTextAreaElement) {
      return scoped;
    }
    const fallback = document.querySelector(
      GITHUB_SELECTORS.reviewCommentTextareaFallback
    );
    if (fallback instanceof HTMLTextAreaElement) {
      return fallback;
    }
    await delay(LIMITS.REVIEW_DIALOG_WAIT_MS);
  }
  return null;
}

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {string} value
 */
function setTextareaValue(textarea, value) {
  textarea.focus();
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
