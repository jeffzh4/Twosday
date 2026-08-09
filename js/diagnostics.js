// Browser-only operational breadcrumbs. Entries intentionally exclude event
// text, account identifiers, URLs with query strings, and stack traces.
const DIAGNOSTIC_CAP = 20;
const DIAGNOSTIC_KEY = 'twosday_diagnostics_v1';
let diagnosticsInitialized = false;

function diagnosticMessage(error) {
  const raw = typeof error === 'string' ? error : (error && error.message) || 'unknown browser error';
  return String(raw).replace(/[\r\n]+/g, ' ').slice(0, 180);
}

function getDiagnostics() {
  try {
    const entries = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY) || '[]');
    return Array.isArray(entries) ? entries.slice(0, DIAGNOSTIC_CAP) : [];
  } catch (e) {
    return [];
  }
}

function recordDiagnostic(scope, error) {
  try {
    const entries = getDiagnostics();
    entries.unshift({
      at: new Date().toISOString(),
      scope: String(scope || 'browser').slice(0, 48),
      message: diagnosticMessage(error),
      release: TWOSDAY_RELEASE,
      path: location.pathname,
    });
    localStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(entries.slice(0, DIAGNOSTIC_CAP)));
  } catch (e) {}
}

function diagnosticReport() {
  return JSON.stringify({
    product: 'Twosday',
    release: TWOSDAY_RELEASE,
    generatedAt: new Date().toISOString(),
    online: navigator.onLine !== false,
    entries: getDiagnostics(),
  }, null, 2);
}

async function copyDiagnostics() {
  const report = diagnosticReport();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(report);
    else throw new Error('clipboard unavailable');
    showToast('diagnostics copied', 'info');
  } catch (error) {
    recordDiagnostic('copy-diagnostics', error);
    showToast('could not copy diagnostics');
  }
}

function initDiagnostics() {
  if (diagnosticsInitialized) return;
  diagnosticsInitialized = true;
  window.addEventListener('error', event => recordDiagnostic('runtime', event.error || event.message));
  window.addEventListener('unhandledrejection', event => recordDiagnostic('unhandled-rejection', event.reason));
}
