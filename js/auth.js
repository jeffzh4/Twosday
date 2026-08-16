// Account authentication and owner-scoped Firestore access.
//
// New account metadata lives at accounts/{username}. Each record carries the
// Firebase Auth UID that owns it, and every calendar/notes/presence document is
// stamped with that same UID. Firebase Authentication is the only password
// authority; calendar metadata never stores password material.

const ACCOUNTS_CACHE_KEY = 'twosday_accounts_v1';
const SESSION_KEY = 'twosday_session_v1';
const AUTH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const AUTH_ACTIVITY_WRITE_MS = 15 * 1000;
const AUTH_EXPIRED_NOTICE_KEY = 'twosday_auth_expired_notice_v1';
const ACCOUNT_COLLECTION = () => db.collection('accounts');
const ACCOUNT_DOC = username => ACCOUNT_COLLECTION().doc(username);
let currentAccount = null;
let authRequestActive = false;
let idleSessionTimer = null;
let idleSessionListening = false;
let lastSessionActivityWrite = 0;

function syntheticEmail(username) {
  return `${username.toLowerCase()}@twosday.local`;
}

function withoutLegacyPassword(account) {
  const { password, ...safeAccount } = account || {};
  return safeAccount;
}

async function claimFirebaseAuth(username, password) {
  const email = syntheticEmail(username);
  const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
  return { ownerUid: cred.user.uid, authUid: cred.user.uid, authEmail: email };
}

function firebaseAuthSignIn(authEmail, password) {
  return firebase.auth().signInWithEmailAndPassword(authEmail, password);
}

function waitForFirebaseAuth() {
  return new Promise(resolve => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    }, () => resolve(null));
  });
}

function getCachedAccounts() {
  try {
    const cached = JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || '{}');
    const safe = Object.fromEntries(Object.entries(cached).map(([username, account]) => [username, withoutLegacyPassword(account)]));
    localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(safe));
    return safe;
  }
  catch (e) { return {}; }
}

function cacheAccount(username, account) {
  const cached = getCachedAccounts();
  cached[username] = account;
  localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(cached));
}

function removeCachedAccount(username) {
  const cached = getCachedAccounts();
  delete cached[username];
  localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(cached));
}

async function loadAccountRecord(username, allowCache = true) {
  try {
    const snap = await ACCOUNT_DOC(username).get();
    if (snap.exists) {
      const storedAccount = snap.data();
      const account = withoutLegacyPassword(storedAccount);
      if (storedAccount.password && firebase.auth().currentUser && firebase.auth().currentUser.uid === account.ownerUid) {
        await saveAccountRecord(username, account);
      }
      cacheAccount(username, account);
      return account;
    }
  } catch (e) {
    reportOperationalIssue('account-metadata-load', e);
  }
  return allowCache ? (getCachedAccounts()[username] || null) : null;
}

async function saveAccountRecord(username, account) {
  const ownerUid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
  if (!ownerUid || account.ownerUid !== ownerUid) throw new Error('account ownership could not be verified');
  const persisted = { ...withoutLegacyPassword(account), updatedAt: Date.now() };
  await ACCOUNT_DOC(username).set(persisted);
  cacheAccount(username, persisted);
}

async function findAccountForAuthUser(user) {
  const snap = await ACCOUNT_COLLECTION().where('ownerUid', '==', user.uid).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    const storedAccount = doc.data();
    const account = withoutLegacyPassword(storedAccount);
    if (storedAccount.password) await saveAccountRecord(doc.id, account);
    cacheAccount(doc.id, account);
    return { username: doc.id, account };
  }

  return null;
}

function activateAccount(username, account) {
  if (typeof resetCalendarStore === 'function') resetCalendarStore();
  currentAccount = { username, ...account };

  USERS = account.profiles.slice();
  STORAGE_KEY = `twosday_v2_${username}`;
  NOTES_KEY = `twosday_notes_v2_${username}`;
  PRESENCE_KEY = `twosday_presence_v1_${username}`;
  CUSTOM_COLORS_KEY = `twosday_colors_v1_${username}`;
  FIRESTORE_DOC = db.collection('schedules').doc(account.firestoreDoc);
  NOTES_DOC = db.collection('schedules').doc(account.notesDoc);
  PRESENCE_DOC = db.collection('schedules').doc(account.firestoreDoc + '-presence');

  activeUser = USERS[0];
  userTheme = {};
  USERS.forEach((u, i) => { userTheme[u] = i === 0 ? 'dark' : 'light'; });
  userNotes = {};
  USERS.forEach(u => { userNotes[u] = []; });
  tombstones = {};
  auditLog = [];
}

async function claimDataDocument(ref, emptyField) {
  const ownership = { accountId: currentAccount.username, ownerUid: currentAccount.ownerUid };
  try {
    await ref.update(ownership);
  } catch (e) {
    await ref.set({ ...ownership, [emptyField]: {} }, { merge: true });
  }
}

