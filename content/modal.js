import { FINDING_CATEGORIES, FINDING_STATUS } from '../shared/constants.js';
import { buildModelSelectHtml } from '../shared/model-options.js';

/** @type {ShadowRoot|null} */
let shadowRoot = null;

/** @type {object|null} */
let activeModalOptions = null;

/**
 * @param {object} options
 */
export function openModal(options) {
  closeModal();
  const host = document.createElement('div');
  host.id = 'mobilinho-reviewer-host';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'closed' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/modal.css');
  shadowRoot.appendChild(link);

  const overlay = document.createElement('div');
  overlay.className = 'mobilinho-overlay';
  overlay.innerHTML = buildShell(options);
  shadowRoot.appendChild(overlay);

  activeModalOptions = options;
  bindEvents(overlay, options);
}

export function closeModal() {
  const host = document.getElementById('mobilinho-reviewer-host');
  if (host) {
    host.remove();
  }
  shadowRoot = null;
  activeModalOptions = null;
}

/**
 * @returns {boolean}
 */
export function isBitrixSendSoChecked() {
  const root = getOverlay();
  const box = root?.querySelector('#mr-bitrix-send-so');
  return box instanceof HTMLInputElement ? box.checked : false;
}

/**
 * Desabilita ações que disparam OpenAI (anti clique duplo).
 * @param {boolean} busy
 */
export function setModalBusy(busy) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  const actions = ['run-review', 'run-score', 'redo'];
  for (const action of actions) {
    const btn = root.querySelector(`[data-action="${action}"]`);
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = busy;
    }
  }
  const loadingText = root.querySelector('#mr-loading-text');
  if (loadingText && busy) {
    loadingText.textContent =
      'Analisando… não feche a aba (até 5 chamadas OpenAI).';
  }
}

/**
 * @param {object} options
 */
