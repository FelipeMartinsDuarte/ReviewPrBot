import {
  BITRIX_ONLINE_URL,
  MESSAGE_TYPES,
  STORAGE_KEYS,
} from '../shared/constants.js';
import { buildBitrixSoMessage } from '../shared/bitrix-message.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';

const BITRIX_LOADER = 'content/bitrix-loader.js';

/**
 * @param {{ prUrl: string, decision: 'approve'|'request_changes' }} params
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
export async function scheduleBitrixSoPost({ prUrl, decision }) {
  const statusLabel =
    decision === 'approve' ? 'Aprovado' : 'Pendente de Alteração';
  const messageText = buildBitrixSoMessage(prUrl, statusLabel);
  if (!messageText) {
    throw new Error('URL do PR inválida para envio no Bitrix');
  }

  await chrome.storage.session.set({
    [STORAGE_KEYS.BITRIX_PENDING]: {
      prUrl,
      statusLabel,
      messageText,
      createdAt: Date.now(),
    },
  });

  const tabs = await chrome.tabs.query({
    url: ['https://mobilemed.bitrix24.com.br/*'],
  });

  let tabId;
  if (tabs.length > 0) {
    tabId = tabs[0].id;
    await chrome.tabs.update(tabId, { active: true, url: BITRIX_ONLINE_URL });
  } else {
    const tab = await chrome.tabs.create({
      url: BITRIX_ONLINE_URL,
      active: true,
    });
    tabId = tab.id;
  }

  if (typeof tabId !== 'number') {
    return { ok: false, error: 'Não foi possível abrir aba do Bitrix' };
  }

  await waitForTabComplete(tabId);
  await delay(2000);
  return notifyBitrixTab(tabId);
}

/**
 * @param {number} tabId
 */
async function waitForTabComplete(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') {
    return;
  }

  await new Promise((resolve) => {
    const listener = (updatedId, info) => {
      if (updatedId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30_000);
  });
}

/**
 * @param {number} tabId
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
async function notifyBitrixTab(tabId) {
  for (let i = 0; i < 20; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.BITRIX_RUN_PENDING,
      });
      if (response && typeof response.ok === 'boolean') {
        return response;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isMissingReceiverError(msg)) {
        await injectBitrixScript(tabId);
        await delay(800);
      }
    }
    await delay(1500);
  }

  return {
    ok: false,
    error:
      'Automação Bitrix não iniciou. Abra https://mobilemed.bitrix24.com.br/online/, recarregue (F5) e tente de novo.',
  };
}

/**
 * @param {number} tabId
 */
async function injectBitrixScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [BITRIX_LOADER],
    });
  } catch (err) {
    throw new Error(
      sanitizeErrorMessage(
        `Falha ao injetar script no Bitrix: ${err instanceof Error ? err.message : err}`
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
