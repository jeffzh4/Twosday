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
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(viewMode === v));
    btn.tabIndex = viewMode === v ? 0 : -1;
    btn.onclick = () => {
      viewMode = v;
      render();
    };
    btn.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const views = ['day','week','month','year'];
      const next = views[(views.indexOf(v) + (e.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length];
      viewMode = next;
      render();
      document.querySelector(`.view-btn[aria-selected="true"]`).focus();
    });
    c.appendChild(btn);
  });
}

function renderUserSwitcher() {
  const c = document.getElementById('user-switcher');
  c.innerHTML = '';
  // Index-based class (user-0 / user-1) so styling works for any profile names.
  const emojis = (currentAccount && currentAccount.profileEmojis) || [];
  const viewingProfiles = typeof getActivePresenceProfiles === 'function' ? getActivePresenceProfiles() : new Set();
  USERS.forEach((u, idx) => {
    const b = document.createElement('button');
    b.className = 'user-tab user-' + idx + (u === activeUser ? ' active' : '') + (viewingProfiles.has(u) ? ' viewing' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(u === activeUser));
    b.setAttribute('aria-label', `${u} calendar${viewingProfiles.has(u) ? ', viewing now' : ''}`);
    b.tabIndex = u === activeUser ? 0 : -1;
    const emoji = emojis[idx] ? `<span class="user-emoji">${escHtml(emojis[idx])}</span>` : '';
    const presence = viewingProfiles.has(u) ? '<span class="user-presence-dot" title="viewing now"></span>' : '';
    b.innerHTML = `<span class="user-dot"></span>${emoji}${escHtml(u)}${presence}`;
    b.onclick = () => {
      activeUser = u;
      applyTheme();
      render();
      if (notesOpen) renderNotes();
    };
    b.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const nextIndex = (idx + (e.key === 'ArrowRight' ? 1 : -1) + USERS.length) % USERS.length;
      activeUser = USERS[nextIndex];
      applyTheme();
      render();
      document.querySelector('.user-tab[aria-selected="true"]').focus();
    });
    c.appendChild(b);
  });
}

function renderUserPill() {
  const nameEl = document.getElementById('user-pill-name');
  if (nameEl && currentAccount) nameEl.textContent = currentAccount.username;
}

let _lastRenderedView = null;

function render() {
  document.getElementById('nav-label').textContent = getNavLabel();
  renderViewSwitch();
  renderUserSwitcher();
  if (typeof renderMobileNavigation === 'function') renderMobileNavigation();
  updateHistoryButtons();

  if      (viewMode === 'day' || viewMode === 'week') renderGrid();
  else if (viewMode === 'month') renderMonthView();
  else if (viewMode === 'year')  renderYearView();

  // Cross-fade the view container only when the view mode actually changes, so
  // ordinary edits/navigation don't re-animate the whole grid.
  if (_lastRenderedView !== viewMode) {
    const content = document.getElementById('main-content');
    if (content) { content.classList.remove('view-enter'); void content.offsetWidth; content.classList.add('view-enter'); }
    _lastRenderedView = viewMode;
  }

  if (typeof renderPresence === 'function') renderPresence();
  if (typeof queuePresenceUpdate === 'function') queuePresenceUpdate();
  if (typeof scheduleEventReminders === 'function') scheduleEventReminders();
  saveToLocalStorage();
  if (typeof refreshGoogleCalendarOverlay === 'function') refreshGoogleCalendarOverlay();
}

