import { GITHUB_SELECTORS } from '../shared/github-selectors.js';
import { findDiffRootForFile, findLineElement } from './github-scraper.js';
import { LIMITS } from '../shared/limits.js';

/** @readonly */
const SELECTORS = Object.freeze({
  threadHeading: '[class*="inlineReviewThreadHeading"]',
  threadReplyRoot: '[data-marker-navigation-thread-reply="true"]',
  writeReplyButton: 'button.CompactCommentButton-module__CompactCommentInputContainer__Ab_eI',
  reviewThread: '[data-testid="review-thread"]',
});

/**
 * @param {string} filePath
 * @param {number} lineNumber
 * @returns {Element|null}
 */
export function findThreadForLine(filePath, lineNumber) {
  const root = findDiffRootForFile(filePath);
  if (!root) {
    return null;
  }

  const headings = root.querySelectorAll(SELECTORS.threadHeading);
  for (const heading of headings) {
    if (!headingMatchesLine(heading.textContent ?? '', lineNumber)) {
      continue;
    }
    const container =
      heading.closest('tr') ??
      heading.closest('td') ??
      heading.closest('[class*="InlineReviewThread"]') ??
      heading.parentElement;
    if (container) {
      return container;
    }
  }

  return findThreadInDiffRoot(root, lineNumber);
}

/**
 * @param {Element} root
 * @param {number} lineNumber
 */
function findThreadInDiffRoot(root, lineNumber) {
  const threads = root.querySelectorAll(SELECTORS.reviewThread);
  for (const thread of threads) {
    const heading = thread
      .closest('tr')
      ?.querySelector(SELECTORS.threadHeading);
    if (heading && headingMatchesLine(heading.textContent ?? '', lineNumber)) {
      return thread.closest('tr') ?? thread;
    }
  }
  return null;
}

/**
 * @param {string} text
 * @param {number} lineNumber
 */
function headingMatchesLine(text, lineNumber) {
  const n = String(lineNumber);
  return (
    new RegExp(`\\bR${n}\\b`).test(text) ||
    new RegExp(`\\bL${n}\\b`).test(text) ||
    new RegExp(`line\\s+R?${n}\\b`, 'i').test(text)
  );
}

/**
 * @param {string} filePath
 * @param {number} lineNumber
 */
export function lineHasCommentThread(filePath, lineNumber) {
  return findThreadForLine(filePath, lineNumber) !== null;
}

/**
 * Próxima linha no diff sem thread (para comentário novo).
 * @param {string} filePath
 * @param {number} fromLine
 * @param {number} [maxOffset]
 * @returns {number|null}
 */
export function findNextLineWithoutThread(filePath, fromLine, maxOffset = 12) {
  for (let offset = 1; offset <= maxOffset; offset++) {
    const candidate = fromLine + offset;
    if (!findLineElement(filePath, candidate)) {
      continue;
    }
    if (!lineHasCommentThread(filePath, candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Preenche resposta na thread existente — não envia.
 * @param {Element} threadContainer
 * @param {string} text
 */
export async function injectReplyDraft(threadContainer, text) {
  threadContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(350);

  const opened = await openReplyEditor(threadContainer);
  if (!opened) {
    return {
      success: false,
      message: 'Não foi possível abrir "Write a reply" na thread existente',
    };
  }

  const textarea = await waitForReplyTextarea(threadContainer);
  if (!textarea) {
    return {
      success: false,
      message: 'Editor de resposta não abriu na thread',
    };
  }

  setTextareaValue(textarea, text);
  textarea.focus();

  return {
    success: true,
    mode: 'reply',
  };
}

/**
 * @param {Element} threadContainer
 */
async function openReplyEditor(threadContainer) {
  const replyRoot =
    threadContainer.querySelector(SELECTORS.threadReplyRoot) ??
    threadContainer.querySelector('#react-issue-comment-composer');

  const existingTextarea = replyRoot?.querySelector('textarea');
  if (existingTextarea instanceof HTMLTextAreaElement) {
    return true;
  }

  const writeReplyBtn =
    replyRoot?.querySelector(SELECTORS.writeReplyButton) ??
    replyRoot?.querySelector('button[type="button"]') ??
    findButtonByText(threadContainer, 'Write a reply') ??
    findButtonByText(threadContainer, 'Escrever uma resposta');

  if (writeReplyBtn instanceof HTMLButtonElement) {
    writeReplyBtn.removeAttribute('aria-hidden');
    writeReplyBtn.removeAttribute('tabindex');
    writeReplyBtn.click();
    await delay(450);
    return true;
  }

  return false;
}

/**
 * @param {Element} container
 * @param {string} label
 */
function findButtonByText(container, label) {
  const buttons = container.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim() === label) {
      return btn;
    }
  }
  return null;
}

/**
 * @param {Element} threadContainer
 * @returns {Promise<HTMLTextAreaElement|null>}
 */
async function waitForReplyTextarea(threadContainer) {
  for (let i = 0; i < LIMITS.MAX_COMMENT_EDITOR_WAIT_ITERATIONS; i++) {
    const scopes = [
      threadContainer.querySelector(SELECTORS.threadReplyRoot),
      threadContainer.querySelector('#react-issue-comment-composer'),
      threadContainer,
    ].filter(Boolean);

    for (const scope of scopes) {
      const textarea =
        scope.querySelector(GITHUB_SELECTORS.commentTextarea) ??
        scope.querySelector(GITHUB_SELECTORS.commentTextareaFallback);
      if (textarea instanceof HTMLTextAreaElement) {
        return textarea;
      }
    }
    await delay(LIMITS.COMMENT_EDITOR_WAIT_MS);
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
