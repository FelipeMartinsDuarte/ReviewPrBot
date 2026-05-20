import { MESSAGE_TYPES, FINDING_STATUS } from '../shared/constants.js';
import {
  isPrChangesPage,
  scrapePullRequest,
  scrapePullRequestForExport,
  getPrUrl,
  scrollToDiffLine,
} from './github-scraper.js';
import { injectCommentDraft } from './github-comment-injector.js';
import { preparePrReviewDraft } from './github-pr-review.js';
import {
  openModal,
  closeModal,
  showLoading,
  renderReviewResults,
  renderScoreResults,
  showError,
  setModalBusy,
  setAttachFileLabel,
  setIncludeExternalChecked,
  isBitrixSendSoChecked,
} from './modal.js';
import { getPullRequestUrl } from '../shared/pr-url.js';
import {
  loadAttachedFile,
  clearAttachedContext,
  getAttachedContextForApi,
  getAttachedContext,
} from './attached-context.js';
import {
  buildReviewExportText,
  buildExportFilename,
  downloadTextFile,
} from './review-export.js';

/** @type {object|null} */
let lastReview = null;

/** @type {object|null} */
let lastScore = null;

/** Evita cliques duplos / loop de requests */
let operationInProgress = false;

const STEP_LABELS = ['Tree Sit', 'Validações', 'Compilação', 'Funcional'];

if (globalThis.__mobilinhoMessageListenerRegistered) {
  // loader pode ser re-injetado; evita listeners duplicados
} else {
  globalThis.__mobilinhoMessageListenerRegistered = true;
  registerMessageListener();
}

function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  });
}

/**
 * @param {object} message
 */
async function handleMessage(message) {
  const type = message?.type;
  if (!type) {
    throw new Error('Mensagem inválida');
  }

  switch (type) {
    case MESSAGE_TYPES.GET_PAGE_STATE:
      return {
        ok: true,
        onPage: isPrChangesPage(),
        url: window.location.href,
      };

    case MESSAGE_TYPES.OPEN_MODAL:
      await openReviewerModal();
      return { ok: true };

    case MESSAGE_TYPES.APPLY_FINDING: {
      const finding = findFinding(message.findingId);
      if (!finding) {
        throw new Error('Achado não encontrado');
      }
      const result = await injectCommentDraft({
        file: finding.file,
        line: finding.line,
        text: finding.githubComment,
      });
      return { ok: result.success, message: result.message };
    }

    case MESSAGE_TYPES.REFRESH_AND_RESCRAPE:
      window.location.reload();
      return { ok: true };

    default:
      throw new Error(`Tipo desconhecido: ${type}`);
  }
}

async function openReviewerModal() {
  const configRes = await sendBackground({ type: MESSAGE_TYPES.GET_CONFIG });
  const bitrixRes = await sendBackground({
    type: MESSAGE_TYPES.GET_BITRIX_SEND_SO,
  });
  const bitrixSendSo = Boolean(bitrixRes?.enabled);
  const onPage = isPrChangesPage();

  if (onPage) {
    await loadCachedReview();
  }

  openModal({
    onPage,
    hasConfig: Boolean(configRes?.hasApiKey && configRes?.model),

    onSaveConfig: async (apiKey, model) => {
      try {
        await sendBackground({
          type: MESSAGE_TYPES.SAVE_CONFIG,
          apiKey,
          model,
        });
        closeModal();
        await openReviewerModal();
      } catch (err) {
        showError(err.message);
      }
    },

    onRunReview: async (userNotes, externalContext) => {
      if (operationInProgress) {
        showError('Análise já em andamento. Aguarde ou recarregue a página.');
        return;
      }
      await runReviewFlow(userNotes, externalContext);
    },

    onRunScore: async (userNotes, externalContext) => {
      if (operationInProgress) {
        showError('Operação já em andamento. Aguarde a conclusão.');
        return;
      }
      await runScoreFlow(userNotes, externalContext);
    },

    getAttachedText: () => getAttachedContextForApi(true),

    onAttachFile: async (file) => {
      const att = await loadAttachedFile(file);
      setAttachFileLabel(att.fileName);
      setIncludeExternalChecked(true);
    },

    onClearAttach: () => {
      clearAttachedContext();
    },

    onExportReview: () => {
      exportCurrentAnalysis();
    },

    onPrReviewApprove: () => runPrReviewDraft('approve'),
    onPrReviewRequestChanges: () => runPrReviewDraft('request_changes'),

    onBitrixSendSoChange: async (enabled) => {
      await sendBackground({
        type: MESSAGE_TYPES.SET_BITRIX_SEND_SO,
        enabled,
      });
    },

    onRedo: async () => {
      if (operationInProgress) {
        showError('Aguarde a operação atual terminar antes de refazer.');
        return;
      }
      window.location.reload();
    },

    onSettings: async () => {
      closeModal();
      const cfg = await sendBackground({ type: MESSAGE_TYPES.GET_CONFIG });
      openModal({
        onPage: true,
        hasConfig: false,
        selectedModel: cfg?.model,
        onSaveConfig: async (apiKey, model) => {
          await sendBackground({
            type: MESSAGE_TYPES.SAVE_CONFIG,
            apiKey,
            model,
          });
          closeModal();
          await openReviewerModal();
        },
      });
    },

    onViewLine: async (findingId) => {
      const finding = findFinding(findingId);
      if (!finding) {
        showError('Achado não encontrado');
        return;
      }
      closeModal();
      await delay(200);
      const res = scrollToDiffLine(finding.file, finding.line);
      if (!res.success) {
        window.alert(res.message);
      }
    },

    onFindingAction: async (findingId, action) => {
      if (action === 'reject') {
        setFindingStatus(findingId, FINDING_STATUS.REJECTED);
        renderReviewResults(lastReview);
        await persistReview();
        return;
      }
      if (action === 'accept') {
        const finding = findFinding(findingId);
        if (!finding) {
          showError('Achado não encontrado');
          return;
        }
        const res = await injectCommentDraft({
          file: finding.file,
          line: finding.line,
          text: finding.githubComment,
        });
        if (!res.success) {
          showError(res.message);
          return;
        }
        setFindingStatus(findingId, FINDING_STATUS.ACCEPTED);
        renderReviewResults(lastReview);
        await persistReview();
      }
    },
  });

  const attached = getAttachedContext();
  if (attached) {
    setAttachFileLabel(attached.fileName);
  }

  if (lastReview) {
    renderReviewResults(lastReview);
  }
  if (lastScore) {
    renderScoreResults(lastScore, bitrixSendSo);
  }
}

