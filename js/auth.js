// ── Auth module ───────────────────────────────────────────────────────────────
// All accounts live in Firestore (schedules/accounts).
// Passwords are plaintext — intentional for a small trusted-circle app.
// localStorage is used as a cache/fallback for fast loads and offline support.

const ACCOUNTS_CACHE_KEY = 'twosday_accounts_v1';
const SESSION_KEY        = 'twosday_session_v1';
const ACCOUNTS_DOC       = () => db.collection('schedules').doc('accounts');

let currentAccount = null;   // { username, profiles, firestoreDoc, notesDoc }

// ── Account loading ───────────────────────────────────────────────────────────

function getCachedAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || '{}'); } catch (e) { return {}; }
}

// Fetch accounts from Firestore and update the local cache.
async function refreshAccountsFromFirestore() {
  try {
    const snap = await ACCOUNTS_DOC().get();
    if (snap.exists && snap.data() && snap.data().accounts) {
      const accounts = snap.data().accounts;
      localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(accounts));
      return accounts;
    }
  } catch (e) {
    console.warn('Failed to refresh accounts from Firestore:', e);
  }
  // Fall back to cache if Firestore is unavailable.
  return getCachedAccounts();
}

// ── Account activation ────────────────────────────────────────────────────────

// Configure all the per-account globals that other modules read.
function activateAccount(username, account) {
  currentAccount = { username, ...account };

  USERS               = account.profiles.slice();
  STORAGE_KEY         = `twosday_v2_${username}`;
  NOTES_KEY           = `twosday_notes_v2_${username}`;
  CUSTOM_COLORS_KEY   = `twosday_colors_v1_${username}`;
  FIRESTORE_DOC       = db.collection('schedules').doc(account.firestoreDoc);
  NOTES_DOC           = db.collection('schedules').doc(account.notesDoc);

  activeUser = USERS[0];
  userTheme = {};
  USERS.forEach((u, i) => { userTheme[u] = i === 0 ? 'dark' : 'light'; });
  userNotes = {};
  USERS.forEach(u => { userNotes[u] = []; });
}

// ── Session helpers ───────────────────────────────────────────────────────────

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
  // Tab switching
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
    if (!/^[a-zA-Z0-9]+$/.test(profile1) || !/^[a-zA-Z0-9]+$/.test(profile2)) {
      setError('signup', 'profile names: letters and numbers only'); return;
    }
    if (profile1.length > 15 || profile2.length > 15) {
      setError('signup', 'profile names must be 15 characters or less'); return;
    }

    setError('signup', 'creating account…');

    // Always read the latest accounts from Firestore before writing,
    // so we don't accidentally clobber existing accounts.
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

    const merged = { ...accounts, [username]: newAccount };
    try {
      await ACCOUNTS_DOC().set({ accounts: merged, savedAt: Date.now() });
    } catch (err) {
      setError('signup', 'failed to save: ' + err.message);
      return;
    }
    localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(merged));

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
    // Fast path: try the local cache first so the calendar appears immediately.
    const cached = getCachedAccounts();
    if (cached[session.username]) {
      activateAccount(session.username, cached[session.username]);
      hideAuth();
      bootApp();
      // Background refresh — picks up any changes made on other devices.
      refreshAccountsFromFirestore();
      return;
    }
    // Cache miss — fetch from Firestore before proceeding.
    const fresh = await refreshAccountsFromFirestore();
    if (fresh[session.username]) {
      activateAccount(session.username, fresh[session.username]);
      hideAuth();
      bootApp();
      return;
    }
    // Session points at a deleted/unknown account — clear it.
    localStorage.removeItem(SESSION_KEY);
  }

  showAuth();
  // Pre-warm the cache so login feels instant.
  refreshAccountsFromFirestore();
});
