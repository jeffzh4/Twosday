const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const captureDir = process.env.TWOSDAY_CAPTURE_DIR || null;
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
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const missing = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': 'text/html' });
      fs.createReadStream(missing).pipe(res);
      return;
    }
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
  const pageErrors = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => pageErrors.push(error.message));
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

  // Dragging to the end of the day must preserve midnight rather than falling
  // back to the calendar's minimum 15-minute duration.
  const dayBody = page.locator('.col-body');
  await page.locator('#grid-wrap').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const bodyBox = await dayBody.boundingBox();
  assert(bodyBox, 'day grid body should have a measurable position');
  const dragX = bodyBox.x + bodyBox.width / 2;
  const dragStartY = bodyBox.y + 22.5 * 60;
  await page.mouse.move(dragX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragX, bodyBox.y + bodyBox.height - 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForSelector('#m-end');
  assert.strictEqual(await page.locator('#m-end').inputValue(), '00:00', 'dragging to midnight should display 12:00 AM');
  assert.strictEqual(await page.locator('#m-end-midnight').isVisible(), true, 'midnight state should be explicit in the editor');
  await page.locator('#m-cancel').click();

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

  // Empty schedules still retain their calendar affordances, and connection
  // changes must be visible without a full application redraw.
  await page.locator('#btn-next').click();
  assert.strictEqual(await page.locator('.ev').count(), 0, 'an empty day must not render stale events');
  assert.strictEqual(await page.locator('.col-body').count(), 1, 'an empty day must remain ready for event creation');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForFunction(() => document.getElementById('sync-status').textContent === 'offline');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.getElementById('sync-status').textContent === 'synced');

  // Mobile has a purpose-built agenda instead of squeezing desktop's time grid.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({ contentType: 'application/javascript', body: firebaseMock }));
  await mobile.addInitScript(() => {
    localStorage.setItem('twosday_session_v1', JSON.stringify({ username: 'smoke', savedAt: Date.now() }));
    localStorage.setItem('twosday_v2_smoke', JSON.stringify({
      allData: {
        '2026-07-21': {
          jeff: [{ id: 'mobile-seed', sharedId: 'mobile-share', text: 'mobile smoke event', start: 9, end: 10, shared: true, done: false }],
          helen: [{ id: 'mobile-mirror', sharedId: 'mobile-share', text: 'mobile smoke event', start: 9, end: 10, shared: true, done: false }],
        },
      },
      activeUser: 'jeff', viewMode: 'day', currentDate: '2026-07-21T12:00:00.000Z', userTheme: { jeff: 'dark', helen: 'light' }, calendarDensity: {}, tombstones: {}, auditLog: [], savedAt: Date.now(),
    }));
  });
  await mobile.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('.mobile-agenda');
  if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await mobile.screenshot({ path: path.join(captureDir, 'mobile-day.png') }); }
  assert.strictEqual(await mobile.locator('.grid-wrap').count(), 0, 'mobile day must not render the desktop time grid');
  assert.strictEqual(await mobile.locator('.mobile-nav').count(), 1, 'mobile navigation should render');
  await mobile.locator('.mobile-agenda-event').click();
  await mobile.waitForSelector('#m-name');
  if (captureDir) { await mobile.waitForTimeout(250); await mobile.screenshot({ path: path.join(captureDir, 'mobile-event-editor.png') }); }
  assert.strictEqual(await mobile.locator('.modal-bg > .modal').count(), 1, 'mobile event edit should use the standard editor');
  assert.strictEqual(await mobile.locator('.mobile-event-quick-actions button').count(), 4, 'mobile editor should preserve repeat, share, completion, and delete actions');
  await mobile.locator('#m-cancel').click();
  await mobile.getByRole('button', { name: 'Week' }).click();
  await mobile.waitForSelector('.mobile-week-agenda');
  if (captureDir) { await mobile.waitForTimeout(100); await mobile.screenshot({ path: path.join(captureDir, 'mobile-week.png') }); }
  assert.strictEqual(await mobile.locator('.mobile-week-day').count(), 7, 'mobile week should show seven agenda days');
  await mobile.getByRole('button', { name: 'More' }).click();
  await mobile.waitForSelector('.mobile-more-sheet');
  if (captureDir) { await mobile.waitForTimeout(250); await mobile.screenshot({ path: path.join(captureDir, 'mobile-more.png') }); }
  assert.strictEqual(await mobile.getByRole('button', { name: 'find time' }).count(), 1, 'mobile more sheet should retain secondary tools');
  assert.strictEqual(await mobile.getByRole('button', { name: 'year view' }).count(), 1, 'mobile more sheet should retain year view');
  assert.strictEqual(await mobile.getByRole('button', { name: 'activity' }).count(), 1, 'mobile more sheet should retain activity history');
  await mobile.getByRole('button', { name: 'year view' }).click();
  await mobile.waitForSelector('.year-view');
  assert.strictEqual(await mobile.locator('.mobile-more-sheet').count(), 0, 'mobile more actions should close before changing views');
  await mobile.getByRole('button', { name: 'Month' }).click();
  await mobile.waitForSelector('.month-view');
  if (captureDir) { await mobile.waitForTimeout(100); await mobile.screenshot({ path: path.join(captureDir, 'mobile-month.png') }); }
  assert.strictEqual(await mobile.locator('.month-cell').count() > 0, true, 'mobile month should retain the calendar scan view');
  await mobile.close();
  assert.deepStrictEqual(pageErrors, [], `browser runtime errors: ${pageErrors.join('; ')}`);

  // Public static routes stay readable without an account or production data.
  const publicPage = await browser.newPage();
  const publicErrors = [];
  publicPage.on('pageerror', error => publicErrors.push(error.message));
  await publicPage.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({ contentType: 'application/javascript', body: firebaseMock }));
  await publicPage.goto(`http://127.0.0.1:${port}/privacy.html`, { waitUntil: 'domcontentloaded' });
  await publicPage.getByRole('heading', { name: 'Privacy Policy' }).waitFor();
  await publicPage.goto(`http://127.0.0.1:${port}/share.html`, { waitUntil: 'domcontentloaded' });
  await publicPage.getByText('this link is invalid.').waitFor();
  const missing = await publicPage.goto(`http://127.0.0.1:${port}/not-a-real-page`, { waitUntil: 'domcontentloaded' });
  assert.strictEqual(missing.status(), 404, 'unknown routes must return HTTP 404');
  await publicPage.getByRole('heading', { name: 'That page is not available.' }).waitFor();
  assert.deepStrictEqual(publicErrors, [], `public route runtime errors: ${publicErrors.join('; ')}`);
  await publicPage.close();
  console.log('browser smoke tests passed');
  } finally {
    if (browser) await browser.close();
    if (app) await new Promise(resolve => app.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
