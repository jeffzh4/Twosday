let _idCounter = 0;
function uid() { return 'ev_' + Date.now() + '_' + (++_idCounter); }

// ── Authentication attempt backoff ──────────────────────────────────────────
// This protects normal browser retries. Firebase Auth and App Check remain the
// server-side controls; localStorage alone is not a bot boundary.
const AUTH_THROTTLE_KEY = 'twosday_auth_throttle_v1';
const AUTH_FAILURE_RESET_MS = 30 * 60 * 1000;
const AUTH_FAILURES_BEFORE_DELAY = 5;
const AUTH_BASE_DELAY_MS = 15 * 1000;
const AUTH_MAX_DELAY_MS = 15 * 60 * 1000;

function readAuthThrottle(storage = localStorage, now = Date.now()) {
  try {
    const parsed = JSON.parse(storage.getItem(AUTH_THROTTLE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return { failures: 0, blockedUntil: 0, lastFailureAt: 0 };
    if (!Number.isFinite(parsed.lastFailureAt) || now - parsed.lastFailureAt > AUTH_FAILURE_RESET_MS) {
      return { failures: 0, blockedUntil: 0, lastFailureAt: 0 };
    }
    return {
      failures: Math.max(0, Number(parsed.failures) || 0),
      blockedUntil: Math.max(0, Number(parsed.blockedUntil) || 0),
      lastFailureAt: parsed.lastFailureAt,
    };
  } catch (e) {
    return { failures: 0, blockedUntil: 0, lastFailureAt: 0 };
  }
}

function authRetryAfterMs(storage = localStorage, now = Date.now()) {
  return Math.max(0, readAuthThrottle(storage, now).blockedUntil - now);
}

function recordAuthFailure(storage = localStorage, now = Date.now()) {
  const previous = readAuthThrottle(storage, now);
  const failures = previous.failures + 1;
  const exponent = failures - AUTH_FAILURES_BEFORE_DELAY;
  const delay = exponent >= 0 ? Math.min(AUTH_BASE_DELAY_MS * (2 ** exponent), AUTH_MAX_DELAY_MS) : 0;
  const next = { failures, blockedUntil: now + delay, lastFailureAt: now };
  storage.setItem(AUTH_THROTTLE_KEY, JSON.stringify(next));
  return next;
}

function clearAuthFailures(storage = localStorage) {
  storage.removeItem(AUTH_THROTTLE_KEY);
}

function formatRetryDelay(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} minute${seconds >= 120 ? 's' : ''}` : `${seconds} seconds`;
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(msg, type = 'error') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  // Errors interrupt (assertive); successes wait their turn (polite). Without a
  // role the toast is silent to screen readers — a sync failure would go
  // entirely unannounced.
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4000);
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Hand a generated file to the browser's downloader. The object URL has to be
// revoked once the click is dispatched or the blob leaks for the page's life.
function downloadFile(filename, content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function onKeyboardActivate(el, callback) {
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    callback(e);
  });
}

function makeModalAccessible(bg, { titleSelector = 'h3', initialFocusSelector = null, onClose = null } = {}) {
  const dialog = bg.querySelector('.modal');
  if (!dialog) return;

  const previousFocus = document.activeElement;
  const title = dialog.querySelector(titleSelector);
  if (title) {
    if (!title.id) title.id = 'dialog-title-' + uid();
    dialog.setAttribute('aria-labelledby', title.id);
  } else {
    dialog.setAttribute('aria-label', 'Dialog');
  }
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;

  dialog.querySelectorAll('.field').forEach(field => {
    const label = field.querySelector('label');
    const control = field.querySelector('input, select, textarea');
    if (!label || !control) return;
    if (!control.id) control.id = 'field-' + uid();
    if (!label.htmlFor) label.htmlFor = control.id;
  });
  dialog.querySelectorAll('input, select, textarea').forEach(control => {
    if (control.labels && control.labels.length) return;
    if (control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) return;
    control.setAttribute('aria-label', control.placeholder || control.name || control.type || 'Input');
  });
  dialog.querySelectorAll('button').forEach(button => {
    if (button.hasAttribute('aria-label')) return;
    if (button.textContent.trim() === '×') button.setAttribute('aria-label', 'Close dialog');
  });
  dialog.querySelectorAll('.settings-msg, .conflict-warning, .find-time-summary, .conflict-center-summary')
    .forEach(node => {
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
    });

  const close = () => onClose ? onClose() : bg.remove();
  bg.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(bg.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) { e.preventDefault(); dialog.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  const observer = new MutationObserver(() => {
    if (bg.isConnected) return;
    observer.disconnect();
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus();
  });
  observer.observe(document.body, { childList: true });

  requestAnimationFrame(() => {
    const initial = initialFocusSelector && dialog.querySelector(initialFocusSelector);
    (initial || dialog).focus();
  });
}
function getTheme() { return document.documentElement.getAttribute('data-theme'); }
function getOtherUser(user) {
  // Returns the *other* profile in the current account (works for any name pair)
  const i = USERS.indexOf(user);
  return USERS[i === 0 ? 1 : 0];
}
// Clamps h to [START_H, END_H] with no rounding — drag callers snap independently.
function clampTime(h) { return Math.max(START_H, Math.min(END_H, h)); }
function overlaps(aS, aE, bS, bE) { return aS < bE && bS < aE; }

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getColor(name) {
  if (!name) return COLOR_PRESETS.find(c => c.name === 'gray')[getTheme()];
  // Custom hex color (saved from the palette picker)
  if (name.startsWith('#')) return { bg: hexToRgba(name, 0.18), text: name };
  const p = COLOR_PRESETS.find(c => c.name === name);
  // Fallback for legacy preset names (pink, cyan, purple) that were retired
  return p ? p[getTheme()] : COLOR_PRESETS.find(c => c.name === 'gray')[getTheme()];
}
function getSharedColor() { return SHARED_COLOR[getTheme()]; }

function categorize(text) {
  const l = text.toLowerCase();
  if (/math|phys|stat|ee|hw|chem|bio|lab|lecture|class|study/.test(l)) return 'class';
  if (/breakfast|lunch|dinner|meal|eat|cook|food/.test(l)) return 'meal';
  if (/akp|rush|haircut|party|hang|social|coffee|meet/.test(l)) return 'social';
  if (/boeing|resume|review|work|meeting|interview|office/.test(l)) return 'work';
  return 'other';
}

function palette(ev) {
  if (ev.color) return getColor(ev.color);          // explicit color always wins, even for shared events
  if (ev.shared) return getSharedColor();           // shared + no explicit color → shared indicator
  return getColor(categoryColors[categorize(ev.text)] || 'gray');
}

function fmtDuration(start, end) {
  const mins = Math.round((end - start) * 60);
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? h + 'h' : h + 'h ' + m + 'm';
}

function getDeviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; }
  catch (e) { return 'local'; }
}

function normalizeTimeZone(value) {
  if (typeof value !== 'string' || !value || value.length > 100) return getDeviceTimeZone();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format();
    return value;
  } catch (e) {
    return getDeviceTimeZone();
  }
}

function timeZoneSummary(timeZone) {
  const zone = normalizeTimeZone(timeZone);
  try {
    const label = new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(part => part.type === 'timeZoneName');
    return label ? `${zone} (${label.value})` : zone;
  } catch (e) {
    return zone;
  }
}

function fmtRelativeTime(ts) {
  if (!ts) return 'never';
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}

// ── Time input helpers (for <input type="time"> ↔ decimal hours) ──────────────
function decimalToTimeInput(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function timeInputToDecimal(str) {
  if (!str) return 0;
  const [hh, mm] = str.split(':').map(Number);
  return hh + mm / 60;
}

// Time formatting
function fmt(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const ap = hh >= 12 ? 'p' : 'a';
  const d = hh % 12 || 12;
  return mm === 0 ? d + ap : d + ':' + String(mm).padStart(2,'0') + ap;
}

function fmtFull(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  const ap = hh >= 12 ? ' pm' : ' am';
  const d = hh % 12 || 12;
  return d + ':' + String(mm).padStart(2,'0') + ap;
}

// Date key: "YYYY-MM-DD"
function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Returns the Sunday of the week containing `date`
function getSundayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay() 0=Sun, so this always lands on Sunday
  return d;
}

// 7 Date objects Sun–Sat for the week containing `date`
function getWeekDates(date) {
  const sun = getSundayOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return d;
  });
}

// Returns array of weeks (each week = 7 Date objects) covering a full month.
// Weeks start on Sunday; includes leading/trailing days from adjacent months.
function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = getSundayOfWeek(firstDay);
  const current = new Date(startDate);
  const weeks = [];
  while (current <= lastDay || weeks.length === 0) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
];
const MONTH_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const DAY_NAMES_LONG = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
