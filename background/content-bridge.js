import { MESSAGE_TYPES, isPrChangesPage } from '../shared/constants.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';

const CONTENT_LOADER = 'content/loader.js';

/**
 * Garante content script na aba e envia mensagem.
 * @param {number} tabId
 * @param {object} message
 */
export async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isMissingReceiverError(msg)) {
      throw err;
    }
    await injectContentScript(tabId);
    await delay(150);
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

/**
 * @param {number} tabId
 */
export async function openReviewerModalInTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? '';
  if (!isPrChangesPage(url)) {
    throw new Error(
      'Abra o PR na página /changes (Files changed) e tente novamente.'
    );
  }

  const response = await sendToTab(tabId, {
    type: MESSAGE_TYPES.OPEN_MODAL,
  });

  if (response && response.ok === false) {
    throw new Error(response.error ?? 'Falha ao abrir o MobilinhoReviewer');
  }

  return response;
}

/**
 * @param {number} tabId
 */
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_LOADER],
    });
  } catch (err) {
    throw new Error(
      sanitizeErrorMessage(
        `Não foi possível injetar na aba. Recarregue a página do PR (F5) e tente de novo. (${err instanceof Error ? err.message : err})`
      )
    );
  }
}

/**
 * @param {string} msg
 */
function isMissingReceiverError(msg) {
  return (
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection')
  );
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