// ── Wiring ────────────────────────────────────────────────────────────────────
// One-time listener setup, kept apart from the boot sequence below: the wiring
// is order-insensitive, the boot sequence very much is not.
function wireAppShell() {
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

  document.getElementById('btn-find-time').onclick = () => openFindTimeModal();
  document.getElementById('btn-calendar-tools').onclick = () => openCalendarToolsModal();
  document.getElementById('btn-conflicts').onclick = () => openConflictsModal();

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

  document.getElementById('btn-settings').onclick = () => openSettingsModal();
  document.getElementById('btn-logout').onclick = logout;
  window.addEventListener('online', () => { setSyncStatus('synced'); saveToLocalStorage(); });
  window.addEventListener('offline', () => setSyncStatus('offline'));

  // renderGrid() only picks desktop-grid vs. mobile-agenda at the moment it
  // runs -- nothing re-ran it on its own, so a phone rotation or a resized
  // window crossing the mobile breakpoint left whichever layout was already
  // mounted (e.g. an invisible, CSS-hidden .grid-wrap) instead of swapping.
  let lastIsMobileViewport = typeof isMobileCalendarViewport === 'function' && isMobileCalendarViewport();
  let viewportRenderTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(viewportRenderTimer);
    viewportRenderTimer = setTimeout(() => {
      const nowMobile = typeof isMobileCalendarViewport === 'function' && isMobileCalendarViewport();
      if (nowMobile !== lastIsMobileViewport) {
        lastIsMobileViewport = nowMobile;
        render();
      }
    }, 150);
  });

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return; }
    if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoAction(); return; }
    if (meta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoAction(); return; }
    if (e.key === 'Escape') { const m = document.querySelector('.modal-bg'); if (m && !e.defaultPrevented) m.remove(); }
    const inInput = e.target.closest('input, textarea, select');
    if (!document.querySelector('.modal-bg') && !inInput) {
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'd') { viewMode = 'day';   render(); }
      if (e.key === 'w') { viewMode = 'week';  render(); }
      if (e.key === 'm') { viewMode = 'month'; render(); }
      if (e.key === 'y') { viewMode = 'year';  render(); }
      if (e.key === '/') { e.preventDefault(); toggleSearch(); }
      if (e.key === 'n') { e.preventDefault(); openModal({ dateKey: getDateKey(currentDate) }); }
    }
  });
}

// ── Boot: called by auth.js once an account is active ────────────────────────
function bootApp() {
  renderUserPill();
  if (typeof initPwa === 'function') initPwa();
  if (typeof initDiagnostics === 'function') initDiagnostics();
  wireAppShell();
  wireKeyboardShortcuts();

  loadFromLocalStorage();
  loadNotes();
  if (typeof applyTestingDemoSeed === 'function') applyTestingDemoSeed();

  // Mobile: default to day view (week view is too cramped on small screens)
  if (window.innerWidth <= 640 && viewMode === 'week') viewMode = 'day';

  applyTheme();
  applyDensity();
  setSyncStatus(navigator.onLine === false ? 'offline' : 'synced');
  render();

  // Firestore: initial fetch (prefer cloud if newer than local)
  const syncBar = document.getElementById('sync-bar');
  if (syncBar) syncBar.style.display = 'block';
  FIRESTORE_DOC.get().then(snap => {
    if (syncBar) syncBar.style.display = 'none';
    if (!snap.exists) return;
    const data = snap.data();
    if (isRemoteNewer(STORAGE_KEY, data.savedAt)) {
      _isLoadingFromFirestore = true;
      applyParsedData(data, false);
      applyTheme();
      _isLoadingFromFirestore = false;
      if (typeof applyTestingDemoSeed === 'function') applyTestingDemoSeed();
      render();
    } else if (typeof applyTestingDemoSeed === 'function' && applyTestingDemoSeed()) {
      render();
    }
  }).catch(e => {
    if (syncBar) syncBar.style.display = 'none';
    reportOperationalIssue('initial-firestore-load', e);
  });

  NOTES_DOC.get().then(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    if (data.notes && isRemoteNewer(NOTES_KEY, data.savedAt, '_savedAt')) {
      USERS.forEach(u => {
        if (Array.isArray(data.notes[u])) userNotes[u] = data.notes[u];
      });
      if (notesOpen) renderNotes();
    }
  }).catch(() => {});

  startFirestoreListener();
  startNotesListener();
  if (typeof startPresence === 'function') startPresence();
  if (typeof restoreGoogleCalendarOverlay === 'function') restoreGoogleCalendarOverlay();

  setInterval(positionNowLine, 30000);
  setInterval(() => { if (typeof renderPresence === 'function') renderPresence(); }, 30000);
  window.addEventListener('beforeunload', saveToLocalStorage);
}