async function prepareAccount(username, account) {
  const user = firebase.auth().currentUser;
  if (!user || account.ownerUid !== user.uid) throw new Error('signed-in user does not own this account');
  activateAccount(username, account);
  await Promise.all([
    claimDataDocument(FIRESTORE_DOC, 'allData'),
    claimDataDocument(NOTES_DOC, 'notes'),
    claimDataDocument(PRESENCE_DOC, 'sessions'),
  ]);
  // Must run before startIdleSessionGuard: the guard treats a missing session
  // as already-expired, and would otherwise sign this fresh login back out.
  saveSession(username);
  startIdleSessionGuard();
}

async function handleGoogleSignIn(formId = 'login') {
  if (!beginAuthRequest(formId)) return;
  setError(formId, 'connecting to Google...');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const found = await findAccountForAuthUser(result.user);
    if (!found) {
      await firebase.auth().signOut();
      finishAuthRequest(false);
      setError(formId, 'no Twosday account is linked to this Google account yet - log in with your username and password, then connect Google in settings.');
      return;
    }

    await prepareAccount(found.username, found.account);
    finishAuthRequest(true);
    setError(formId, '');
    hideAuth();
    bootApp();
  } catch (err) {
    reportOperationalIssue('google-sign-in', err);
    if (err.code === 'auth/popup-closed-by-user') { finishAuthRequest(false, false); setError(formId, ''); return; }
    finishAuthRequest(false);
    setError(formId, 'Google sign-in failed. Please try again.');
  }
}

function saveSession(username) {
  const now = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, savedAt: now, lastActiveAt: now }));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch (e) { return null; }
}

function stopIdleSessionGuard() {
  if (idleSessionTimer) clearTimeout(idleSessionTimer);
  idleSessionTimer = null;
}

function sessionIsIdleExpired(session, now = Date.now()) {
  const lastActiveAt = Number(session && (session.lastActiveAt || session.savedAt));
  return !Number.isFinite(lastActiveAt) || now - lastActiveAt >= AUTH_IDLE_TIMEOUT_MS;
}

function scheduleIdleSessionExpiry() {
  stopIdleSessionGuard();
  const session = getSession();
  if (!session || sessionIsIdleExpired(session)) return expireIdleSession();
  const lastActiveAt = Number(session.lastActiveAt || session.savedAt);
  idleSessionTimer = setTimeout(expireIdleSession, Math.max(0, AUTH_IDLE_TIMEOUT_MS - (Date.now() - lastActiveAt)) + 50);
}

function noteSessionActivity() {
  const session = getSession();
  if (!session || !currentAccount) return;
  const now = Date.now();
  if (now - lastSessionActivityWrite < AUTH_ACTIVITY_WRITE_MS) return;
  lastSessionActivityWrite = now;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActiveAt: now }));
  scheduleIdleSessionExpiry();
}

function expireIdleSession() {
  stopIdleSessionGuard();
  localStorage.removeItem(SESSION_KEY);
  try { sessionStorage.setItem(AUTH_EXPIRED_NOTICE_KEY, '1'); } catch (e) {}
  Promise.resolve(firebase.auth().signOut()).finally(() => location.reload());
}

function startIdleSessionGuard() {
  if (!idleSessionListening) {
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach(type => document.addEventListener(type, noteSessionActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const session = getSession();
      if (sessionIsIdleExpired(session)) expireIdleSession();
      else noteSessionActivity();
    });
    idleSessionListening = true;
  }
  noteSessionActivity();
  scheduleIdleSessionExpiry();
}

function logout() {
  stopIdleSessionGuard();
  localStorage.removeItem(SESSION_KEY);
  try { firebase.auth().signOut(); } catch (e) {}
  location.reload();
}

function showAuth() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.querySelector('.app').style.display = 'none';
  requestAnimationFrame(() => document.getElementById('login-username').focus());
}

function hideAuth() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.querySelector('.app').style.display = '';
}

function setError(formId, msg) {
  document.getElementById(formId + '-error').textContent = msg || '';
}

function beginAuthRequest(formId) {
  if (authRequestActive) return false;
  const wait = authRetryAfterMs();
  if (wait) {
    setError(formId, `too many attempts — try again in ${formatRetryDelay(wait)}`);
    return false;
  }
  authRequestActive = true;
  return true;
}

async function requireSignupAttestation() {
  if (!TWOSDAY_PRODUCTION_HOSTS.has(location.hostname)) return;
  if (!firebase.appCheck) throw new Error('signup protection is unavailable');
  const result = await firebase.appCheck().getToken(false);
  if (!result || !result.token) throw new Error('signup protection could not verify this browser');
}

function finishAuthRequest(succeeded, countFailure = true) {
  authRequestActive = false;
  if (succeeded) clearAuthFailures();
  else if (countFailure) recordAuthFailure();
}