function buildShell(options) {
  const { onPage, hasConfig } = options;
  if (!onPage) {
    return `
      <div class="mobilinho-backdrop">
        <div class="mobilinho-modal">
          <header class="mobilinho-header">
            <div class="mobilinho-logo">Felipe<span>DosReview</span></div>
            <button class="mobilinho-close" data-action="close">&times;</button>
          </header>
          <div class="mobilinho-body">
            <div class="mobilinho-alert mobilinho-alert--warn">
              Abra o Pull Request na página <strong>/changes</strong> do GitHub.
            </div>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="mobilinho-backdrop">
      <div class="mobilinho-modal">
        <header class="mobilinho-header">
          <div class="mobilinho-logo">Felipe<span>DosReview</span></div>
          <button class="mobilinho-close" data-action="close">&times;</button>
        </header>
        <div class="mobilinho-body" id="mr-body">
          ${!hasConfig ? configPanel(options.selectedModel) : mainPanel()}
        </div>
        <footer class="mobilinho-footer" id="mr-footer">
          ${hasConfig ? `${notesPanelHtml()}${actionButtons()}` : ''}
        </footer>
      </div>
    </div>`;
}

/**
 * @param {string} [selectedModel]
 */
function configPanel(selectedModel) {
  return `
    <div class="mobilinho-alert mobilinho-alert--warn">Configure sua chave OpenAI para começar.</div>
    <div class="mobilinho-field">
      <label class="mobilinho-label">API Key (OpenAI)</label>
      <input type="password" class="mobilinho-input" id="mr-api-key" placeholder="sk-..." autocomplete="off" />
    </div>
    <div class="mobilinho-field">
      <label class="mobilinho-label">Modelo</label>
      ${buildModelSelectHtml('mr-model', selectedModel, 'mobilinho-input mobilinho-select')}
    </div>
    <button class="mobilinho-btn mobilinho-btn--primary" data-action="save-config">Salvar configuração</button>`;
}

function notesPanelHtml() {
  return `
    <div id="mr-notes-panel-review" class="mobilinho-notes-panel mobilinho-hidden" data-notes-kind="review">
      <button type="button" class="mobilinho-notes-toggle" data-action="toggle-notes-review" aria-expanded="false">
        <span>Observações — Revisar PR</span>
        <span class="mobilinho-notes-toggle-icon" aria-hidden="true">+</span>
      </button>
      <div id="mr-notes-review-body" class="mobilinho-notes-body mobilinho-hidden">
        <p class="mobilinho-attach-hint">Opcional — expanda só se quiser enviar contexto na revisão.</p>
        <textarea class="mobilinho-textarea mobilinho-textarea--compact" id="mr-notes-review" placeholder="Contexto, escopo, o que validar..."></textarea>
      </div>
    </div>
    <div id="mr-notes-panel-score" class="mobilinho-notes-panel mobilinho-hidden" data-notes-kind="score">
      <button type="button" class="mobilinho-notes-toggle" data-action="toggle-notes-score" aria-expanded="false">
        <span>Observações — Medir Score</span>
        <span class="mobilinho-notes-toggle-icon" aria-hidden="true">+</span>
      </button>
      <div id="mr-notes-score-body" class="mobilinho-notes-body mobilinho-hidden">
        <p class="mobilinho-attach-hint">Opcional — expanda só se quiser critérios extras no score.</p>
        <textarea class="mobilinho-textarea mobilinho-textarea--compact" id="mr-notes-score" placeholder="Critérios, peso de riscos..."></textarea>
        <p id="mr-score-review-hint" class="mobilinho-attach-hint mobilinho-hidden"></p>
      </div>
    </div>`;
}

function mainPanel() {
  return `
    <div id="mr-view-home">
      <div class="mobilinho-field mobilinho-attach-block">
        <label class="mobilinho-label">Contexto de outro PR (.txt)</label>
        <p class="mobilinho-attach-hint">Exporte a análise do back (ou outro PR) e anexe aqui ao revisar o front.</p>
        <div class="mobilinho-attach-row">
          <input type="file" accept=".txt,text/plain" id="mr-attach-file" class="mobilinho-hidden" />
          <button type="button" class="mobilinho-btn" data-action="pick-attach">Escolher .txt</button>
          <span id="mr-attach-name" class="mobilinho-attach-name">Nenhum arquivo</span>
          <button type="button" class="mobilinho-btn mobilinho-hidden" data-action="clear-attach" id="mr-clear-attach">Remover</button>
        </div>
      </div>
      <div class="mobilinho-checkbox-row">
        <input type="checkbox" id="mr-include-external" />
        <label for="mr-include-external">Incluir .txt anexado na revisão e no score</label>
      </div>
    </div>
    <div id="mr-view-loading" class="mobilinho-hidden">
      <div class="mobilinho-loading"><div class="mobilinho-spinner"></div><span id="mr-loading-text">Analisando...</span></div>
      <div class="mobilinho-steps" id="mr-steps"></div>
    </div>
    <div id="mr-view-results" class="mobilinho-hidden"></div>
    <div id="mr-view-score" class="mobilinho-hidden"></div>`;
}

function actionButtons() {
  return `
    <div class="mobilinho-footer-action-row">
      <button class="mobilinho-btn mobilinho-btn--primary" data-action="run-review">Revisar PR</button>
      <button class="mobilinho-btn" data-action="run-score">Medir Score</button>
      <button class="mobilinho-btn" data-action="export-review">Exportar .txt</button>
      <button class="mobilinho-btn" data-action="redo">Refazer análise</button>
      <button class="mobilinho-btn" data-action="settings">Configurações</button>
    </div>`;
}

/**
 * @param {Element} root
 * @param {object} options
 */
function bindEvents(root, options) {
  root.querySelector('[data-action="close"]')?.addEventListener('click', closeModal);

  root.querySelector('[data-action="save-config"]')?.addEventListener('click', () => {
    const apiKey = /** @type {HTMLInputElement} */ (
      root.querySelector('#mr-api-key')
    )?.value;
    const model = /** @type {HTMLSelectElement} */ (
      root.querySelector('#mr-model')
    )?.value;
    options.onSaveConfig?.(apiKey, model);
  });

  root.querySelector('[data-action="pick-attach"]')?.addEventListener('click', () => {
    root.querySelector('#mr-attach-file')?.click();
  });

  root.querySelector('#mr-attach-file')?.addEventListener('change', async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      await options.onAttachFile?.(file);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
      input.value = '';
    }
  });

  root.querySelector('[data-action="clear-attach"]')?.addEventListener('click', () => {
    const input = root.querySelector('#mr-attach-file');
    if (input instanceof HTMLInputElement) {
      input.value = '';
    }
    options.onClearAttach?.();
    setAttachFileLabel('');
  });

  root.querySelector('[data-action="run-review"]')?.addEventListener('click', () => {
    if (!assertExternalContextReady(root, options)) {
      return;
    }
    const notes = getNotes(root, 'review');
    const externalContext = getExternalContext(root, options);
    options.onRunReview?.(notes, externalContext);
  });

  root.querySelector('[data-action="run-score"]')?.addEventListener('click', () => {
    if (!assertExternalContextReady(root, options)) {
      return;
    }
    const notes = getNotes(root, 'score');
    const externalContext = getExternalContext(root, options);
    options.onRunScore?.(notes, externalContext);
  });

  root.querySelector('[data-action="redo"]')?.addEventListener('click', () => {
    options.onRedo?.();
  });

  root.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
    options.onSettings?.();
  });

  root
    .querySelector('[data-action="toggle-notes-review"]')
    ?.addEventListener('click', () => toggleNotesPanel(root, 'review'));
  root
    .querySelector('[data-action="toggle-notes-score"]')
    ?.addEventListener('click', () => toggleNotesPanel(root, 'score'));

  setNotesPanelMode('review');

  root.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest('[data-action="export-review"]')) {
      options.onExportReview?.();
      return;
    }
    if (target.closest('[data-action="pr-approve"]')) {
      options.onPrReviewApprove?.();
      return;
    }
    if (target.closest('[data-action="pr-request-changes"]')) {
      options.onPrReviewRequestChanges?.();
      return;
    }
    const action = target.closest('[data-finding-action]');
    if (!action) {
      return;
    }
    const findingId = action.getAttribute('data-finding-id');
    const act = action.getAttribute('data-finding-action');
    if (!findingId || !act) {
      return;
    }
    if (act === 'view-line') {
      options.onViewLine?.(findingId);
      return;
    }
    options.onFindingAction?.(findingId, act);
  });
}

