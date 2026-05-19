import {
  BITRIX_ONLINE_URL,
  MESSAGE_TYPES,
  STORAGE_KEYS,
} from '../shared/constants.js';
import { buildBitrixSoMessage } from '../shared/bitrix-message.js';

/**
 * @param {{ prUrl: string, decision: 'approve'|'request_changes' }} params
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

  await waitForTabComplete(tabId);
  await notifyBitrixTab(tabId);
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
    }, 25_000);
  });
}

/**
 * @param {number} tabId
 */
async function notifyBitrixTab(tabId) {
  for (let i = 0; i < 8; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.BITRIX_RUN_PENDING,
      });
      return;
    } catch {
      await delay(1500);
    }
  }
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
