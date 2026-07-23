// Account authentication and owner-scoped Firestore access.
//
// New account metadata lives at accounts/{username}. Each record carries the
// Firebase Auth UID that owns it, and every calendar/notes/presence document is
// stamped with that same UID. The old schedules/accounts registry is read only
// after authentication and is used solely to migrate previously claimed users.

const ACCOUNTS_CACHE_KEY = 'twosday_accounts_v1';
const SESSION_KEY = 'twosday_session_v1';
const ACCOUNT_COLLECTION = () => db.collection('accounts');
const ACCOUNT_DOC = username => ACCOUNT_COLLECTION().doc(username);
const LEGACY_ACCOUNTS_DOC = () => db.collection('schedules').doc('accounts');

let currentAccount = null;

function syntheticEmail(username) {
  return `${username.toLowerCase()}@twosday.local`;
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
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || '{}'); }
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
      const account = snap.data();
      cacheAccount(username, account);
      return account;
    }
  } catch (e) {
    console.warn('Failed to load account metadata:', e);
  }
  return allowCache ? (getCachedAccounts()[username] || null) : null;
}

async function saveAccountRecord(username, account) {
  const ownerUid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
  if (!ownerUid || account.ownerUid !== ownerUid) throw new Error('account ownership could not be verified');
  await ACCOUNT_DOC(username).set({ ...account, updatedAt: Date.now() });
  cacheAccount(username, account);
}

async function migrateLegacyAccount(username, uid, verifiedLegacyAccount = null) {
  let account = verifiedLegacyAccount;
  if (!account) {
    const legacySnap = await LEGACY_ACCOUNTS_DOC().get();
    const legacyAccounts = legacySnap.exists && legacySnap.data().accounts;
    account = legacyAccounts && legacyAccounts[username];
    if (!account || account.authUid !== uid) return null;
  }

  const migrated = {
    ...account,
    ownerUid: uid,
    authUid: uid,
    authClaimed: true,
    authEmail: account.authEmail || syntheticEmail(username),
    migratedAt: Date.now(),
  };
  await saveAccountRecord(username, migrated);
  return migrated;
}

async function findAccountForAuthUser(user) {
  const snap = await ACCOUNT_COLLECTION().where('ownerUid', '==', user.uid).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    const account = doc.data();
    cacheAccount(doc.id, account);
    return { username: doc.id, account };
  }

  // Signed-in compatibility path for records created before owner-scoped docs.
  const legacySnap = await LEGACY_ACCOUNTS_DOC().get();
  const legacy = legacySnap.exists && legacySnap.data().accounts;
  const entry = legacy && Object.entries(legacy).find(([, account]) => account.authUid === user.uid);
  if (!entry) return null;
  const [username] = entry;
  const account = await migrateLegacyAccount(username, user.uid);
  return account ? { username, account } : null;
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
}

async function handleGoogleSignIn(formId = 'login') {
  setError(formId, 'connecting to Google...');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const found = await findAccountForAuthUser(result.user);
    if (!found) {
      await firebase.auth().signOut();
      setError(formId, 'no Twosday account is linked to this Google account yet - log in with your username and password, then connect Google in settings.');
      return;
    }

    await prepareAccount(found.username, found.account);
    saveSession(found.username);
    setError(formId, '');
    hideAuth();
    bootApp();
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') { setError(formId, ''); return; }
    setError(formId, 'Google sign-in failed: ' + err.message);
  }
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
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { setError('login', 'username and password required'); return; }

    setError('login', 'checking...');
    let user;
    let account;
    try {
      const cred = await firebaseAuthSignIn(syntheticEmail(username), password);
      user = cred.user;
      account = await loadAccountRecord(username, false);
      if (!account) account = await migrateLegacyAccount(username, user.uid);
    } catch (authError) {
      // Never-claimed legacy account: sign-in failed because no Firebase Auth
      // user exists for it yet. Prefer a cached copy of the legacy registry
      // (avoids a round trip), but always fall back to a live read — the
      // registry is publicly readable specifically so this bootstrap works on
      // any device, not just the one that originally cached it.
      let legacyAccount = getCachedAccounts()[username];
      if (!legacyAccount || legacyAccount.ownerUid) {
        try {
          const legacySnap = await LEGACY_ACCOUNTS_DOC().get();
          const legacyAccounts = legacySnap.exists && legacySnap.data().accounts;
          legacyAccount = legacyAccounts && legacyAccounts[username];
        } catch (e) {
          legacyAccount = null;
        }
      }
      if (!legacyAccount || legacyAccount.ownerUid || !(await verifyPassword(password, legacyAccount.password))) {
        setError('login', 'invalid username or password');
        return;
      }
      try {
        const claim = await claimFirebaseAuth(username, password);
        user = firebase.auth().currentUser;
        account = await migrateLegacyAccount(username, claim.ownerUid, legacyAccount);
      } catch (claimError) {
        setError('login', claimError.code === 'auth/weak-password'
          ? 'this account\'s saved password is too short to secure (Firebase requires 6+ characters) - contact the project owner to reset it'
          : 'secure account migration failed - try again or contact the project owner');
        return;
      }
    }

    if (!user || !account || account.ownerUid !== user.uid) {
      await firebase.auth().signOut();
      setError('login', 'invalid username or password');
      return;
    }

    await prepareAccount(username, account);
    saveSession(username);
    setError('login', '');
    hideAuth();
    bootApp();
  };

  document.getElementById('signup-form').onsubmit = async e => {
    e.preventDefault();
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

    setError('signup', 'creating secure account...');
    let authUser = null;
    try {
      const claim = await claimFirebaseAuth(username, password);
      authUser = firebase.auth().currentUser;
      const account = {
        password: await hashPassword(password),
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
      saveSession(username);
      setError('signup', '');
      hideAuth();
      bootApp();
    } catch (err) {
      if (authUser) authUser.delete().catch(() => {});
      setError('signup', err.code === 'auth/email-already-in-use' ? 'that username is taken' : 'failed to create account: ' + err.message);
    }
  };
}

window.addEventListener('DOMContentLoaded', async () => {
  setupAuthListeners();
  selectAuthTab('login');

  const session = getSession();
  const authUser = await waitForFirebaseAuth();
  if (session && session.username && authUser) {
    try {
      let account = await loadAccountRecord(session.username, true);
      if (!account || !account.ownerUid) account = await migrateLegacyAccount(session.username, authUser.uid);
      if (account && account.ownerUid === authUser.uid) {
        await prepareAccount(session.username, account);
        hideAuth();
        bootApp();
        return;
      }
    } catch (e) {
      console.warn('Saved session could not be restored:', e);
    }
    localStorage.removeItem(SESSION_KEY);
  }

  showAuth();
});
