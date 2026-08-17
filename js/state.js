// ── Global app state ──────────────────────────────────────────────────────────
// allData[dateKey][user] = Event[]
//   e.g. allData["2026-05-16"]["alex"] = [...]
// USERS / activeUser / userTheme are populated by auth.js after login.
const allData = {};

let activeUser = null;       // set by auth.js → activateAccount()
let viewMode = 'week';       // 'day' | 'week' | 'month' | 'year'
let currentDate = new Date();
let userTheme = {};          // { [profileName]: 'dark' | 'light' }
let calendarDensity = {};    // { [profileName]: 'comfortable' | 'compact' }
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
    location: typeof raw.location === 'string' ? raw.location : null,
    description: typeof raw.description === 'string' ? raw.description : null,
    recurrenceId: raw.recurrenceId || null,
    recurrence: raw.recurrence && typeof raw.recurrence === 'object' ? raw.recurrence : null,
    // Existing events keep their local schedule. New metadata records source
    // IANA zone so a later travel/DST model never needs to guess provenance.
    timeZone: normalizeTimeZone(raw.timeZone),
    reminderMinutes: Number.isInteger(raw.reminderMinutes) && raw.reminderMinutes > 0 && raw.reminderMinutes <= 1440
      ? raw.reminderMinutes : 0,
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

function applyDensity() {
  // Compact mode previously changed label spacing without changing event
  // geometry. Keep stored legacy values readable, but render one stable scale.
  document.documentElement.setAttribute('data-density', 'comfortable');
}

function setSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.dataset.state = status;
  el.textContent = status === 'offline' ? 'offline' : status === 'pending' ? 'syncing' : status === 'error' ? 'sync issue' : 'synced';
  el.title = `Calendar sync: ${el.textContent}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────
let _isLoadingFromFirestore = false;
let calendarStore = null;

// Unique ID for this browser session — written into every Firestore save so the
// listener can tell "is this my own echo?" and skip it, while still applying
// saves that came from the other user's session.
const CLIENT_ID = uid();

// Signature of the syncable data, used to skip no-op Firestore writes — e.g. when
// the user is only navigating dates/views, which mutates no event data. Includes
// tombstones so a delete (which removes an event AND records a tombstone) always
// counts as a change worth syncing.
// Both sides of a merge — local and remote — are measured with this one format.
// If the two were assembled separately they could drift as fields are added,
// and a drifted comparison makes needsReconverge either permanently true (a
// write loop) or permanently false (a merge that never converges).
function calendarSignature(all, theme, density, tombs) {
  return JSON.stringify(all) + '|' + JSON.stringify(theme) + '|' + JSON.stringify(density) + '|' + JSON.stringify(tombs);
}

function _syncSig() {
  return calendarSignature(allData, userTheme, calendarDensity, tombstones);
}

// Is a remote document newer than what this browser last cached? The cached
// timestamp field differs per document (calendar writes `savedAt`, notes writes
// `_savedAt`), which is why the field name is a parameter rather than assumed.
function isRemoteNewer(storageKey, remoteSavedAt, savedAtField = 'savedAt') {
  if (!remoteSavedAt) return false;
  let localSaved = 0;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) localSaved = JSON.parse(raw)[savedAtField] || 0;
  } catch (e) {
    localSaved = 0;   // unreadable cache — treat the remote copy as newer
  }
  return remoteSavedAt > localSaved;
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
  if (parsed.calendarDensity) {
    USERS.forEach(u => {
      if (['comfortable', 'compact'].includes(parsed.calendarDensity[u])) calendarDensity[u] = parsed.calendarDensity[u];
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

// Merge a remote snapshot into local state and report what changed. Kept free of
// rendering and toasts so the reconciliation path — the part that decides whether
// the two calendars have actually converged — is reachable from a test.
function reconcileRemoteSnapshot(data) {
  const localSig = _syncSig();
  const remoteAll = normalizeAllData(data.allData, USERS);
  const merged = mergeCalendars(allData, remoteAll, tombstones, data.tombstones || {}, USERS);
  replaceAllData(merged.allData);
  tombstones = merged.tombstones;
  auditLog = mergeAuditLogs(auditLog, data.auditLog, AUDIT_CAP);
  if (data.userTheme) USERS.forEach(u => { if (data.userTheme[u]) userTheme[u] = data.userTheme[u]; });
  if (data.calendarDensity) USERS.forEach(u => { if (['comfortable', 'compact'].includes(data.calendarDensity[u])) calendarDensity[u] = data.calendarDensity[u]; });

  const signature = _syncSig();
  const remoteSig = calendarSignature(
    remoteAll,
    data.userTheme || userTheme,
    data.calendarDensity || calendarDensity,
    data.tombstones || {},
  );
  return { signature, changedLocally: signature !== localSig, needsReconverge: signature !== remoteSig };
}

function getCalendarStore() {
  if (calendarStore) return calendarStore;
  if (typeof createCalendarStore !== 'function') throw new Error('calendar store module is unavailable');

  const cache = createLocalStorageCalendarAdapter({
    storage: localStorage,
    getKey: () => STORAGE_KEY,
    buildPayload: () => ({
      allData, activeUser, viewMode, currentDate: currentDate.toISOString(),
      userTheme, calendarDensity, tombstones, auditLog, savedAt: Date.now(),
    }),
    applyPayload: parsed => applyParsedData(parsed, true),
  });

  const remote = createFirestoreCalendarAdapter({
    getDocument: () => FIRESTORE_DOC,
    clientId: CLIENT_ID,
    isLoading: () => _isLoadingFromFirestore,
    setLoading: value => { _isLoadingFromFirestore = value; },
    isOffline: () => navigator.onLine === false,
    signature: _syncSig,
    buildPayload: () => ({
      allData, userTheme, calendarDensity, tombstones, auditLog,
      accountId: currentAccount.username, ownerUid: currentAccount.ownerUid,
      savedAt: Date.now(), clientId: CLIENT_ID,
    }),
    setStatus: setSyncStatus,
    onWriteError: error => {
      reportOperationalIssue('firestore-save', error);
      setSyncStatus('error');
      showToast("couldn't sync — check your connection");
    },
    mergeSnapshot: data => {
      const result = reconcileRemoteSnapshot(data);
      applyTheme();
      applyDensity();
      render();
      if (result.changedLocally) showToast('merged changes from the other calendar', 'info');
      return { signature: result.signature, needsReconverge: result.needsReconverge };
    },
    applyFallbackSnapshot: (data, error) => {
      reportOperationalIssue('remote-merge', error);
      applyParsedData(data, false);
      applyTheme();
      applyDensity();
      render();
    },
    onListenerError: error => reportOperationalIssue('firestore-listener', error),
  });

  calendarStore = createCalendarStore({ cache, remote });
  return calendarStore;
}

function resetCalendarStore() {
  if (calendarStore) calendarStore.reset();
  calendarStore = null;
}

function loadFromLocalStorage() {
  return getCalendarStore().load();
}

function saveToLocalStorage() {
  return getCalendarStore().save();
}

function saveToFirestore() {
  return getCalendarStore().saveRemote();
}

function startFirestoreListener() {
  return getCalendarStore().listen();
}