/**
 * @param {Element} root
 * @param {'review'|'score'} kind
 */
function getNotes(root, kind) {
  const ta = root.querySelector(
    kind === 'review' ? '#mr-notes-review' : '#mr-notes-score'
  );
  return /** @type {HTMLTextAreaElement} */ (ta)?.value?.trim() ?? '';
}

/**
 * @param {'review'|'score'|'none'} mode
 */
export function setNotesPanelMode(mode) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  const reviewPanel = root.querySelector('#mr-notes-panel-review');
  const scorePanel = root.querySelector('#mr-notes-panel-score');
  reviewPanel?.classList.toggle('mobilinho-hidden', mode !== 'review');
  scorePanel?.classList.toggle('mobilinho-hidden', mode !== 'score');
}

/**
 * @param {Element} root
 * @param {'review'|'score'} kind
 */
function toggleNotesPanel(root, kind) {
  const panel = root.querySelector(
    kind === 'review' ? '#mr-notes-panel-review' : '#mr-notes-panel-score'
  );
  const body = root.querySelector(
    kind === 'review' ? '#mr-notes-review-body' : '#mr-notes-score-body'
  );
  const btn = panel?.querySelector('.mobilinho-notes-toggle');
  const icon = panel?.querySelector('.mobilinho-notes-toggle-icon');
  if (!body || !btn) {
    return;
  }
  const open = body.classList.toggle('mobilinho-hidden');
  const expanded = !open;
  btn.setAttribute('aria-expanded', String(expanded));
  if (icon) {
    icon.textContent = expanded ? '−' : '+';
  }
  if (expanded) {
    body.querySelector('textarea')?.focus();
  }
}

