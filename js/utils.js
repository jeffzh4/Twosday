let _idCounter = 0;
function uid() { return 'ev_' + Date.now() + '_' + (++_idCounter); }

// ── Password hashing (Web Crypto API — SHA-256) ───────────────────────────────
async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Returns true if the string looks like a SHA-256 hex digest (64 hex chars).
function isHashed(str) {
  return typeof str === 'string' && /^[0-9a-f]{64}$/.test(str);
}

// Verify a plaintext input against either a stored hash or a legacy plaintext value.
async function verifyPassword(input, stored) {
  if (isHashed(stored)) return (await hashPassword(input)) === stored;
  return input === stored; // legacy plaintext fallback
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(msg, type = 'error') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
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
