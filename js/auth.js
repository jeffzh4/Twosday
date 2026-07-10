// ── Auth module ───────────────────────────────────────────────────────────────
// All accounts live in Firestore (schedules/accounts). Passwords are hashed
// client-side (SHA-256) before storage. Firebase Authentication is layered on
// top as the credential verifier: on an account's next successful login it is
// silently "claimed" — a Firebase Auth user is created with a synthetic email
// (see syntheticEmail()) and future logins verify through Firebase Auth first,
// falling back to the legacy hash check for any account not yet claimed. This
// touches nothing about how calendar/notes/presence documents are stored or
// addressed — see CLAUDE.md's Auth System section for the full design.
// localStorage is used as a cache/fallback for fast loads and offline support.

const ACCOUNTS_CACHE_KEY = 'twosday_accounts_v1';
const SESSION_KEY        = 'twosday_session_v1';
const ACCOUNTS_DOC       = () => db.collection('schedules').doc('accounts');

let currentAccount = null;   // { username, profiles, firestoreDoc, notesDoc }

// ── Firebase Auth claim layer ─────────────────────────────────────────────────
// Firebase Auth's email/password provider requires an email; usernames aren't
// emails, so each account gets a synthetic, never-emailed address. This is
// fixed at claim time and stored as account.authEmail so a later username
// rename can't orphan the Firebase Auth login (see renameProfile / settings.js).
function syntheticEmail(username) {
  return `${username.toLowerCase()}@twosday.local`;
}

// Creates the Firebase Auth user for a newly-verified (or newly-created)
// account. Throws on failure — callers decide whether that's fatal.
async function claimFirebaseAuth(username, password) {
  const email = syntheticEmail(username);
  const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
  return { authUid: cred.user.uid, authEmail: email };
}

function firebaseAuthSignIn(authEmail, password) {
  return firebase.auth().signInWithEmailAndPassword(authEmail, password);
}

// Google sign-in only works for accounts already claimed and linked to a
// Google credential (via "connect Google" in account settings) — it never
// creates a new account, since Twosday's two-profile accounts are shared and
// a fresh Google identity has no way to know which existing account it
// belongs to. Present on both the login and signup tabs; formId routes the
// status message to whichever tab's error slot the click came from.
async function handleGoogleSignIn(formId = 'login') {
  setError(formId, 'connecting to Google…');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const uid = result.user.uid;

    const accounts = await refreshAccountsFromFirestore();
    const entry = Object.entries(accounts).find(([, acc]) => acc.authUid === uid);
    if (!entry) {
      await firebase.auth().signOut();
      setError(formId, 'no Twosday account is linked to this Google account yet — log in with your username and password once, then connect Google from account settings.');
      return;
    }

    const [username, account] = entry;
    activateAccount(username, account);
    saveSession(username);
    setError(formId, '');
    hideAuth();
    bootApp();
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') { setError(formId, ''); return; }
    setError(formId, 'Google sign-in failed: ' + err.message);
  }
}

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
  PRESENCE_KEY        = `twosday_presence_v1_${username}`;
  CUSTOM_COLORS_KEY   = `twosday_colors_v1_${username}`;
  FIRESTORE_DOC       = db.collection('schedules').doc(account.firestoreDoc);
  NOTES_DOC           = db.collection('schedules').doc(account.notesDoc);
  PRESENCE_DOC        = db.collection('schedules').doc(account.firestoreDoc + '-presence');

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
  try { firebase.auth().signOut(); } catch (e) {}
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

  document.getElementById('btn-google-signin').onclick = () => handleGoogleSignIn('login');
  document.getElementById('btn-google-signup').onclick = () => handleGoogleSignIn('signup');

  // ── Login ────────────────────────────────────────────────────────────────────
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { setError('login', 'username and password required'); return; }

    setError('login', 'checking…');
    const accounts = await refreshAccountsFromFirestore();
    const account  = accounts[username];
    if (!account) { setError('login', 'invalid username or password'); return; }

    const patch = {};   // fields to persist back to the account record, if any

    if (account.authClaimed) {
      // Firebase Auth is the source of truth for this account.
      try {
        await firebaseAuthSignIn(account.authEmail, password);
      } catch (err) {
        setError('login', 'invalid username or password');
        return;
      }
    } else {
      // Legacy path: verify against the stored hash (or plaintext, pre-migration).
      if (!(await verifyPassword(password, account.password))) {
        setError('login', 'invalid username or password');
        return;
      }
      if (!isHashed(account.password)) patch.password = await hashPassword(password);

      // Silently claim the account into Firebase Auth now that the password is
      // verified. Non-fatal if it fails (e.g. provider not yet enabled in the
      // Firebase Console) — the account simply stays on the legacy path and
      // claiming is retried on the next successful login.
      try {
        const claim = await claimFirebaseAuth(username, password);
        patch.authClaimed = true;
        patch.authUid = claim.authUid;
        patch.authEmail = claim.authEmail;
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          // A prior claim attempt likely created the Firebase Auth user but the
          // Firestore write recording it didn't complete (e.g. connection drop).
          // Self-heal: sign in with the password we just verified and adopt it.
          try {
            const email = syntheticEmail(username);
            const cred = await firebaseAuthSignIn(email, password);
            patch.authClaimed = true;
            patch.authUid = cred.user.uid;
            patch.authEmail = email;
          } catch (signInErr) {
            console.warn('Firebase Auth self-heal sign-in failed, staying on legacy login:', signInErr);
          }
        } else {
          console.warn('Firebase Auth claim failed, staying on legacy login:', err);
        }
      }
    }

    if (Object.keys(patch).length) {
      const updated = { ...accounts, [username]: { ...account, ...patch } };
      ACCOUNTS_DOC().set({ accounts: updated, savedAt: Date.now() }).catch(() => {});
      localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(updated));
      Object.assign(account, patch);
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
    if (password.length < 6) {
      setError('signup', 'password must be at least 6 characters'); return;
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
      password: await hashPassword(password),
      profiles: [profile1, profile2],
      firestoreDoc: username,
      notesDoc: username + '-notes',
      createdAt: Date.now(),
    };

    // Claim into Firebase Auth immediately so new accounts never touch the
    // legacy hash-check path. Non-fatal if it fails (e.g. provider not yet
    // enabled) — the account still works, claimed on its next login instead.
    try {
      const claim = await claimFirebaseAuth(username, password);
      newAccount.authClaimed = true;
      newAccount.authUid = claim.authUid;
      newAccount.authEmail = claim.authEmail;
    } catch (err) {
      console.warn('Firebase Auth claim failed at signup, staying on legacy login:', err);
    }

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
