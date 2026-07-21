// ── Global app state ──────────────────────────────────────────────────────────
// allData[dateKey][user] = Event[]
//   e.g. allData["2026-05-16"]["jeff"] = [...]
// USERS / activeUser / userTheme are populated by auth.js after login.
const allData = {};

let activeUser = null;       // set by auth.js → activateAccount()
let viewMode = 'week';       // 'day' | 'week' | 'month' | 'year'
let currentDate = new Date();
let userTheme = {};          // { [profileName]: 'dark' | 'light' }
let tombstones = {};         // { [eventId]: deletedAt } — for CRDT delete merge
let auditLog = [];           // append-only change history (newest first)
const appHistory = { undo: [], redo: [] };

// Record a deletion so a concurrent remote merge can't resurrect the event.
function tombstone(id) {
  if (id) tombstones[id] = Date.now();
}

// Set by drag logic
let dragState = null;
let createDrag = null;  // drag-to-create state (set by day-week.js)

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
  // Cap start at END_H - STEP_H so there is always room for a positive-duration
  // end; otherwise a start of exactly END_H would yield a zero-duration event.
  const start = Math.min(clampTime(typeof raw.start === 'number' ? raw.start : 9), END_H - STEP_H);
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
    recurrence: raw.recurrence && typeof raw.recurrence === 'object' ? raw.recurrence : null,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  };
}

function markEventUpdated(ev, user = activeUser, ts = Date.now()) {
  if (!ev) return ev;
  ev.updatedAt = ts;
  ev.updatedBy = user;
  return ev;
}

function getLatestEventUpdate() {
  let latest = null;
  const seenShared = new Set();

  Object.keys(allData).forEach(dateKey => {
    USERS.forEach(user => {
      getEventsForDate(dateKey, user).forEach(ev => {
        if (!ev.updatedAt) return;
        if (ev.sharedId) {
          const key = ev.sharedId + ':' + ev.updatedAt;
          if (seenShared.has(key)) return;
          seenShared.add(key);
        }
        if (!latest || ev.updatedAt > latest.updatedAt) {
          latest = { dateKey, user, event: ev, updatedAt: ev.updatedAt, updatedBy: ev.updatedBy || user };
        }
      });
    });
  });

  return latest;
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
let _lastSyncedSig = null;   // signature of the data last sent to Firestore

// Unique ID for this browser session — written into every Firestore save so the
// listener can tell "is this my own echo?" and skip it, while still applying
// saves that came from the other user's session.
const CLIENT_ID = uid();

function saveToLocalStorage() {
  try {
    // No deep-clone needed: stringifying the live objects yields the same result
    // as cloning first, and skips a redundant serialize+parse pass every render.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      allData,
      activeUser,
      viewMode,
      currentDate: currentDate.toISOString(),
      userTheme,
      tombstones,
      auditLog,
      savedAt: Date.now(),
    }));
  } catch (e) {}

  if (_isLoadingFromFirestore) return;
  clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(saveToFirestore, 400);
}

// Signature of the syncable data, used to skip no-op Firestore writes — e.g. when
// the user is only navigating dates/views, which mutates no event data. Includes
// tombstones so a delete (which removes an event AND records a tombstone) always
// counts as a change worth syncing.
function _syncSig() {
  return JSON.stringify(allData) + '|' + JSON.stringify(userTheme) + '|' + JSON.stringify(tombstones);
}

function saveToFirestore() {
  const sig = _syncSig();
  if (sig === _lastSyncedSig) return;   // nothing changed since the last sync
  _lastSyncedSig = sig;
  try {
    FIRESTORE_DOC.set({
      allData,
      userTheme,
      tombstones,
      auditLog,
      accountId: currentAccount.username,
      ownerUid: currentAccount.ownerUid,
      savedAt: Date.now(),
      clientId: CLIENT_ID,
    }).catch(e => {
      _lastSyncedSig = null;            // allow the next render to retry the write
      console.warn('Firestore save failed:', e);
      showToast("couldn't sync — check your connection");
    });
  } catch (e) {
    _lastSyncedSig = null;
    showToast("couldn't sync — check your connection");
  }
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

  if (parsed.tombstones && typeof parsed.tombstones === 'object') tombstones = { ...parsed.tombstones };
  if (Array.isArray(parsed.auditLog)) auditLog = parsed.auditLog.slice(0, AUDIT_CAP);
}

// Normalize a raw remote allData object into the in-memory event shape, without
// touching the live `allData` — used by the reconciliation merge.
function normalizeAllData(rawAll, users) {
  const out = {};
  Object.keys(rawAll || {}).forEach(dk => {
    out[dk] = {};
    users.forEach(u => {
      const src = rawAll[dk] && Array.isArray(rawAll[dk][u]) ? rawAll[dk][u] : [];
      out[dk][u] = src.map(normalizeEvent);
    });
  });
  return out;
}

// Replace the contents of the live `allData` object in place (keeps the const
// binding) with a freshly-merged tree.
function replaceAllData(next) {
  Object.keys(allData).forEach(k => delete allData[k]);
  Object.keys(next).forEach(dk => { allData[dk] = next[dk]; });
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
    // Use the original Mon-first order — legacy data was keyed this way.
    const LEGACY_DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
    LEGACY_DAYS.forEach((dayName, i) => {
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
    if (data.clientId && data.clientId === CLIENT_ID) return; // own echo — skip

    _isLoadingFromFirestore = true;
    const localSig = _syncSig();
    try {
      // Per-event LWW + tombstone merge, so a concurrent edit from the other
      // profile is reconciled rather than clobbering our local changes.
      const remoteAll = normalizeAllData(data.allData, USERS);
      const merged = mergeCalendars(allData, remoteAll, tombstones, data.tombstones || {}, USERS);
      replaceAllData(merged.allData);
      tombstones = merged.tombstones;
      auditLog = mergeAuditLogs(auditLog, data.auditLog, AUDIT_CAP);
      if (data.userTheme) USERS.forEach(u => { if (data.userTheme[u]) userTheme[u] = data.userTheme[u]; });

      const mergedSig = _syncSig();
      applyTheme();
      render();
      _isLoadingFromFirestore = false;

      if (mergedSig !== localSig) {
        showToast('merged changes from the other calendar', 'info');
      }
      // Converge: if our merged result carries anything the remote document
      // lacked (e.g. our newer local edits), push it back so both sides settle
      // on the same state. The merge is idempotent, so this cannot loop.
      const remoteSig = JSON.stringify(remoteAll)
        + '|' + JSON.stringify(data.userTheme || userTheme)
        + '|' + JSON.stringify(data.tombstones || {});
      if (mergedSig !== remoteSig) {
        _lastSyncedSig = null;
        saveToFirestore();
      } else {
        _lastSyncedSig = mergedSig;
      }
    } catch (e) {
      // Never let a merge bug wedge sync — fall back to the previous behavior.
      console.warn('Merge failed, applying remote snapshot directly:', e);
      applyParsedData(data, false);
      _lastSyncedSig = _syncSig();
      applyTheme();
      render();
      _isLoadingFromFirestore = false;
    }
  }, err => console.warn('Firestore listener error:', err));
}