/**
 * @param {object|null} review
 */
export function updateScoreReviewHint(review) {
  const root = getOverlay();
  const hint = root?.querySelector('#mr-score-review-hint');
  if (!hint) {
    return;
  }
  if (!review?.findings?.length) {
    hint.classList.add('mobilinho-hidden');
    hint.textContent = '';
    return;
  }
  const rejected = review.findings.filter(
    (f) => f.status === FINDING_STATUS.REJECTED
  ).length;
  const accepted = review.findings.filter(
    (f) => f.status === FINDING_STATUS.ACCEPTED
  ).length;
  const pending = review.findings.filter(
    (f) => (f.status ?? FINDING_STATUS.PENDING) === FINDING_STATUS.PENDING
  ).length;
  hint.classList.remove('mobilinho-hidden');
  hint.textContent = `Medir Score usará a revisão: ${rejected} recusado(s), ${accepted} aceito(s), ${pending} pendente(s).`;
}

/**
 * @param {Element} root
 * @param {object} opts
 */
function getExternalContext(root, opts) {
  const include = root.querySelector('#mr-include-external');
  if (!(/** @type {HTMLInputElement} */ (include)?.checked)) {
    return '';
  }
  return opts.getAttachedText?.() ?? '';
}

/**
 * @param {Element} root
 * @param {object} opts
 */
function assertExternalContextReady(root, opts) {
  const include = root.querySelector('#mr-include-external');
  if (!(/** @type {HTMLInputElement} */ (include)?.checked)) {
    return true;
  }
  const text = opts.getAttachedText?.() ?? '';
  if (text.trim()) {
    return true;
  }
  showError('Anexe um arquivo .txt ou desmarque "Incluir .txt anexado".');
  return false;
}

/**
 * @param {string} fileName
 */
/**
 * @param {boolean} checked
 */
export function setIncludeExternalChecked(checked) {
  const root = getOverlay();
  const el = root?.querySelector('#mr-include-external');
  if (el instanceof HTMLInputElement) {
    el.checked = checked;
  }
}

export function setAttachFileLabel(fileName) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  const label = root.querySelector('#mr-attach-name');
  if (label) {
    label.textContent = fileName?.trim() ? fileName : 'Nenhum arquivo';
  }
  root.querySelector('#mr-clear-attach')?.classList.toggle(
    'mobilinho-hidden',
    !fileName?.trim()
  );
}

function exportToolbarHtml() {
  return `<div class="mobilinho-toolbar">
    <button type="button" class="mobilinho-btn" data-action="export-review">Exportar análise + diff (.txt)</button>
  </div>`;
}

/**
 * @param {string[]} stepLabels
 */
export function showLoading(stepLabels = []) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  root.querySelector('#mr-view-home')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-results')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-score')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-loading')?.classList.remove('mobilinho-hidden');
  setNotesPanelMode('none');

  const stepsEl = root.querySelector('#mr-steps');
  if (stepsEl) {
    stepsEl.innerHTML = stepLabels
      .map(
        (l, i) =>
          `<span class="mobilinho-step-pill mobilinho-step-pill--active" data-step="${i}">${l}</span>`
      )
      .join('');
  }
}

/**
 * @param {number} index
 */
export function markStepDone(index) {
  const root = getOverlay();
  const pill = root?.querySelector(`[data-step="${index}"]`);
  pill?.classList.remove('mobilinho-step-pill--active');
  pill?.classList.add('mobilinho-step-pill--done');
}

/**
 * @param {object} review
 */
