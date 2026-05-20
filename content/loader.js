/**
 * Loader clássico (sem type=module no manifest) — importa o bundle modular com segurança.
 * Evita "Receiving end does not exist" quando o content script não foi injetado.
 */
(function mobilinhoLoader() {
  if (globalThis.__mobilinhoReviewerLoaded) {
    return;
  }

  const url = chrome.runtime.getURL('content/content.js');
  import(url)
    .then(() => {
      globalThis.__mobilinhoReviewerLoaded = true;
    })
    .catch((err) => {
      console.error('[FelipeDosReview] Falha ao carregar:', err);
    });
})();
