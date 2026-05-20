import {
  MESSAGE_TYPES,
  STORAGE_KEYS,
  BITRIX_SO_CHAT_NAME,
} from '../shared/constants.js';
import { BITRIX_SELECTORS } from '../shared/bitrix-selectors.js';
import { getPrMatchKey } from '../shared/bitrix-message.js';
import { LIMITS } from '../shared/limits.js';

if (!globalThis.__mobilinhoBitrixListener) {
  globalThis.__mobilinhoBitrixListener = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.BITRIX_RUN_PENDING) {
      runPendingBitrixJob()
        .then((result) => sendResponse(result))
        .catch((err) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      return true;
    }
    return false;
  });

  queueMicrotask(() => {
    runPendingBitrixJob().catch(() => {});
  });
}

/**
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
async function runPendingBitrixJob() {
  const stored = await chrome.storage.session.get(STORAGE_KEYS.BITRIX_PENDING);
  const job = stored[STORAGE_KEYS.BITRIX_PENDING];
  if (!job?.prUrl || !job?.messageText) {
    return { ok: false, error: 'Nenhum envio Bitrix pendente' };
  }

  await waitForMessenger();

  const opened = await openSoChat();
  if (!opened) {
    return {
      ok: false,
      error: `Bate-papo "${BITRIX_SO_CHAT_NAME}" não encontrado. Pesquise manualmente no Bitrix.`,
    };
  }

  await delay(LIMITS.BITRIX_CHAT_OPEN_WAIT_MS);

  const messageEl = await findMessageForPr(job.prUrl);
  if (!messageEl) {
    return {
      ok: false,
      error: `Nenhuma mensagem com este PR encontrada após rolar o histórico (limite de ${LIMITS.BITRIX_MAX_SCROLL_STEPS} rolagens). PR: ${job.prUrl}`,
    };
  }

  const replied = await replyToMessage(messageEl, job.messageText);
  if (!replied.success) {
    return { ok: false, error: replied.message };
  }

  await chrome.storage.session.remove(STORAGE_KEYS.BITRIX_PENDING);
  return {
    ok: true,
    message: replied.message,
  };
}

/**
 * @returns {Promise<void>}
 */
async function waitForMessenger() {
  for (let i = 0; i < LIMITS.BITRIX_MESSENGER_WAIT_ITERATIONS; i++) {
    if (document.querySelector(BITRIX_SELECTORS.messengerRoot)) {
      return;
    }
    await delay(LIMITS.BITRIX_STEP_WAIT_MS);
  }
  throw new Error('Messenger Bitrix24 não carregou a tempo');
}

/**
 * @returns {Promise<boolean>}
 */
async function openSoChat() {
  if (clickChatByTitle(BITRIX_SO_CHAT_NAME)) {
    return true;
  }

  const search = document.querySelector(BITRIX_SELECTORS.searchInput);
  if (!(search instanceof HTMLInputElement)) {
    return false;
  }

  search.focus();
  search.click();
  setInputValue(search, 'Portal web SO');
  await delay(LIMITS.BITRIX_SEARCH_WAIT_MS);

  const items = document.querySelectorAll(BITRIX_SELECTORS.searchItem);
  for (const item of items) {
    const title = item.querySelector(BITRIX_SELECTORS.chatTitleText);
    if (chatTitleMatches(title?.textContent, BITRIX_SO_CHAT_NAME)) {
      item.click();
      return true;
    }
  }

  return clickChatByTitle(BITRIX_SO_CHAT_NAME);
}

/**
 * @param {string} expected
 * @returns {boolean}
 */