export function renderReviewResults(review) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  showResultsPanel(root);

  const container = root.querySelector('#mr-view-results');
  if (!container) {
    return;
  }

  const summary = review.stepsSummary ?? {};
  const visible = (review.findings ?? []).filter(
    (f) => f.status !== FINDING_STATUS.REJECTED
  );

  container.innerHTML = `
    ${exportToolbarHtml()}
    <p class="mobilinho-cache-hint">Análise salva neste PR — você pode fechar a aba e voltar depois.</p>
    <h3 style="margin:0 0 12px;font-size:1rem;">Resumo das etapas</h3>
    <div style="font-size:0.8rem;color:var(--mr-muted);margin-bottom:16px;">
      <p><strong>Tree Sit:</strong> ${escapeHtml(summary.treeSit || '—')}</p>
      <p><strong>Validações:</strong> ${escapeHtml(summary.validations || '—')}</p>
      <p><strong>Compilação:</strong> ${escapeHtml(summary.compilation || '—')}</p>
      <p><strong>Funcional:</strong> ${escapeHtml(summary.functional || '—')}</p>
    </div>
    <h3 style="margin:0 0 12px;font-size:1rem;">Achados (${visible.length})</h3>
    ${visible.length ? visible.map((f) => findingCard(f)).join('') : '<p style="color:var(--mr-muted);font-size:0.875rem;">Nenhum achado pendente.</p>'}`;

  container.classList.remove('mobilinho-hidden');
}

/**
 * @param {object} f
 */
function findingCard(f) {
  const cat = FINDING_CATEGORIES.includes(f.category) ? f.category : 'NORMAL';
  const status = f.status ?? FINDING_STATUS.PENDING;
  const isAccepted = status === FINDING_STATUS.ACCEPTED;
  const isPending = status === FINDING_STATUS.PENDING;

  const statusBadge = isAccepted
    ? '<span class="mobilinho-status-badge mobilinho-status-badge--accepted">✓ Aceito — rascunho no GitHub (resposta ou comentário)</span>'
    : '';

  const actions = isPending
    ? `<div class="mobilinho-finding-actions">
        <button type="button" class="mobilinho-btn" data-finding-action="view-line" data-finding-id="${escapeHtml(f.id)}">Ver linha</button>
        <button type="button" class="mobilinho-btn mobilinho-btn--primary" data-finding-action="accept" data-finding-id="${escapeHtml(f.id)}">Aceitar</button>
        <button type="button" class="mobilinho-btn mobilinho-btn--danger" data-finding-action="reject" data-finding-id="${escapeHtml(f.id)}">Recusar</button>
      </div>`
    : isAccepted
      ? `<div class="mobilinho-finding-actions">
        <button type="button" class="mobilinho-btn" data-finding-action="view-line" data-finding-id="${escapeHtml(f.id)}">Ver linha</button>
        <button type="button" class="mobilinho-btn" data-finding-action="undo-accept" data-finding-id="${escapeHtml(f.id)}">Desfazer aceite</button>
      </div>`
      : '';

  return `
    <article class="mobilinho-finding mobilinho-finding--${status}" data-finding-id="${escapeHtml(f.id)}">
      <header class="mobilinho-finding-header">
        <div>
          <span class="mobilinho-badge mobilinho-badge--${cat}">${cat}</span>
          ${statusBadge}
          <strong style="display:block;margin-top:6px;">${escapeHtml(f.title)}</strong>
          <span class="mobilinho-line-ref">${escapeHtml(f.file)} · linha ${f.line}</span>
        </div>
      </header>
      <p style="font-size:0.875rem;margin:0 0 12px;">${escapeHtml(f.analysis)}</p>
      ${actions}
    </article>`;
}

/**
 * @param {object} score
 * @param {boolean} [bitrixSendSo]
 */
