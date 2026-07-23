// Progressive web app wiring: service worker registration for the offline
// shell. (The header install button was removed — browsers still surface
// their own install affordance in the address bar / share sheet, since the
// manifest and service worker remain in place.)

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
  registerServiceWorker();
}
