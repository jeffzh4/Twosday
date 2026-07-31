const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const firebaseMock = `
(() => {
  const account = { profiles: ['jeff', 'helen'], firestoreDoc: 'smoke-data', notesDoc: 'smoke-notes', ownerUid: 'smoke-owner', authClaimed: true, googleCalendar: { calendarIds: [] } };
  const user = { uid: 'smoke-owner', email: 'smoke@twosday.local', delete: async () => {}, linkWithPopup: async () => ({ user }) };
  const doc = (collection, id) => ({
    get: async () => collection === 'accounts' && id === 'smoke' ? { exists: true, data: () => account } : { exists: false, data: () => ({}) },
    set: async () => {}, update: async () => {}, delete: async () => {}, onSnapshot: () => () => {},
  });
  const auth = () => ({ currentUser: user, onAuthStateChanged: callback => { queueMicrotask(() => callback(user)); return () => {}; }, signOut: async () => {}, signInWithPopup: async () => ({ user }), signInWithEmailAndPassword: async () => ({ user }), createUserWithEmailAndPassword: async () => ({ user }) });
  auth.GoogleAuthProvider = function GoogleAuthProvider() {};
  auth.EmailAuthProvider = { credential: () => ({}) };
  const firestore = () => ({ enablePersistence: () => Promise.resolve(), collection: name => ({ doc: id => doc(name, id), where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) }) });
  firestore.FieldValue = { delete: () => '__delete__' };
  window.firebase = { initializeApp: () => {}, appCheck: () => ({ activate: () => {} }), firestore, auth };
})();`;

function server() {
  return http.createServer((req, res) => {
    const requested = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(root, requested);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

(async () => {
  let app;
  let browser;
  try {
  app = server();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const port = app.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => console.error('page error:', error.message));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({ contentType: 'application/javascript', body: firebaseMock }));
  await page.addInitScript(() => {
    localStorage.setItem('twosday_session_v1', JSON.stringify({ username: 'smoke', savedAt: Date.now() }));
    localStorage.setItem('twosday_v2_smoke', JSON.stringify({
      allData: { '2026-07-21': { jeff: [{ id: 'seed', text: 'smoke event', start: 9, end: 10, shared: false, done: false }], helen: [] } },
      activeUser: 'jeff', viewMode: 'week', currentDate: '2026-07-21T12:00:00.000Z', userTheme: { jeff: 'dark', helen: 'light' }, calendarDensity: {}, tombstones: {}, auditLog: [], savedAt: Date.now(),
    }));
  });
  // Fonts and third-party SDK requests are intentionally outside this smoke
  // test. DOM readiness plus explicit app selectors is the stable contract.
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app');
  await page.waitForFunction(() => document.getElementById('auth-overlay').style.display === 'none');
  assert.strictEqual(await page.locator('.grid-wrap').count(), 1, 'week grid should render');
  await page.keyboard.press('m');
  await page.waitForSelector('.month-view');
  await page.keyboard.press('d');
  await page.waitForSelector('.grid-wrap');
  await page.locator('.ev[data-id="seed"]').click();
  await page.waitForSelector('#m-name');
  await page.locator('#m-name').fill('edited smoke event');
  await page.locator('#m-save').click();
  await page.waitForSelector('.ev[data-id="seed"]');
  assert.strictEqual(await page.locator('.ev-title').first().textContent(), 'edited smoke event');
  await page.locator('#btn-settings').click();
  await page.waitForSelector('#s-google-calendar-connect');
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.locator('.modal-bg').count(), 0, 'Escape must restore the normal app flow');
  console.log('browser smoke tests passed');
  } finally {
    if (browser) await browser.close();
    if (app) await new Promise(resolve => app.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