function clickChatByTitle(expected) {
  const selectors = [
    BITRIX_SELECTORS.recentChatItem,
    BITRIX_SELECTORS.searchItem,
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const title = el.querySelector(BITRIX_SELECTORS.chatTitleText);
      if (chatTitleMatches(title?.textContent, expected)) {
        el.click();
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {string|undefined|null} text
 * @param {string} expected
 */
function chatTitleMatches(text, expected) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return (
    value.includes('Portal web') &&
    value.includes('SO') &&
    value.toLowerCase().includes('portal')
  );
}

/**
 * @param {string} prUrl
 * @returns {Promise<Element|null>}
 */
async function findMessageForPr(prUrl) {
  const key = getPrMatchKey(prUrl);
  if (!key) {
    return null;
  }

  const foundVisible = findMessageInDom(key);
  if (foundVisible) {
    return foundVisible;
  }

  const scroller = getChatScrollContainer();
  if (!scroller) {
    return null;
  }

  let previousScrollTop = scroller.scrollTop;

  for (let step = 0; step < LIMITS.BITRIX_MAX_SCROLL_STEPS; step++) {
    if (scroller.scrollTop <= 0) {
      break;
    }

    scroller.scrollBy({ top: -LIMITS.BITRIX_SCROLL_PIXELS, behavior: 'auto' });
    await delay(LIMITS.BITRIX_SCROLL_WAIT_MS);

    const found = findMessageInDom(key);
    if (found) {
      return found;
    }

    if (scroller.scrollTop <= 0) {
      break;
    }
    if (scroller.scrollTop === previousScrollTop) {
      break;
    }
    previousScrollTop = scroller.scrollTop;
  }

  return findMessageInDom(key);
}

/**
 * @returns {HTMLElement|null}
 */
function getChatScrollContainer() {
  const selectors = [
    '.bx-im-dialog-chat__scroll-container',
    '.bx-im-message-list__container',
    '[class*="bx-im-dialog-chat"] [class*="scroll"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  const fallback = document.querySelector(
    '.bx-im-dialog-chat__scroll-container, .bx-im-message-list__container'
  );
  return fallback instanceof HTMLElement ? fallback : null;
}

/**
 * @param {string} pullKey
 * @returns {Element|null}
 */
function findMessageInDom(pullKey) {
  const wraps = document.querySelectorAll(BITRIX_SELECTORS.messageWrap);
  let lastMatch = null;

  for (const wrap of wraps) {
    const links = wrap.querySelectorAll('a[href*="github.com"]');
    for (const a of links) {
      if (a.href.toLowerCase().includes(pullKey)) {
        lastMatch = wrap;
      }
    }
    if (!lastMatch && wrap.textContent?.toLowerCase().includes(pullKey)) {
      lastMatch = wrap;
    }
  }

  return lastMatch;
}

/**
 * @param {Element} messageWrap
 * @param {string} text
 */
async function replyToMessage(messageWrap, text) {
  messageWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(400);

  messageWrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  await delay(200);

  const menuBtn = messageWrap.querySelector(
    BITRIX_SELECTORS.messageContextMenuBtn
  );
  if (!(menuBtn instanceof HTMLButtonElement)) {
    return { success: false, message: 'Menu da mensagem não encontrado' };
  }

  menuBtn.click();
  await delay(350);

  if (!clickVisibleByText('Responder')) {
    return {
      success: false,
      message: 'Opção "Responder" não encontrada no menu da mensagem',
    };
  }

  await delay(500);

  const textarea = await waitForTextarea();
  if (!textarea) {
    return { success: false, message: 'Campo de resposta não encontrado' };
  }

  setInputValue(textarea, text);
  textarea.focus();

  const sendBtn = document.querySelector(BITRIX_SELECTORS.sendButton);
  if (sendBtn instanceof HTMLElement && !sendBtn.classList.contains('--disabled')) {
    sendBtn.click();
    return {
      success: true,
      message: 'Mensagem enviada no grupo [Portal web] SO`s',
    };
  }

  return {
    success: true,
    message: 'Resposta preenchida — clique em Enviar no Bitrix',
  };
}

/**
 * @param {string} label
 */
function clickVisibleByText(label) {
  const candidates = document.querySelectorAll(
    '[role="menuitem"], [class*="popup"] [class*="item"], [class*="menu"] button, [class*="menu"] div'
  );
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) {
      continue;
    }
    const text = el.textContent?.trim();
    if (text === label && el.offsetParent !== null) {
      el.click();
      return true;
    }
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (
      node instanceof HTMLElement &&
      node.childElementCount === 0 &&
      node.textContent?.trim() === label &&
      node.offsetParent !== null
    ) {
      node.click();
      return true;
    }
    node = walker.nextNode();
  }
  return false;
}

/**
 * @returns {Promise<HTMLTextAreaElement|null>}
 */
async function waitForTextarea() {
  for (let i = 0; i < LIMITS.BITRIX_TEXTAREA_WAIT_ITERATIONS; i++) {
    const el = document.querySelector(BITRIX_SELECTORS.textarea);
    if (el instanceof HTMLTextAreaElement) {
      return el;
    }
    await delay(LIMITS.BITRIX_STEP_WAIT_MS);
  }
  return null;
}

/**
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 * @param {string} value
 */
function setInputValue(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
