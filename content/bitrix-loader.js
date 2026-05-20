(function mobilinhoBitrixLoader() {
  if (globalThis.__mobilinhoBitrixLoaded) {
    return;
  }

  const url = chrome.runtime.getURL('content/bitrix-messenger.js');
  import(url)
    .then(() => {
      globalThis.__mobilinhoBitrixLoaded = true;
    })
    .catch((err) => {
      console.error('[FelipeDosReview] Bitrix:', err);
    });
})();
