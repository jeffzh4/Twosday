// ── Navigation label ──────────────────────────────────────────────────────────
function getNavLabel() {
  if (viewMode === 'year') {
    return String(currentDate.getFullYear());
  }
  if (viewMode === 'month') {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }
  if (viewMode === 'week') {
    const dates = getWeekDates(currentDate);
    const s = dates[0], e = dates[6];
    const sm = MONTH_SHORT[s.getMonth()];
    const em = MONTH_SHORT[e.getMonth()];
    if (s.getMonth() === e.getMonth()) {
      return `${sm} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${e.getFullYear()}`;
  }
  // Day view
  return `${DAY_NAMES_LONG[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
}

function navigate(dir) {
  const d = new Date(currentDate);
  if      (viewMode === 'day')   d.setDate(d.getDate() + dir);
  else if (viewMode === 'week')  d.setDate(d.getDate() + dir * 7);
  else if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
  else if (viewMode === 'year')  d.setFullYear(d.getFullYear() + dir);
  currentDate = d;
  render();
}

function gotoToday() {
  currentDate = new Date();
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderViewSwitch() {
  const c = document.getElementById('view-switch');
  c.innerHTML = '';
  ['day','week','month','year'].forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'view-btn' + (viewMode === v ? ' active' : '');
    btn.textContent = v;
    btn.onclick = () => {
      viewMode = v;
      render();
    };
    c.appendChild(btn);
  });
}

function renderUserSwitcher() {
  const c = document.getElementById('user-switcher');
  c.innerHTML = '';
  USERS.forEach(u => {
    const b = document.createElement('button');
    b.className = 'user-tab ' + u + (u === activeUser ? ' active' : '');
    b.innerHTML = `<span class="user-dot"></span>${u}`;
    b.onclick = () => {
      activeUser = u;
            applyTheme();
      render();
      if (notesOpen) renderNotes();
    };
    c.appendChild(b);
  });
}

function render() {
  document.getElementById('nav-label').textContent = getNavLabel();
  renderViewSwitch();
  renderUserSwitcher();
  updateHistoryButtons();

  if      (viewMode === 'day' || viewMode === 'week') renderGrid();
  else if (viewMode === 'month') renderMonthView();
  else if (viewMode === 'year')  renderYearView();

  saveToLocalStorage();
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('btn-prev').onclick  = () => navigate(-1);
document.getElementById('btn-next').onclick  = () => navigate(1);
document.getElementById('btn-today').onclick = gotoToday;

document.getElementById('btn-theme').onclick = () => {
  userTheme[activeUser] = userTheme[activeUser] === 'dark' ? 'light' : 'dark';
  applyTheme();
  render();
};

document.getElementById('btn-undo').onclick = undoAction;
document.getElementById('btn-redo').onclick = redoAction;

document.getElementById('btn-add').onclick = () => openModal({ dateKey: getDateKey(currentDate) });

document.getElementById('btn-search').onclick   = () => toggleSearch();
document.getElementById('search-close').onclick  = () => toggleSearch(false);
document.getElementById('search-input').addEventListener('input', function () {
  onSearchInput(this.value);
});
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Escape') toggleSearch(false);
});

document.getElementById('btn-notes').onclick  = () => toggleNotes();
document.getElementById('notes-close').onclick = () => toggleNotes(false);
document.getElementById('notes-send').onclick  = addNote;

document.getElementById('notes-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
});
document.getElementById('notes-input').addEventListener('input', function () {
  this.style.height = '34px';
  this.style.height = Math.min(this.scrollHeight, 80) + 'px';
});

document.addEventListener('mousemove', onDragMove);
document.addEventListener('mouseup', onDragEnd);

document.addEventListener('keydown', e => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoAction(); return; }
  if (meta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoAction(); return; }
  if (e.key === 'Escape') { const m = document.querySelector('.modal-bg'); if (m) m.remove(); }
  const inInput = e.target.closest('input, textarea, select');
  if (!document.querySelector('.modal-bg') && !inInput) {
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'd') { viewMode = 'day';   render(); }
    if (e.key === 'w') { viewMode = 'week';  render(); }
    if (e.key === 'm') { viewMode = 'month'; render(); }
    if (e.key === 'y') { viewMode = 'year';  render(); }
    if (e.key === '/') { e.preventDefault(); toggleSearch(); }
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadFromLocalStorage();
loadNotes();
applyTheme();
render();

// Firestore: initial fetch (prefer cloud if newer than local)
FIRESTORE_DOC.get().then(snap => {
  if (!snap.exists) return;
  const data = snap.data();
  const localRaw = localStorage.getItem(STORAGE_KEY);
  const localSaved = localRaw ? (JSON.parse(localRaw).savedAt || 0) : 0;
  if (data.savedAt && data.savedAt > localSaved) {
    _isLoadingFromFirestore = true;
    applyParsedData(data, false);
    applyTheme();
    render();
    _isLoadingFromFirestore = false;
  }
}).catch(e => console.warn('Initial Firestore load failed:', e));

db.collection('schedules').doc('shared-notes').get().then(snap => {
  if (!snap.exists) return;
  const data = snap.data();
  const localRaw = localStorage.getItem(NOTES_KEY);
  const localSaved = localRaw ? (JSON.parse(localRaw)._savedAt || 0) : 0;
  if (data.savedAt && data.savedAt > localSaved && data.notes) {
    if (Array.isArray(data.notes.jeff))  userNotes.jeff  = data.notes.jeff;
    if (Array.isArray(data.notes.helen)) userNotes.helen = data.notes.helen;
    if (notesOpen) renderNotes();
  }
}).catch(() => {});

startFirestoreListener();
startNotesListener();

setInterval(positionNowLine, 30000);
window.addEventListener('beforeunload', saveToLocalStorage);