async function loadCachedReview() {
  const res = await sendBackground({
    type: MESSAGE_TYPES.GET_REVIEW_CACHE,
    prUrl: getPrUrl(),
  });
  if (res?.ok && res.review) {
    lastReview = normalizeCachedReview(res.review);
  }
}

/**
 * @param {object} review
 */
function normalizeCachedReview(review) {
  const findings = (review.findings ?? []).map((f) => ({
    ...f,
    status: f.status ?? FINDING_STATUS.PENDING,
  }));
  return { ...review, findings };
}

async function persistReview() {
  if (!lastReview) {
    return;
  }
  await sendBackground({
    type: MESSAGE_TYPES.SAVE_REVIEW_CACHE,
    prUrl: getPrUrl(),
    review: lastReview,
  });
}

/**
 * @param {string} userNotes
 * @param {string} [externalContext]
 */
async function runReviewFlow(userNotes, externalContext = '') {
  operationInProgress = true;
  setModalBusy(true);
  showLoading(STEP_LABELS);
  try {
    const prData = scrapePullRequest();
    if (prData.files.length === 0) {
      throw new Error(
        'Nenhum diff encontrado. Role a página ou expanda os arquivos.'
      );
    }

    const result = await sendBackground({
      type: MESSAGE_TYPES.RUN_REVIEW,
      prData,
      userNotes,
      externalContext,
    });

    if (!result?.ok) {
      throw new Error(result?.error ?? 'Falha na revisão');
    }

    lastReview = result.review;
    await persistReview();
    renderReviewResults(lastReview);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    operationInProgress = false;
    setModalBusy(false);
  }
}

/**
 * @param {string} userNotes
 * @param {string} [externalContext]
 */
async function runScoreFlow(userNotes, externalContext = '') {
  operationInProgress = true;
  setModalBusy(true);
  showLoading(['Medindo score...']);
  try {
    const prData = scrapePullRequest();
    const result = await sendBackground({
      type: MESSAGE_TYPES.RUN_SCORE,
      prData,
      userNotes,
      externalContext,
    });

    if (!result?.ok) {
      throw new Error(result?.error ?? 'Falha no score');
    }

    lastScore = result.score;
    const bitrixRes = await sendBackground({
      type: MESSAGE_TYPES.GET_BITRIX_SEND_SO,
    });
    renderScoreResults(lastScore, Boolean(bitrixRes?.enabled));
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    operationInProgress = false;
    setModalBusy(false);
  }
}

/**
 * @param {string} id
 */
function findFinding(id) {
  const findings = lastReview?.findings ?? [];
  return findings.find((f) => f.id === id) ?? null;
}

/**
 * @param {string} id
 * @param {string} status
 */
function setFindingStatus(id, status) {
  if (!lastReview?.findings) {
    return;
  }
  const f = lastReview.findings.find((x) => x.id === id);
  if (f) {
    f.status = status;
  }
}

/**
 * @param {object} payload
 */
function sendBackground(payload) {
  return chrome.runtime.sendMessage(payload);
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {'approve'|'request_changes'} decision
 */
async function runPrReviewDraft(decision) {
  if (!lastScore && !lastReview) {
    showError('Medir Score ou Revisar PR antes de aprovar/solicitar alterações.');
    return;
  }

  let bitrixEnabled = isBitrixSendSoChecked();
  if (!bitrixEnabled) {
    const stored = await sendBackground({
      type: MESSAGE_TYPES.GET_BITRIX_SEND_SO,
    });
    bitrixEnabled = Boolean(stored?.enabled);
  }

  closeModal();
  await delay(250);

  const res = await preparePrReviewDraft(decision, lastReview, lastScore);
  if (!res.success) {
    window.alert(res.message);
    return;
  }

  if (bitrixEnabled) {
    const prUrl = getPullRequestUrl();
    try {
      const bitrixRes = await sendBackground({
        type: MESSAGE_TYPES.BITRIX_POST_SO,
        prUrl,
        decision,
      });
      if (!bitrixRes?.ok) {
        window.alert(
          bitrixRes?.error ??
            'Falha ao enviar no Bitrix. Confira a aba do Bitrix24.'
        );
      }
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : String(err)
      );
    }
    return;
  }

  window.alert(
    'Review preenchido no GitHub — confira e clique em Submit review.'
  );
}

function exportCurrentAnalysis() {
  if (!isPrChangesPage()) {
    showError('Abra o PR na página /changes para exportar.');
    return;
  }

  try {
    const prData = scrapePullRequestForExport();
    if (prData.files.length === 0 && !lastReview && !lastScore) {
      showError(
        'Nenhum diff visível. Role a página, expanda os arquivos e tente de novo.'
      );
      return;
    }

    const prUrl = getPrUrl();
    const text = buildReviewExportText(
      lastReview,
      lastScore,
      prUrl,
      prData
    );
    const filename = buildExportFilename(prUrl);
    downloadTextFile(filename, text);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  }
}
