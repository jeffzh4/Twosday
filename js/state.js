// ── Global app state ──────────────────────────────────────────────────────────
// allData[dateKey][user] = Event[]
//   e.g. allData["2026-05-16"]["jeff"] = [...]
// USERS / activeUser / userTheme are populated by auth.js after login.
const allData = {};

let activeUser = null;       // set by auth.js → activateAccount()
let viewMode = 'week';       // 'day' | 'week' | 'month' | 'year'
let currentDate = new Date();
let userTheme = {};          // { [profileName]: 'dark' | 'light' }
const appHistory = { undo: [], redo: [] };

// Set by drag logic
let dragState = null;

// ── Data helpers ──────────────────────────────────────────────────────────────
function getEventsForDate(dateKey, user) {
  return (allData[dateKey] && allData[dateKey][user]) ? allData[dateKey][user] : [];
}

function ensureDateUser(dateKey, user) {
  if (!allData[dateKey]) allData[dateKey] = {};
  if (!allData[dateKey][user]) allData[dateKey][user] = [];
}

function sortDateUser(dateKey, user) {
  ensureDateUser(dateKey, user);
  allData[dateKey][user].sort((a, b) => a.start - b.start);
}

function normalizeEvent(raw) {
  const start = clampTime(typeof raw.start === 'number' ? raw.start : 9);
  const endRaw = clampTime(typeof raw.end === 'number' ? raw.end : start + STEP_H);
  const end = endRaw > start ? endRaw : Math.min(END_H, start + STEP_H);
  return {
    id: raw.id || uid(),
    text: typeof raw.text === 'string' ? raw.text : 'event',
    start, end,
    done: !!raw.done,
    shared: !!raw.shared,
    sharedId: raw.sharedId || null,
    color: raw.color || null,
    recurrenceId: raw.recurrenceId || null,
  };
}

// ── History ───────────────────────────────────────────────────────────────────
function snapshotState() {
  return clone({
    allData,
    activeUser,
    viewMode,
    currentDate: currentDate.toISOString(),
    userTheme,
  });
}

function pushHistory() {
  appHistory.undo.push(snapshotState());
  if (appHistory.undo.length > 80) appHistory.undo.shift();
  appHistory.redo = [];
  updateHistoryButtons();
}

function restoreSnapshot(snap) {
  Object.keys(allData).forEach(k => delete allData[k]);
  Object.keys(snap.allData).forEach(dk => {
    allData[dk] = {};
    USERS.forEach(u => {
      allData[dk][u] = Array.isArray(snap.allData[dk][u]) ? clone(snap.allData[dk][u]) : [];
    });
  });
  activeUser = snap.activeUser;
  viewMode = snap.viewMode;
  currentDate = new Date(snap.currentDate);
  USERS.forEach(u => { if (snap.userTheme && snap.userTheme[u]) userTheme[u] = snap.userTheme[u]; });
  applyTheme();
  render();
}

function undoAction() {
  if (!appHistory.undo.length) return;
  const prev = appHistory.undo.pop();
  appHistory.redo.push(snapshotState());
  restoreSnapshot(prev);
  updateHistoryButtons();
}

function redoAction() {
  if (!appHistory.redo.length) return;
  const next = appHistory.redo.pop();
  appHistory.undo.push(snapshotState());
  restoreSnapshot(next);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = appHistory.undo.length === 0;
  if (r) r.disabled = appHistory.redo.length === 0;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme() {
  const t = userTheme[activeUser];
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.innerHTML = t === 'dark' ? '&#9790;' : '&#9788;';
}

// ── Persistence ───────────────────────────────────────────────────────────────
let _saveDebounce = null;
let _isLoadingFromFirestore = false;

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      allData: clone(allData),
      activeUser,
      viewMode,
      currentDate: currentDate.toISOString(),
      userTheme: clone(userTheme),
      savedAt: Date.now(),
    }));
  } catch (e) {}

  if (_isLoadingFromFirestore) return;
  clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(saveToFirestore, 400);
}

function saveToFirestore() {
  try {
    FIRESTORE_DOC.set({
      allData: clone(allData),
      userTheme: clone(userTheme),
      savedAt: Date.now(),
    }).catch(e => console.warn('Firestore save failed:', e));
  } catch (e) {}
}

function applyParsedData(parsed, applyViewState) {
  // New format: allData keyed by date string
  if (parsed.allData && typeof parsed.allData === 'object') {
    Object.keys(allData).forEach(k => delete allData[k]);
    Object.keys(parsed.allData).forEach(dk => {
      allData[dk] = {};
      USERS.forEach(u => {
        const src = parsed.allData[dk] && Array.isArray(parsed.allData[dk][u]) ? parsed.allData[dk][u] : [];
        allData[dk][u] = src.map(normalizeEvent);
        allData[dk][u].sort((a, b) => a.start - b.start);
      });
    });
  }

  // Legacy format: allWeeks keyed by "YYYY-Www"
  if (!parsed.allData && parsed.allWeeks) {
    migrateWeekFormat(parsed.allWeeks);
  }

  if (applyViewState) {
    if (parsed.activeUser && USERS.includes(parsed.activeUser)) activeUser = parsed.activeUser;
    if (['day','week','month','year'].includes(parsed.viewMode)) viewMode = parsed.viewMode;
    if (parsed.currentDate) {
      currentDate = new Date(parsed.currentDate);
    } else if (typeof parsed.weekOffset === 'number') {
      currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + parsed.weekOffset * 7);
    }
  }

  if (parsed.userTheme) {
    USERS.forEach(u => {
      if (parsed.userTheme[u]) userTheme[u] = parsed.userTheme[u];
    });
  }
}

function migrateWeekFormat(allWeeks) {
  Object.keys(allWeeks).forEach(weekKey => {
    const match = weekKey.match(/^(\d{4})-W(\d+)$/);
    if (!match) return;
    const year = parseInt(match[1]);
    const weekNum = parseInt(match[2]);
    // Find Monday of ISO week
    const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
    const jan4Day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4Day - 1) + (weekNum - 1) * 7);

    const weekData = allWeeks[weekKey];
    DAYS.forEach((dayName, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dk = getDateKey(date);
      USERS.forEach(u => ensureDateUser(dk, u));
      USERS.forEach(u => {
        const src = weekData[u] && Array.isArray(weekData[u][dayName]) ? weekData[u][dayName] : [];
        const existingIds = new Set(allData[dk][u].map(e => e.id));
        src.map(normalizeEvent).forEach(ev => {
          if (!existingIds.has(ev.id)) allData[dk][u].push(ev);
        });
        allData[dk][u].sort((a, b) => a.start - b.start);
      });
    });
  });
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') applyParsedData(parsed, true);
  } catch (e) {}
}

function startFirestoreListener() {
  FIRESTORE_DOC.onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    if (data.savedAt && Math.abs(Date.now() - data.savedAt) < 1500) return;
    _isLoadingFromFirestore = true;
    applyParsedData(data, false);
    applyTheme();
    render();
    _isLoadingFromFirestore = false;
  }, err => console.warn('Firestore listener error:', err));
}
