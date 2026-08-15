// Browser-only operational breadcrumbs. Entries intentionally exclude event
// text, account identifiers, URLs with query strings, stack traces, tokens,
// and provider-supplied error messages.
const DIAGNOSTIC_CAP = 20;
const DIAGNOSTIC_KEY = 'twosday_diagnostics_v1';
let diagnosticsInitialized = false;

function diagnosticMessage(error) {
  // Provider messages may echo request context. Keep a stable, content-free
  // category instead of preserving raw text in browser storage or copied logs.
  return error && error.name === 'TypeError' ? 'browser TypeError' : 'operation failed';
}

function sanitizeDiagnosticEntry(entry) {
  return {
    at: typeof entry?.at === 'string' ? entry.at.slice(0, 40) : new Date().toISOString(),
    scope: String(entry?.scope || 'browser').replace(/[^a-z0-9-]/gi, '').slice(0, 48) || 'browser',
    message: diagnosticMessage(entry),
    release: String(entry?.release || TWOSDAY_RELEASE).replace(/[^0-9.]/g, '').slice(0, 24) || TWOSDAY_RELEASE,
    path: typeof entry?.path === 'string' && entry.path.startsWith('/') ? entry.path.split('?')[0].slice(0, 160) : '/',
  };
}

function getDiagnostics() {
  try {
    const entries = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY) || '[]');
    return Array.isArray(entries) ? entries.slice(0, DIAGNOSTIC_CAP).map(sanitizeDiagnosticEntry) : [];
  } catch (e) {
    return [];
  }
}

function reportOperationalIssue(scope, error) {
  recordDiagnostic(scope, error);
  console.warn(`Twosday: ${String(scope || 'operation').replace(/[^a-z0-9-]/gi, '').slice(0, 48) || 'operation'} failed.`);
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
