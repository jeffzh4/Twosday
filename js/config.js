// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBJ3GEf1i6BXEcVIStBS-7iE1Hk4dCR_Kc",
  authDomain: "jhschedule4.firebaseapp.com",
  projectId: "jhschedule4",
  storageBucket: "jhschedule4.firebasestorage.app",
  messagingSenderId: "699230921946",
  appId: "1:699230921946:web:caeac0208e66a4f01c71e3",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// These are populated by auth.js after the user logs in. Declared with `let`
// (not `const`) so they can be reassigned per-account.
let FIRESTORE_DOC = null;
let NOTES_DOC     = null;
let STORAGE_KEY   = null;
let NOTES_KEY     = null;
let USERS         = []; // profile names for the logged-in account

// App constants (unchanged across accounts)
const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
const START_H = 0;
const END_H = 24;
const STEP_H = 0.5;
const PX_PER_HOUR = 60;

const COLOR_PRESETS = [
  { name: 'purple', dark: { bg:'rgba(167,139,250,0.12)', text:'#c4b5fd' }, light: { bg:'rgba(139,92,246,0.13)', text:'#7c3aed' } },
  { name: 'green',  dark: { bg:'rgba(52,211,153,0.10)',  text:'#6ee7b7' }, light: { bg:'rgba(16,185,129,0.12)', text:'#059669' } },
  { name: 'orange', dark: { bg:'rgba(251,146,60,0.12)',  text:'#fdba74' }, light: { bg:'rgba(251,146,60,0.13)', text:'#c2410c' } },
  { name: 'blue',   dark: { bg:'rgba(96,165,250,0.12)',  text:'#93c5fd' }, light: { bg:'rgba(59,130,246,0.12)', text:'#2563eb' } },
  { name: 'pink',   dark: { bg:'rgba(244,114,182,0.12)', text:'#f9a8d4' }, light: { bg:'rgba(236,72,153,0.13)', text:'#db2777' } },
  { name: 'cyan',   dark: { bg:'rgba(34,211,238,0.10)',  text:'#67e8f9' }, light: { bg:'rgba(6,182,212,0.12)',  text:'#0891b2' } },
  { name: 'yellow', dark: { bg:'rgba(250,204,21,0.10)',  text:'#fde047' }, light: { bg:'rgba(234,179,8,0.13)',  text:'#a16207' } },
  { name: 'red',    dark: { bg:'rgba(248,113,113,0.12)', text:'#fca5a5' }, light: { bg:'rgba(239,68,68,0.12)',  text:'#dc2626' } },
  { name: 'gray',   dark: { bg:'rgba(161,161,170,0.10)', text:'#a1a1aa' }, light: { bg:'rgba(113,113,122,0.10)', text:'#52525b' } },
];

const SHARED_COLOR = {
  dark:  { bg:'rgba(232,121,249,0.14)', text:'#e9a8f2' },
  light: { bg:'rgba(192,38,211,0.12)',  text:'#a21caf' },
};

const categoryColors = {
  class: 'purple', meal: 'green', social: 'orange', work: 'blue', other: 'gray',
};
