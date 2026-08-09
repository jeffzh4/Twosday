// Progressive web app wiring: service worker registration for the offline
// shell. The mobile More sheet surfaces the browser-provided install action
// when it is available; no custom install UI is shown otherwise.
let deferredInstallPrompt = null;

function canInstallTwosday() {
  return !!deferredInstallPrompt;
}

async function promptTwosdayInstall() {
  if (!deferredInstallPrompt) {
    showToast('install Twosday from your browser menu');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (typeof renderMobileNavigation === 'function') renderMobileNavigation();
}

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

function initPwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (typeof renderMobileNavigation === 'function') renderMobileNavigation();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('Twosday installed', 'info');
    if (typeof renderMobileNavigation === 'function') renderMobileNavigation();
  });
  registerServiceWorker();
}