export function renderScoreResults(score, bitrixSendSo = false) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  showScorePanel(root);

  const container = root.querySelector('#mr-view-score');
  if (!container) {
    return;
  }

  const approve = score.decision === 'APROVA';
  const criteria = Array.isArray(score.criteria) ? score.criteria : [];

  container.innerHTML = `
    ${exportToolbarHtml()}
    <div class="mobilinho-score-card">
      <div class="mobilinho-score-value mobilinho-score--${approve ? 'approve' : 'reject'}">
        ${approve ? '✓ APROVA' : '✗ REPROVA'}
      </div>
      <p style="font-size:2rem;font-weight:700;margin:8px 0;">${score.score ?? '—'}/100</p>
      <p style="color:var(--mr-muted);">${escapeHtml(score.summary ?? '')}</p>
    </div>
    ${score.blockers?.length ? `<div class="mobilinho-alert mobilinho-alert--error"><strong>Bloqueadores:</strong><ul>${score.blockers.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></div>` : ''}
    <div class="mobilinho-criteria">
      <h4>Critérios</h4>
      ${criteria.map((c) => `
        <div class="mobilinho-criteria-item">
          <span class="mobilinho-status-${c.status === 'ok' ? 'ok' : c.status === 'fail' ? 'fail' : 'warning'}">●</span>
          <div><strong>${escapeHtml(c.name)}</strong><br/>${escapeHtml(c.detail ?? '')}</div>
        </div>`).join('')}
    </div>
    ${score.recommendations?.length ? `<h4 style="margin-top:16px;">Recomendações</h4><ul style="font-size:0.875rem;color:var(--mr-muted);">${score.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
    ${scoreReviewActionsHtml(bitrixSendSo)}`;

  container.classList.remove('mobilinho-hidden');
  bindBitrixCheckbox(root);
}

/**
 * @param {Element} root
 */
function bindBitrixCheckbox(root) {
  const box = root.querySelector('#mr-bitrix-send-so');
  if (!(box instanceof HTMLInputElement)) {
    return;
  }
  box.addEventListener('change', () => {
    activeModalOptions?.onBitrixSendSoChange?.(box.checked);
  });
}

function scoreReviewActionsHtml(bitrixSendSo = false) {
  const bitrixChecked = bitrixSendSo ? 'checked' : '';
  return `<div class="mobilinho-score-review-actions">
    <p class="mobilinho-attach-hint">Preenche o formulário <strong>Finish your review</strong> do GitHub com o resumo dos achados (não envia automaticamente).</p>
    <div class="mobilinho-checkbox-row">
      <input type="checkbox" id="mr-bitrix-send-so" ${bitrixChecked} />
      <label for="mr-bitrix-send-so">Enviar no Grupo de SO (Bitrix)</label>
    </div>
    <p class="mobilinho-attach-hint">Abre o Bitrix, busca o grupo Portal web SO, responde na mensagem do mesmo PR (rola o histórico com limite) e envia nome do PR + status + link.</p>
    <div class="mobilinho-score-review-buttons">
      <button type="button" class="mobilinho-btn mobilinho-btn--primary" data-action="pr-approve">Aprovar PR</button>
      <button type="button" class="mobilinho-btn mobilinho-btn--danger" data-action="pr-request-changes">Solicitar alterações</button>
    </div>
  </div>`;
}

/**
 * @param {string} message
 */
export function showError(message) {
  const root = getOverlay();
  if (!root) {
    return;
  }
  hideLoading(root);
  const body = root.querySelector('#mr-body') ?? root.querySelector('.mobilinho-body');
  if (body) {
    const alert = document.createElement('div');
    alert.className = 'mobilinho-alert mobilinho-alert--error';
    alert.textContent = message;
    body.prepend(alert);
  }
}

function hideLoading(root) {
  root.querySelector('#mr-view-loading')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-home')?.classList.remove('mobilinho-hidden');
  setNotesPanelMode('review');
}

/**
 * @param {Element} root
 */
function showResultsPanel(root) {
  root.querySelector('#mr-view-loading')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-home')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-score')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-results')?.classList.remove('mobilinho-hidden');
  setNotesPanelMode('review');
}

/**
 * @param {Element} root
 */
function showScorePanel(root) {
  root.querySelector('#mr-view-loading')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-home')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-results')?.classList.add('mobilinho-hidden');
  root.querySelector('#mr-view-score')?.classList.remove('mobilinho-hidden');
  setNotesPanelMode('score');
}

function getOverlay() {
  return shadowRoot?.querySelector('.mobilinho-overlay') ?? null;
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