function selectAuthTab(which) {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    const selected = tab.dataset.tab === which;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  ['login', 'signup'].forEach(name => {
    const form = document.getElementById(name + '-form');
    const hidden = name !== which;
    form.classList.toggle('hidden', hidden);
    form.hidden = hidden;
  });
  setError('login', '');
  setError('signup', '');
}

function setupAuthListeners() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => selectAuthTab(tab.dataset.tab);
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const next = tab.dataset.tab === 'login' ? 'signup' : 'login';
      selectAuthTab(next);
      document.querySelector(`.auth-tab[data-tab="${next}"]`).focus();
    });
  });

  document.getElementById('btn-google-signin').onclick = () => handleGoogleSignIn('login');
  document.getElementById('btn-google-signup').onclick = () => handleGoogleSignIn('signup');

  document.getElementById('login-form').onsubmit = async e => {
    e.preventDefault();
    if (!e.isTrusted) return;
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { setError('login', 'username and password required'); return; }
    if (!beginAuthRequest('login')) return;

    setError('login', 'checking...');
    try {
      const cred = await firebaseAuthSignIn(syntheticEmail(username), password);
      const account = await loadAccountRecord(username, false);
      if (!account || account.ownerUid !== cred.user.uid) throw new Error('account ownership could not be verified');
      await prepareAccount(username, account);
      finishAuthRequest(true);
      setError('login', '');
      hideAuth();
      bootApp();
    } catch (authError) {
      await firebase.auth().signOut();
      finishAuthRequest(false);
      setError('login', 'invalid username or password');
    }
  };

  document.getElementById('signup-form').onsubmit = async e => {
    e.preventDefault();
    if (!e.isTrusted) return;
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const profile1 = document.getElementById('signup-profile1').value.trim().toLowerCase();
    const profile2 = document.getElementById('signup-profile2').value.trim().toLowerCase();

    if (!username || !password || !profile1 || !profile2) { setError('signup', 'all fields are required'); return; }
    if (password !== passwordConfirm) { setError('signup', 'passwords do not match'); return; }
    if (password.length < 6) { setError('signup', 'password must be at least 6 characters'); return; }
    if (profile1 === profile2) { setError('signup', 'profile names must differ'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) { setError('signup', 'username can only contain letters, numbers, _ and -'); return; }
    if (!/^[a-zA-Z0-9]+$/.test(profile1) || !/^[a-zA-Z0-9]+$/.test(profile2)) { setError('signup', 'profile names: letters and numbers only'); return; }
    if (profile1.length > 15 || profile2.length > 15) { setError('signup', 'profile names must be 15 characters or less'); return; }
    if (!beginAuthRequest('signup')) return;

    setError('signup', 'creating secure account...');
    let authUser = null;
    try {
      await requireSignupAttestation();
      const claim = await claimFirebaseAuth(username, password);
      authUser = firebase.auth().currentUser;
      const account = {
        profiles: [profile1, profile2],
        firestoreDoc: username,
        notesDoc: username + '-notes',
        createdAt: Date.now(),
        authClaimed: true,
        authUid: claim.authUid,
        authEmail: claim.authEmail,
        ownerUid: claim.ownerUid,
      };
      await saveAccountRecord(username, account);
      await prepareAccount(username, account);
      finishAuthRequest(true);
      setError('signup', '');
      hideAuth();
      bootApp();
    } catch (err) {
      reportOperationalIssue('signup', err);
      if (authUser) authUser.delete().catch(() => {});
      finishAuthRequest(false);
      setError('signup', err.code === 'auth/email-already-in-use' ? 'that username is taken' : 'failed to create account. Please try again.');
    }
  };
}

window.addEventListener('DOMContentLoaded', async () => {
  setupAuthListeners();
  selectAuthTab('login');

  const session = getSession();
  const authUser = await waitForFirebaseAuth();
  if (session && session.username && authUser) {
    if (sessionIsIdleExpired(session)) {
      await firebase.auth().signOut();
      localStorage.removeItem(SESSION_KEY);
      showAuth();
      setError('login', 'signed out after 30 minutes of inactivity');
      return;
    }
    try {
      const account = await loadAccountRecord(session.username, true);
      if (account && account.ownerUid === authUser.uid) {
        await prepareAccount(session.username, account);
        hideAuth();
        bootApp();
        return;
      }
    } catch (e) {
      reportOperationalIssue('session-restore', e);
    }
    localStorage.removeItem(SESSION_KEY);
  }

  showAuth();
  try {
    if (sessionStorage.getItem(AUTH_EXPIRED_NOTICE_KEY)) {
      sessionStorage.removeItem(AUTH_EXPIRED_NOTICE_KEY);
      setError('login', 'signed out after 30 minutes of inactivity');
    }
  } catch (e) {}
});
