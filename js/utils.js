let _idCounter = 0;
function uid() { return 'ev_' + Date.now() + '_' + (++_idCounter); }

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
function clampTime(h) { return Math.max(START_H, Math.min(END_H, Math.round(h * 2) / 2)); }
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

function timeOpts(sel) {
  let o = '';
  for (let h = START_H; h <= END_H; h++) {
    for (let m = 0; m < 60; m += 30) {
      const v = h + m / 60;
      if (v > END_H) break;
      o += `<option value="${v}"${Math.abs(v - sel) < 0.01 ? ' selected' : ''}>${fmtFull(v)}</option>`;
    }
  }
  return o;
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

// 0=Sun … 6=Sat  (matches DAYS array order)
function getDayIdx(date) {
  return date.getDay();
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
