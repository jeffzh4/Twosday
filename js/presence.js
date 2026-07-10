// ── Realtime presence ────────────────────────────────────────────────────────
const PRESENCE_TTL_MS = 45000;
const PRESENCE_HEARTBEAT_MS = 15000;

let presenceSessions = {};
let localPresenceSessions = {};
let _presenceTimer = null;
let _presenceDebounce = null;
let _presenceUnsub = null;

function getPresenceSnapshot() {
  return {
    clientId: CLIENT_ID,
    profile: activeUser,
    viewMode,
    dateKey: getDateKey(currentDate),
    viewLabel: getNavLabel(),
    updatedAt: Date.now(),
  };
}

function publishPresence(force = false) {
  if (!currentAccount || !activeUser) return;
  if (document.visibilityState === 'hidden' && !force) return;

  const session = getPresenceSnapshot();
  saveLocalPresence(session);
  if (!PRESENCE_DOC) return;
  PRESENCE_DOC.update({
    ['sessions.' + CLIENT_ID]: session,
    accountId: currentAccount.username,
    ownerUid: currentAccount.ownerUid,
    savedAt: session.updatedAt,
  }).catch(() => {
    PRESENCE_DOC.set({
      sessions: { [CLIENT_ID]: session },
      accountId: currentAccount.username,
      ownerUid: currentAccount.ownerUid,
      savedAt: session.updatedAt,
    }, { merge: true }).catch(e => console.warn('Presence update failed:', e));
  });
}

function readLocalPresenceSessions() {
  if (!PRESENCE_KEY) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESENCE_KEY) || '{}');
    return parsed && typeof parsed.sessions === 'object' ? parsed.sessions : {};
  } catch (e) {
    return {};
  }
}

function saveLocalPresence(session) {
  if (!PRESENCE_KEY) return;
  const now = Date.now();
  const sessions = readLocalPresenceSessions();
  Object.keys(sessions).forEach(id => {
    if (!sessions[id] || now - (sessions[id].updatedAt || 0) > PRESENCE_TTL_MS) delete sessions[id];
  });
  sessions[CLIENT_ID] = session;
  localPresenceSessions = sessions;
  try {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify({ sessions, savedAt: now }));
  } catch (e) {}
}

function removeLocalPresence() {
  if (!PRESENCE_KEY) return;
  const sessions = readLocalPresenceSessions();
  delete sessions[CLIENT_ID];
  localPresenceSessions = sessions;
  try {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify({ sessions, savedAt: Date.now() }));
  } catch (e) {}
}

function queuePresenceUpdate() {
  clearTimeout(_presenceDebounce);
  _presenceDebounce = setTimeout(() => publishPresence(), 250);
}

function getActivePresenceSessions() {
  const now = Date.now();
  const merged = { ...localPresenceSessions, ...presenceSessions };
  return Object.values(merged)
    .filter(s => s && s.clientId !== CLIENT_ID && now - (s.updatedAt || 0) < PRESENCE_TTL_MS)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getActivePresenceProfiles() {
  return new Set(getActivePresenceSessions().map(s => s.profile).filter(Boolean));
}

function clearPresence() {
  removeLocalPresence();
  if (!PRESENCE_DOC) return;
  try {
    PRESENCE_DOC.update({
      ['sessions.' + CLIENT_ID]: firebase.firestore.FieldValue.delete(),
      accountId: currentAccount.username,
      ownerUid: currentAccount.ownerUid,
      savedAt: Date.now(),
    });
  } catch (e) {}
}

function renderPresence() {
  const el = document.getElementById('presence-strip');
  if (!el || !currentAccount) return;

  const active = getActivePresenceSessions();
  const latest = getLatestEventUpdate();
  const updateText = latest
    ? `last event update ${fmtRelativeTime(latest.updatedAt)} by ${escHtml(latest.updatedBy || latest.user)}`
    : 'no event updates yet';

  if (!active.length) {
    el.innerHTML = `
      <span class="presence-status">
        <span class="presence-dot offline"></span>
        no one else viewing
      </span>
      <span class="presence-divider"></span>
      <span class="presence-update">${updateText}</span>
    `;
    return;
  }

  const shown = active.slice(0, 3).map(s => `
    <span class="presence-viewer">
      <span class="presence-dot online"></span>
      <strong>${escHtml(s.profile || 'someone')}</strong>
      <span>viewing ${escHtml(s.viewMode || 'calendar')}</span>
      <em>${escHtml(s.viewLabel || s.dateKey || '')}</em>
    </span>
  `).join('');

  const extra = active.length > 3
    ? `<span class="presence-extra">+${active.length - 3} more</span>`
    : '';

  el.innerHTML = `
    <span class="presence-group">${shown}${extra}</span>
    <span class="presence-divider"></span>
    <span class="presence-update">${updateText}</span>
  `;
}

function startPresence() {
  if (_presenceUnsub) return;
  localPresenceSessions = readLocalPresenceSessions();

  if (PRESENCE_DOC) {
    _presenceUnsub = PRESENCE_DOC.onSnapshot(snap => {
      const data = snap.exists ? snap.data() : {};
      presenceSessions = data.sessions || {};
      renderPresence();
      renderUserSwitcher();
    }, err => console.warn('Presence listener error:', err));
  } else {
    _presenceUnsub = () => {};
  }

  publishPresence(true);
  clearInterval(_presenceTimer);
  _presenceTimer = setInterval(() => publishPresence(), PRESENCE_HEARTBEAT_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') publishPresence(true);
    renderPresence();
  });
  window.addEventListener('storage', e => {
    if (e.key !== PRESENCE_KEY) return;
    localPresenceSessions = readLocalPresenceSessions();
    renderPresence();
    renderUserSwitcher();
  });
  window.addEventListener('focus', () => publishPresence(true));
  window.addEventListener('beforeunload', clearPresence);
}
