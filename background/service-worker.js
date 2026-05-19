import { MESSAGE_TYPES } from '../shared/constants.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';
import {
  getConfigStatus,
  saveCredentials,
  getBitrixSendSoEnabled,
  setBitrixSendSoEnabled,
} from '../services/storage.service.js';
import { scheduleBitrixSoPost } from './bitrix-bridge.js';
import { runFullReview, runScore } from '../services/analysis.service.js';
import { validatePrMessageSize } from '../services/payload-guard.service.js';
import { isPlainObject } from '../shared/validators.js';
import { openReviewerModalInTab } from './content-bridge.js';
import { assertAllowedModel } from '../shared/model-options.js';
import {
  getCachedReview,
  saveCachedReview,
} from '../services/review-cache.service.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: sanitizeErrorMessage(err instanceof Error ? err.message : err),
      })
    );
  return true;
});

/**
 * @param {object} message
 */
async function handleMessage(message) {
  const type = message?.type;
  if (!type) {
    throw new Error('Mensagem inválida');
  }

  switch (type) {
    case MESSAGE_TYPES.GET_CONFIG: {
      const status = await getConfigStatus();
      return { ok: true, hasApiKey: status.hasApiKey, model: status.model };
    }

    case MESSAGE_TYPES.SAVE_CONFIG: {
      if (!message.apiKey || !message.model) {
        throw new Error('API Key e modelo são obrigatórios');
      }
      await saveCredentials({
        apiKey: String(message.apiKey).trim(),
        model: assertAllowedModel(message.model),
      });
      return { ok: true };
    }

    case MESSAGE_TYPES.RUN_REVIEW: {
      const prData = assertPrData(message.prData);
      validatePrMessageSize(prData);
      const userNotes =
        typeof message.userNotes === 'string' ? message.userNotes : '';
      const externalContext =
        typeof message.externalContext === 'string'
          ? message.externalContext
          : '';
      const review = await runFullReview(prData, userNotes, externalContext);
      return { ok: true, review: stripReviewForTransport(review) };
    }

    case MESSAGE_TYPES.RUN_SCORE: {
      const prData = assertPrData(message.prData);
      validatePrMessageSize(prData);
      const userNotes =
        typeof message.userNotes === 'string' ? message.userNotes : '';
      const externalContext =
        typeof message.externalContext === 'string'
          ? message.externalContext
          : '';
      const score = await runScore(prData, userNotes, externalContext);
      return { ok: true, score };
    }

    case MESSAGE_TYPES.GET_REVIEW_CACHE: {
      const prUrl = String(message.prUrl ?? '');
      const review = await getCachedReview(prUrl);
      return { ok: true, review };
    }

    case MESSAGE_TYPES.SAVE_REVIEW_CACHE: {
      const prUrl = String(message.prUrl ?? '');
      if (!isPlainObject(message.review)) {
        throw new Error('review inválido');
      }
      await saveCachedReview(prUrl, message.review);
      return { ok: true };
    }

    case MESSAGE_TYPES.OPEN_MODAL: {
      const tabId = message.tabId;
      if (typeof tabId !== 'number') {
        throw new Error('tabId inválido');
      }
      await openReviewerModalInTab(tabId);
      return { ok: true };
    }

    case MESSAGE_TYPES.GET_BITRIX_SEND_SO: {
      return { ok: true, enabled: await getBitrixSendSoEnabled() };
    }

    case MESSAGE_TYPES.SET_BITRIX_SEND_SO: {
      await setBitrixSendSoEnabled(Boolean(message.enabled));
      return { ok: true };
    }

    case MESSAGE_TYPES.BITRIX_POST_SO: {
      const prUrl = String(message.prUrl ?? '').trim();
      const decision = message.decision;
      if (!prUrl) {
        throw new Error('URL do PR obrigatória');
      }
      if (decision !== 'approve' && decision !== 'request_changes') {
        throw new Error('decision inválida');
      }
      await scheduleBitrixSoPost({ prUrl, decision });
      return { ok: true };
    }

    default:
      throw new Error(`Tipo não suportado no background: ${type}`);
  }
}

/**
 * @param {unknown} prData
 */
function assertPrData(prData) {
  if (!isPlainObject(prData)) {
    throw new Error('Dados do PR inválidos');
  }
  if (!Array.isArray(prData.files)) {
    throw new Error('files deve ser array');
  }
  if (!Array.isArray(prData.existingComments)) {
    throw new Error('existingComments deve ser array');
  }
  return prData;
}

/**
 * Remove campos desnecessários da resposta (menor vazamento em messaging).
 * @param {object} review
 */
function stripReviewForTransport(review) {
  return {
    stepsSummary: review.stepsSummary,
    findings: review.findings,
    stepResults: review.stepResults,
  };
}
