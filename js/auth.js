// ── Auth module ───────────────────────────────────────────────────────────────
// Two built-in accounts + Firestore-backed signups.
//
// NOTE: Passwords are stored in plaintext. This is intentional for a small
// trusted-circle app with shared accounts. For real security, swap to Firebase
// Auth with hashed passwords.

const ACCOUNTS_CACHE_KEY = 'twosday_accounts_v1';
const SESSION_KEY        = 'twosday_session_v1';
const ACCOUNTS_DOC       = () => db.collection('schedules').doc('accounts');

// Built-in accounts always available, regardless of Firestore state.
// JHadmin points at the legacy 'shared-schedule' doc so the existing data is
// preserved for the original user.
const BUILTIN_ACCOUNTS = {
  JHadmin: {
    password: 'admin',
    profiles: ['jeff', 'helen'],
    firestoreDoc: 'shared-schedule',
    notesDoc: 'shared-notes',
    builtin: true,
  },
  testing: {
    password: 'testing',
    profiles: ['tester1', 'tester2'],
    firestoreDoc: 'testing',
    notesDoc: 'testing-notes',
    builtin: true,
  },
};

let currentAccount = null;          // { username, profiles, firestoreDoc, notesDoc }
let _accountsCache = null;          // merged map { username → accountData }

function getCachedAccounts() {
  // Built-ins always first; Firestore-loaded custom accounts overlay on top
  // (custom accounts cannot reuse a built-in username — guarded in signup).
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || '{}'); } catch (e) {}
  return { ...BUILTIN_ACCOUNTS, ...custom };
}

// Refresh the cache from Firestore (with localStorage fallback).
async function refreshAccountsFromFirestore() {
  try {
    const snap = await ACCOUNTS_DOC().get();
    if (snap.exists && snap.data() && snap.data().accounts) {
      const custom = snap.data().accounts;
      localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(custom));
      _accountsCache = { ...BUILTIN_ACCOUNTS, ...custom };
      return _accountsCache;
    }
  } catch (e) {
    console.warn('Failed to refresh accounts from Firestore:', e);
  }
  _accountsCache = getCachedAccounts();
  return _accountsCache;
}

// Configure all the per-account globals that other modules read.
function activateAccount(username, account) {
  currentAccount = { username, ...account };

  // USERS is declared with `let` in config.js so we can reassign it.
  USERS = account.profiles.slice();
  STORAGE_KEY    = `twosday_v2_${username}`;
  NOTES_KEY      = `twosday_notes_v2_${username}`;
  FIRESTORE_DOC  = db.collection('schedules').doc(account.firestoreDoc);
  NOTES_DOC      = db.collection('schedules').doc(account.notesDoc);

  // Reset per-profile state objects (defaults if no saved data).
  activeUser = USERS[0];
  userTheme = {};
  USERS.forEach((u, i) => { userTheme[u] = i === 0 ? 'dark' : 'light'; });
  userNotes = {};
  USERS.forEach(u => { userNotes[u] = []; });
}

function saveSession(username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, savedAt: Date.now() }));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch (e) { return null; }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

// ── Auth UI ───────────────────────────────────────────────────────────────────
function showAuth() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.querySelector('.app').style.display = 'none';
}

function hideAuth() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.querySelector('.app').style.display = '';
}

function setError(formId, msg) {
  document.getElementById(formId + '-error').textContent = msg || '';
}

function setupAuthListeners() {
  // Tab switching between log-in and sign-up
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
      document.getElementById('signup-form').classList.toggle('hidden', which !== 'signup');
      setError('login', '');
      setError('signup', '');
    };
  });

  // ── Login ────────────────────────────────────────────────────────────────────
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { setError('login', 'username and password required'); return; }

    // Use the cache, but try a refresh first for accuracy across devices.
    setError('login', 'checking…');
    const accounts = await refreshAccountsFromFirestore();
    const account = accounts[username];
    if (!account || account.password !== password) {
      setError('login', 'invalid username or password');
      return;
    }
    activateAccount(username, account);
    saveSession(username);
    setError('login', '');
    hideAuth();
    bootApp();
  };

  // ── Signup ───────────────────────────────────────────────────────────────────
  document.getElementById('signup-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    const profile1 = document.getElementById('signup-profile1').value.trim().toLowerCase();
    const profile2 = document.getElementById('signup-profile2').value.trim().toLowerCase();

    if (!username || !password || !profile1 || !profile2) {
      setError('signup', 'all fields are required'); return;
    }
    if (password !== passwordConfirm) {
      setError('signup', 'passwords do not match'); return;
    }
    if (profile1 === profile2) {
      setError('signup', 'profile names must differ'); return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('signup', 'username can only contain letters, numbers, _ and -'); return;
    }

    setError('signup', 'creating account…');
    const accounts = await refreshAccountsFromFirestore();
    if (accounts[username]) {
      setError('signup', 'that username is taken');
      return;
    }

    const newAccount = {
      password,
      profiles: [profile1, profile2],
      firestoreDoc: username,
      notesDoc: username + '-notes',
      createdAt: Date.now(),
    };

    // Merge with existing custom accounts and write back to Firestore.
    let custom = {};
    try { custom = JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || '{}'); } catch (err) {}
    custom[username] = newAccount;

    try {
      await ACCOUNTS_DOC().set({ accounts: custom, savedAt: Date.now() });
    } catch (err) {
      setError('signup', 'failed to save: ' + err.message);
      return;
    }
    localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(custom));

    activateAccount(username, newAccount);
    saveSession(username);
    setError('signup', '');
    hideAuth();
    bootApp();
  };
}

// ── Initial boot path ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  setupAuthListeners();

  const session = getSession();
  if (session && session.username) {
    // Quick path: try cached accounts first so we can show the calendar fast,
    // then refresh from Firestore in the background.
    const accounts = getCachedAccounts();
    if (accounts[session.username]) {
      activateAccount(session.username, accounts[session.username]);
      hideAuth();
      bootApp();
      // Background refresh — picks up any password/profile changes
      refreshAccountsFromFirestore();
      return;
    }
    // Cache miss; fall through to fresh load below.
    const fresh = await refreshAccountsFromFirestore();
    if (fresh[session.username]) {
      activateAccount(session.username, fresh[session.username]);
      hideAuth();
      bootApp();
      return;
    }
    // Session points at a deleted account → drop it.
    localStorage.removeItem(SESSION_KEY);
  }

  // No (valid) session — show the auth UI.
  showAuth();
  // Pre-warm the accounts cache for snappier login.
  refreshAccountsFromFirestore();
});
