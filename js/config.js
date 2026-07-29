// Firebase browser configuration. Firebase web API keys identify a project;
// authorization is enforced by Firebase Auth, Firestore Rules, and App Check.
// Do not initialize a production data client on an alternate Vercel hostname.
const TWOSDAY_TRUSTED_HOSTS = new Set(['twosday.dev', 'www.twosday.dev', 'localhost', '127.0.0.1']);
const TWOSDAY_TRUSTED_DEPLOYMENT = location.protocol === 'file:' || TWOSDAY_TRUSTED_HOSTS.has(location.hostname);
const TWOSDAY_PRODUCTION_HOSTS = new Set(['twosday.dev', 'www.twosday.dev']);

if (!TWOSDAY_TRUSTED_DEPLOYMENT) {
  const target = `https://www.twosday.dev${location.pathname}${location.search}${location.hash}`;
  location.replace(target);
  throw new Error('Twosday data access is disabled on non-production deployments.');
}

const firebaseConfig = {
  apiKey: "AIzaSyBJ3GEf1i6BXEcVIStBS-7iE1Hk4dCR_Kc",
  authDomain: "jhschedule4.firebaseapp.com",
  projectId: "jhschedule4",
  storageBucket: "jhschedule4.firebasestorage.app",
  messagingSenderId: "699230921946",
  appId: "1:699230921946:web:caeac0208e66a4f01c71e3",
};
firebase.initializeApp(firebaseConfig);

// The Enterprise site key is public by design. Restrict provider activation to
// the registered production domains so local development does not require a
// debug token. Enforce App Check in Firebase only after production monitoring.
if (TWOSDAY_PRODUCTION_HOSTS.has(location.hostname) && firebase.appCheck) {
  firebase.appCheck().activate(
    new firebase.appCheck.ReCaptchaEnterpriseProvider('6LcrP2otAAAAAHb7Ee4x4bK1-Riq1KD9etEHEJGg'),
    true
  );
}

const db = firebase.firestore();
// Let Firestore retain reads and queue writes while connection is unavailable.
// Multi-tab mode keeps one browser's tabs from competing over its persistence lock.
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('Firestore offline persistence unavailable:', err);
  }
});

// These are populated by auth.js after the user logs in. Declared with `let`
// (not `const`) so they can be reassigned per-account.
let FIRESTORE_DOC       = null;
let NOTES_DOC           = null;
let PRESENCE_DOC        = null;
let STORAGE_KEY         = null;
let NOTES_KEY           = null;
let PRESENCE_KEY        = null;
let CUSTOM_COLORS_KEY   = null;  // localStorage key for saved custom palette colors
let USERS               = []; // profile names for the logged-in account

// App constants (unchanged across accounts)
const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
const START_H = 0;
const END_H = 24;
const STEP_H = 0.25;  // 15-minute snap
const PX_PER_HOUR = 60;

// First 7 are shown in the picker (ROYGBIV order). 'gray' is hidden — used
// only as the auto-categorization fallback and for legacy events.
const COLOR_PRESETS = [
  { name: 'red',    dark: { bg:'rgba(248,113,113,0.15)', text:'#f87171' }, light: { bg:'rgba(239,68,68,0.13)',   text:'#dc2626' } },
  { name: 'orange', dark: { bg:'rgba(251,146,60,0.15)',  text:'#fb923c' }, light: { bg:'rgba(234,88,12,0.13)',   text:'#c2410c' } },
  { name: 'yellow', dark: { bg:'rgba(250,204,21,0.13)',  text:'#fde047' }, light: { bg:'rgba(234,179,8,0.13)',   text:'#a16207' } },
  { name: 'green',  dark: { bg:'rgba(52,211,153,0.13)',  text:'#6ee7b7' }, light: { bg:'rgba(16,185,129,0.13)',  text:'#059669' } },
  { name: 'blue',   dark: { bg:'rgba(96,165,250,0.15)',  text:'#93c5fd' }, light: { bg:'rgba(59,130,246,0.13)',  text:'#2563eb' } },
  { name: 'indigo', dark: { bg:'rgba(129,140,248,0.15)', text:'#a5b4fc' }, light: { bg:'rgba(99,102,241,0.13)',  text:'#4338ca' } },
  { name: 'violet', dark: { bg:'rgba(192,132,252,0.15)', text:'#d8b4fe' }, light: { bg:'rgba(139,92,246,0.13)',  text:'#7c3aed' } },
  // Hidden — fallback only, not shown in the color picker:
  { name: 'gray',   dark: { bg:'rgba(161,161,170,0.10)', text:'#a1a1aa' }, light: { bg:'rgba(113,113,122,0.10)', text:'#52525b' } },
];

const SHARED_COLOR = {
  dark:  { bg:'rgba(232,121,249,0.14)', text:'#e9a8f2' },
  light: { bg:'rgba(192,38,211,0.12)',  text:'#a21caf' },
};

const categoryColors = {
  class: 'violet', meal: 'green', social: 'orange', work: 'blue', other: 'gray',
};
