import { MESSAGE_TYPES, isPrChangesPage } from '../shared/constants.js';
import { buildModelSelectHtml } from '../shared/model-options.js';

const app = document.getElementById('app');

init();

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    const onPrPage = isPrChangesPage(url);

    const config = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CONFIG,
    });

    if (!onPrPage) {
      app.innerHTML = `
        <div class="alert alert--warn">
          Abra o PR na página <strong>/changes</strong> do GitHub (Files changed).
        </div>
        <p class="meta">${escapeHtml(url)}</p>`;
      return;
    }

    if (!config?.hasApiKey || !config?.model) {
      app.innerHTML = `
        <div class="alert alert--warn">Configure API Key e modelo.</div>
        <div class="field">
          <label>API Key</label>
          <input type="password" id="api-key" placeholder="sk-..." />
        </div>
        <div class="field">
          <label>Modelo</label>
          ${buildModelSelectHtml('model', undefined, 'model-select')}
        </div>
        <button class="btn btn--primary" id="save-btn">Salvar</button>`;

      document.getElementById('save-btn')?.addEventListener('click', async () => {
        const apiKey = document.getElementById('api-key')?.value;
        const model = /** @type {HTMLSelectElement} */ (
          document.getElementById('model')
        )?.value;
        await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.SAVE_CONFIG,
          apiKey,
          model,
        });
        init();
      });
      return;
    }

    app.innerHTML = `
      <div class="alert alert--ok">Pronto para revisar este PR.</div>
      <button class="btn btn--primary" id="open-btn">Abrir FelipeDosReview</button>
      <p class="meta">Modelo: ${escapeHtml(config.model)}</p>
      <p class="meta">Se não abrir, recarregue a página do PR (F5).</p>`;

    document.getElementById('open-btn')?.addEventListener('click', () => {
      openReviewer(tab);
    });
  } catch (err) {
    app.innerHTML = `<div class="alert alert--warn">${escapeHtml(err instanceof Error ? err.message : err)}</div>`;
  }
}

/**
 * @param {chrome.tabs.Tab|undefined} tab
 */
async function openReviewer(tab) {
  const btn = document.getElementById('open-btn');
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = 'Abrindo…';
  }

  try {
    if (!tab?.id) {
      throw new Error('Aba ativa não encontrada');
    }

    const result = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_MODAL,
      tabId: tab.id,
    });

    if (result?.ok === false) {
      throw new Error(result.error ?? 'Falha ao abrir');
    }

    window.close();
  } catch (err) {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = 'Abrir FelipeDosReview';
    }
    showInlineError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} message
 */
function showInlineError(message) {
  const existing = document.getElementById('open-error');
  if (existing) {
    existing.textContent = message;
    return;
  }
  const el = document.createElement('div');
  el.id = 'open-error';
  el.className = 'alert alert--warn';
  el.style.marginTop = '10px';
  el.textContent = message;
  app.appendChild(el);
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
