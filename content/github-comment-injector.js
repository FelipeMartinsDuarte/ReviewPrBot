import { GITHUB_SELECTORS } from '../shared/github-selectors.js';
import { LIMITS } from '../shared/limits.js';
import { findLineElement } from './github-scraper.js';
import {
  findThreadForLine,
  lineHasCommentThread,
  findNextLineWithoutThread,
  injectReplyDraft,
} from './github-comment-thread.js';
import { assertNonEmptyString, assertPositiveInteger } from '../shared/validators.js';

/**
 * Preenche comentário ou resposta na thread — NÃO clica em Comment/Submit.
 * Prioridade: reply na thread existente → novo comentário na linha → linha abaixo.
 *
 * @param {{ file: string, line: number, text: string }} params
 * @returns {Promise<{ success: boolean, message: string, mode?: string }>}
 */
export async function injectCommentDraft(params) {
  const file = assertNonEmptyString(params.file, 'file');
  const line = assertPositiveInteger(params.line, 'line');
  const text = assertNonEmptyString(params.text, 'text');

  if (lineHasCommentThread(file, line)) {
    const thread = findThreadForLine(file, line);
    if (thread) {
      const reply = await injectReplyDraft(thread, text);
      if (reply.success) {
        return {
          success: true,
          mode: 'reply',
          message: `Resposta preenchida na thread da linha ${line} (não enviada)`,
        };
      }
    }
  }

  const newCommentResult = await injectNewLineComment(file, line, text);
  if (newCommentResult.success) {
    return newCommentResult;
  }

  if (lineHasCommentThread(file, line)) {
    const fallbackLine = findNextLineWithoutThread(file, line);
    if (fallbackLine !== null) {
      const fallback = await injectNewLineComment(file, fallbackLine, text);
      if (fallback.success) {
        return {
          ...fallback,
          mode: 'new-below',
          message: `Linha ${line} já tem comentário — rascunho na linha ${fallbackLine} abaixo (não enviado)`,
        };
      }
    }
    return {
      success: false,
      message: `Linha ${line} já tem comentário. Não foi possível responder na thread nem usar linha abaixo.`,
    };
  }

  return newCommentResult;
}

/**
 * @param {string} file
 * @param {number} line
 * @param {string} text
 */
async function injectNewLineComment(file, line, text) {
  const lineCell = findLineElement(file, line);
  if (!lineCell) {
    return {
      success: false,
      message: `Linha ${line} não encontrada em ${file}`,
    };
  }

  if (lineHasCommentThread(file, line)) {
    return {
      success: false,
      message: `Linha ${line} já possui thread de comentário`,
    };
  }

  lineCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(400);

  await openNewCommentEditor(lineCell);

  const textarea = await waitForNewCommentTextarea(lineCell);
  if (!textarea) {
    return {
      success: false,
      message: `Editor de comentário não abriu na linha ${line}`,
    };
  }

  setTextareaValue(textarea, text);
  textarea.focus();

  return {
    success: true,
    mode: 'new',
    message: `Comentário preenchido na linha ${line} (não enviado)`,
  };
}

/**
 * @param {Element} lineCell
 */
async function openNewCommentEditor(lineCell) {
  const row = lineCell.closest('tr.diff-line-row');
  const lineNumCell =
    row?.querySelector(
      `td.new-diff-line-number[${GITHUB_SELECTORS.attrLineNumber}="${lineCell.getAttribute(GITHUB_SELECTORS.attrLineNumber)}"][${GITHUB_SELECTORS.attrDiffSide}="right"]`
    ) ?? row?.querySelector('td.new-diff-line-number[data-diff-side="right"]');

  for (const el of [lineNumCell, lineCell, row]) {
    if (el instanceof HTMLElement) {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }
  }

  const existingNew =
    row?.querySelector(GITHUB_SELECTORS.newCommentMarker) ??
    lineCell.querySelector(GITHUB_SELECTORS.newCommentMarker);
  if (existingNew) {
    return;
  }

  if (lineNumCell instanceof HTMLElement) {
    lineNumCell.click();
    await delay(350);
  }

  const markerBtn =
    row?.querySelector(`${GITHUB_SELECTORS.inlineMarkersWrapper} button`) ??
    row?.querySelector('button .octicon-plus')?.closest('button');
  if (markerBtn instanceof HTMLButtonElement) {
    markerBtn.click();
    await delay(400);
    return;
  }

  lineCell.click();
  await delay(300);
}

/**
 * @param {Element} near
 * @returns {Promise<HTMLTextAreaElement|null>}
 */
async function waitForNewCommentTextarea(near) {
  const row = near.closest('tr.diff-line-row');
  for (let i = 0; i < LIMITS.MAX_COMMENT_EDITOR_WAIT_ITERATIONS; i++) {
    const scopes = [
      row,
      row?.querySelector(GITHUB_SELECTORS.inlineMarkersWrapper),
      near.closest('[id^="diff-"]'),
    ].filter(Boolean);

    for (const root of scopes) {
      const inNewThread = root.querySelector(
        `${GITHUB_SELECTORS.newCommentMarker} textarea`
      );
      if (inNewThread instanceof HTMLTextAreaElement) {
        return inNewThread;
      }
      const textarea =
        root.querySelector(GITHUB_SELECTORS.commentTextarea) ??
        root.querySelector(GITHUB_SELECTORS.commentTextareaFallback);
      if (
        textarea instanceof HTMLTextAreaElement &&
        !isInsideExistingThreadReply(textarea)
      ) {
        return textarea;
      }
    }
    await delay(LIMITS.COMMENT_EDITOR_WAIT_MS);
  }
  return null;
}

/**
 * Evita pegar textarea de reply de outra thread por engano.
 * @param {HTMLTextAreaElement} textarea
 */
function isInsideExistingThreadReply(textarea) {
  return Boolean(
    textarea.closest('[data-marker-navigation-thread-reply="true"]')
  );
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
