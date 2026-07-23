// Progressive web app wiring: service worker registration plus the install
// prompt. The button in the header stays hidden until the browser fires
// beforeinstallprompt, so it never shows in a context that cannot install
// (already installed, unsupported browser, or iOS Safari).

let deferredInstallPrompt = null;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// has no service worker scope, and registering there throws.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  };

  // bootApp runs after auth resolves, which is usually after window load has
  // already fired — waiting on the event alone would never register.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function setInstallButtonVisible(visible) {
  const btn = document.getElementById('btn-install');
  if (btn) btn.hidden = !visible;
}

function initInstallPrompt() {
  const btn = document.getElementById('btn-install');
  if (!btn) return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    setInstallButtonVisible(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallButtonVisible(false);
    if (typeof showToast === 'function') showToast('twosday installed', 'success');
  });

  btn.onclick = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    // The prompt is single-use; a dismissed prompt cannot be replayed until the
    // browser decides to fire beforeinstallprompt again.
    deferredInstallPrompt = null;
    if (outcome === 'accepted') setInstallButtonVisible(false);
  };
}

function initPwa() {
  registerServiceWorker();
  initInstallPrompt();
}
