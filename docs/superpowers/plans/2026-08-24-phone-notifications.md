# Phone Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When one profile makes a real edit to the shared calendar, the other profile's phone gets a push-style notification — coalesced into one per active editing session, never one per keystroke, and never fired just because someone opened the app to look.

**Architecture:** No backend, no Firebase Blaze, no Cloud Functions, no SMS. Delivery is [ntfy.sh](https://ntfy.sh) — a free, no-account push service where a topic name is the only credential, the same trust model this app already uses for share-link tokens. The notification fires from the *editor's own browser*, the moment their own edit finishes actually syncing (never from the recipient's side, since the recipient's browser may not even be open). The trigger point is the existing "did a real write actually happen" signal already in `calendar-store.js` — the same check that silently skips a Firestore write when nothing but navigation changed — so "not just checking" is enforced by code that's already tested and running in production, not reimplemented. A burst of edits within a session is coalesced into one notification via a debounce timer, backstopped by firing early if the tab is closed or backgrounded before the timer lapses.

**Tech Stack:** Vanilla JS (no build step, matches the rest of the repo), `fetch()` to `https://ntfy.sh/<topic>`, Firestore for storing each profile's topic name on the shared account document.

## Global Constraints

- No new backend, no Firebase Blaze plan, no Cloud Functions, no paid service of any kind. (User has explicitly ruled out Blaze twice this project.)
- No email-based delivery — this account model has no deliverable recovery email (see `docs/KNOWN-LIMITATIONS.md`).
- A failed or unconfigured notification must never block, delay, or error the calendar sync itself — notifications are best-effort and silent-fail.
- Follow the existing code style: no build step, plain `<script>` tags loaded in dependency order, `escHtml()` on all user-facing template interpolation, `?v=<date>-<slug>` cache-bust tags bumped on every JS/CSS file touched (stale service-worker caching has bitten this project before — see `docs/KNOWN-LIMITATIONS.md` and multiple past commits).
- Every new file must be added to `sw.js`'s precache list or the PWA serves a stale copy offline.
- Match existing account-document conventions: extra fields on the `accounts/{username}` Firestore document don't need a Firestore Rules change (verified in this codebase: `validAccount()` only checks required fields, doesn't reject extras — the same reasoning already applied when `googleLinked` was added).

---

## File Structure

- **Create `js/notifications.js`** — owns everything about *deciding what to send and when*: topic lookup, message text, the debounce/coalesce timer, the tab-close backstop. Nothing here talks to Firestore or the DOM beyond reading `currentAccount`/`activeUser`/`USERS` (already-global state) — kept pure and unit-testable, same shape as `js/import.js`'s `findLikelyDuplicate`.
- **Modify `js/calendar-store.js`** — add one optional callback, `onRealSave`, invoked exactly when a write actually reaches Firestore (not when skipped as a no-op). This is the one and only place "a real edit happened" is already decided; every other file just gets to react to it.
- **Modify `js/state.js`** — wire `onRealSave: scheduleEditNotification` into the existing `getCalendarStore()` call, next to the existing `mergeSnapshot`/`onWriteError` wiring.
- **Modify `js/app.js`** — call `setupEditNotificationBackstop()` once at boot, in `wireAppShell()`, next to the existing `resize` listener added for the mobile-layout fix.
- **Modify `js/settings.js`** — new "phone notifications" section: one topic field per profile, a generate-random-topic button per field (reuses `shareToken()` from `js/share.js`), one save button.
- **Modify `index.html`, `sw.js`** — register the new script.
- **Modify `tests/core-tests.js`, `tests/calendar-store-tests.js`** — new tests.
- **Modify `docs/KNOWN-LIMITATIONS.md`, `privacy.html`, `docs/ARCHITECTURE.md`** — this sends a message containing a profile name to a new third party (ntfy.sh) whenever used; the privacy policy and architecture docs must say so.

---

### Task 1: Core notification logic (`js/notifications.js`)

**Files:**
- Create: `js/notifications.js`
- Modify: `index.html:206` (add script tag right after `js/calendar-store.js`)
- Modify: `sw.js:33` (add precache entry right after `/js/calendar-store.js`)
- Modify: `tests/core-tests.js:65` (add `load('js/notifications.js');` right after `load('js/calendar-data.js');`)
- Test: `tests/core-tests.js` (new `run(...)` blocks)

**Interfaces:**
- Consumes: global `USERS` (array of 2 profile name strings), `currentAccount` (object, may have `.notifyTopics = { [profileName]: string }`), `activeUser` (string).
- Produces: `otherProfileName(user)`, `notifyTopicFor(user)`, `editNotificationMessage(user)`, `scheduleEditNotification()`, `stopEditNotification()`, `setupEditNotificationBackstop()` — all globals, consumed by Task 2 (`calendar-store.js`/`state.js`) and Task 3 (`app.js`).

- [ ] **Step 1: Write the failing tests**

Open `tests/core-tests.js` and add these `run(...)` blocks right after the existing `run('findLikelyDuplicate matches on date and normalized title, not time', ...)` block (search for that string to find the spot):

```js
run('otherProfileName returns the profile that is not the given one', () => {
  assert.strictEqual(exec(`otherProfileName('alex')`), 'jamie');
  assert.strictEqual(exec(`otherProfileName('jamie')`), 'alex');
  assert.strictEqual(exec(`otherProfileName('nobody')`), null);
});

run('notifyTopicFor reads the recipient profile\'s configured topic, trimmed', () => {
  exec(`currentAccount = { notifyTopics: { alex: '  topic-a  ', jamie: '' } };`);
  assert.strictEqual(exec(`notifyTopicFor('alex')`), 'topic-a');
  assert.strictEqual(exec(`notifyTopicFor('jamie')`), null);   // blank topic == not configured
  assert.strictEqual(exec(`notifyTopicFor('ghost')`), null);   // unknown profile
  exec(`currentAccount = { };`);
  assert.strictEqual(exec(`notifyTopicFor('alex')`), null);    // notifyTopics never set at all
});

run('editNotificationMessage names whoever is editing', () => {
  assert.strictEqual(exec(`editNotificationMessage('alex')`), 'alex made changes to the calendar');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/core-tests.js`
Expected: `not ok - otherProfileName returns the profile that is not the given one` (or a ReferenceError, since none of these functions exist yet) — the run must fail before you write the implementation.

- [ ] **Step 3: Write the implementation**

Create `js/notifications.js`:

```js
// Phone-style push notifications for real calendar edits, via ntfy.sh -- a
// free, no-account push service where a topic name is the only credential.
// Same trust model this app already uses for share-link tokens (see
// shareToken() in share.js): unguessable name in, no auth needed.
//
// This module only decides WHAT to send and WHEN. It never talks to
// Firestore directly -- calendar-store.js and state.js call into it exactly
// once, at the moment a real (non-skipped) write finishes syncing.

const EDIT_NOTIFICATION_QUIET_MS = 4000;
let editNotificationTimer = null;

// The app has exactly two profiles; the notification recipient is always
// "the other one." Returns null for an unrecognized profile rather than
// guessing, so a caller bug fails loudly instead of notifying the wrong side.
function otherProfileName(user) {
  return USERS.find(u => u !== user) || null;
}

// A blank/whitespace-only topic means "not configured" -- must behave
// identically to no topic at all, not send a request to a nonsense URL.
function notifyTopicFor(user) {
  const topics = currentAccount && currentAccount.notifyTopics;
  const topic = topics && topics[user];
  return typeof topic === 'string' && topic.trim() ? topic.trim() : null;
}

function editNotificationMessage(user) {
  return `${user} made changes to the calendar`;
}

// Best-effort: a failed push must never surface as a calendar sync error.
function sendPushNotification(topic, message) {
  return fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: 'POST',
    body: message,
  }).catch(() => {});
}

function fireEditNotification() {
  clearTimeout(editNotificationTimer);
  editNotificationTimer = null;
  const recipient = otherProfileName(activeUser);
  const topic = recipient && notifyTopicFor(recipient);
  if (!topic) return;
  sendPushNotification(topic, editNotificationMessage(activeUser));
}

// Called every time a real (non-skipped) write finishes. Each call pushes
// the timer back, so a burst of edits collapses into one notification, sent
// once activity actually goes quiet.
function scheduleEditNotification() {
  clearTimeout(editNotificationTimer);
  editNotificationTimer = setTimeout(fireEditNotification, EDIT_NOTIFICATION_QUIET_MS);
}

function stopEditNotification() {
  clearTimeout(editNotificationTimer);
  editNotificationTimer = null;
}

// Backstop: if the tab is closed or backgrounded while a notification is
// still pending in its quiet window, send it now instead of losing it.
function setupEditNotificationBackstop() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && editNotificationTimer) fireEditNotification();
  });
  window.addEventListener('pagehide', () => {
    if (editNotificationTimer) fireEditNotification();
  });
}
```

- [ ] **Step 4: Register the new file**

In `index.html`, find line 206 (`<script src="js/calendar-store.js?v=20260727-write-seam"></script>`) and add a new line immediately after it:

```html
<script src="js/notifications.js?v=20260824-phone-notify"></script>
```

In `sw.js`, find the line `'/js/calendar-store.js',` and add immediately after it:

```js
  '/js/notifications.js',
```

In `tests/core-tests.js`, find `load('js/calendar-data.js');` and add immediately after it:

```js
load('js/notifications.js');
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/core-tests.js`
Expected: `ok - otherProfileName returns the profile that is not the given one`, `ok - notifyTopicFor reads the recipient profile's configured topic, trimmed`, `ok - editNotificationMessage names whoever is editing`, and `all core tests passed` at the end.

- [ ] **Step 6: Commit**

```bash
git add js/notifications.js index.html sw.js tests/core-tests.js
git commit -m "feat(notify): add ntfy.sh push notification core logic"
```

---

### Task 2: Hook into the real-write signal

**Files:**
- Modify: `js/calendar-store.js:7-61` (`createCalendarStore`)
- Modify: `js/state.js` (the `getCalendarStore()` function, in the `createCalendarStore({ cache, remote })` call)
- Test: `tests/calendar-store-tests.js`

**Interfaces:**
- Consumes: `scheduleEditNotification` (global, from Task 1).
- Produces: `createCalendarStore(options)` now accepts an optional `onRealSave` callback in its `options` object, called with no arguments exactly once per real (non-skipped) write, after `remote.setStatus('synced')`.

- [ ] **Step 1: Write the failing test**

Open `tests/calendar-store-tests.js`. Find `makeHarness()` and change its `context.createCalendarStore({...})` call to capture `onRealSave` calls — add an `onRealSaveCalls` counter to `calls` and pass `onRealSave: () => { calls.onRealSaveCalls++; }` into the options object:

```js
function makeHarness() {
  const calls = { cacheLoad: 0, cacheSave: 0, writes: 0, statuses: [], errors: 0, onRealSaveCalls: 0 };
  let signature = 'one';
  let loading = false;
  let listener = null;
  let scheduled = null;
  let clock = 10000;

  const store = context.createCalendarStore({
    cache: {
      load: () => { calls.cacheLoad++; return { loaded: true }; },
      save: () => { calls.cacheSave++; },
    },
    remote: {
      isLoading: () => loading,
      isOffline: () => false,
      signature: () => signature,
      setStatus: status => calls.statuses.push(status),
      write: () => { calls.writes++; return Promise.resolve(); },
      onWriteError: () => { calls.errors++; },
      listen: controls => { listener = controls; return 'unsubscribe'; },
    },
    now: () => clock,
    setTimeoutFn: fn => { scheduled = fn; return 1; },
    clearTimeoutFn: () => { scheduled = null; },
    onRealSave: () => { calls.onRealSaveCalls++; },
  });

  return {
    store, calls,
    setSignature: value => { signature = value; },
    setLoading: value => { loading = value; },
    flush: async () => { const fn = scheduled; scheduled = null; if (fn) await fn(); },
    listener: () => listener,
    advance: ms => { clock += ms; },
  };
}
```

Then add a new test. Find where other `run(...)` calls that use `makeHarness()` and `store.saveRemote()` live (search for `store.saveRemote()`), and add this block near them:

```js
run('onRealSave fires once per real write, never on a skipped no-op save', async () => {
  const h = makeHarness();
  h.setSignature('one');
  await h.store.saveRemote();          // first save: signature differs from null -> real write
  assert.strictEqual(h.calls.writes, 1);
  assert.strictEqual(h.calls.onRealSaveCalls, 1);

  await h.store.saveRemote();          // same signature again -> skipped, not a real write
  assert.strictEqual(h.calls.writes, 1);
  assert.strictEqual(h.calls.onRealSaveCalls, 1);

  h.setSignature('two');
  await h.store.saveRemote();          // signature changed -> real write again
  assert.strictEqual(h.calls.writes, 2);
  assert.strictEqual(h.calls.onRealSaveCalls, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/calendar-store-tests.js`
Expected: FAIL — `onRealSaveCalls` stays `0` after the first save, since `createCalendarStore` doesn't call `onRealSave` yet.

- [ ] **Step 3: Implement**

In `js/calendar-store.js`, modify the destructured options and the success branch of `saveRemote`:

```js
function createCalendarStore(options) {
  const {
    cache,
    remote,
    debounceMs = 400,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    onRealSave = () => {},
  } = options;
```

And in `saveRemote()`, in the success branch:

```js
    return Promise.resolve(write).then(() => {
      if (writeLifecycle !== lifecycle) return false;
      remote.setStatus('synced');
      onRealSave();
      return true;
    }).catch(error => {
```

(Only those two spots change — everything else in `calendar-store.js` stays exactly as it is.)

Then in `js/state.js`, find `getCalendarStore()` and the line `calendarStore = createCalendarStore({ cache, remote });` — change it to:

```js
  calendarStore = createCalendarStore({ cache, remote, onRealSave: scheduleEditNotification });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/calendar-store-tests.js`
Expected: `ok - onRealSave fires once per real write, never on a skipped no-op save` and `all calendar store tests passed`.

Then run the full suite to make sure nothing else broke: `npm test`
Expected: all 8 checks pass.

- [ ] **Step 5: Commit**

```bash
git add js/calendar-store.js js/state.js tests/calendar-store-tests.js
git commit -m "feat(notify): fire scheduleEditNotification on real writes only"
```

---

### Task 3: Boot-time wiring (tab-close backstop)

**Files:**
- Modify: `js/app.js` (`wireAppShell()`)

**Interfaces:**
- Consumes: `setupEditNotificationBackstop` (global, from Task 1).
- Produces: nothing new consumed elsewhere — this is a leaf wiring task.

- [ ] **Step 1: Implement**

There's no separate failing-test step for this one — `setupEditNotificationBackstop()`'s own listener behavior isn't practically unit-testable (it depends on real `visibilitychange`/`pagehide` events), and it's pure wiring with no branching logic of its own. Verification is the manual end-to-end check in Task 6.

In `js/app.js`, find `wireAppShell()` and the resize-listener block added for the mobile-layout fix (search for `window.addEventListener('resize'`). Add this line right after that whole resize block, still inside `wireAppShell()`:

```js
  setupEditNotificationBackstop();
```

- [ ] **Step 2: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: all 8 checks pass (this change has no test of its own, but must not break anything else).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(notify): wire up the tab-close notification backstop"
```

---

### Task 4: Settings UI — configure each profile's topic

**Files:**
- Modify: `js/settings.js` (template in `openSettingsModal()`, plus a new handler)

**Interfaces:**
- Consumes: `shareToken()` (global, from `js/share.js`), `saveAccountRecord(username, account)` (global, existing), `setMsg(id, text, isError)` (local closure in `openSettingsModal()`, existing), `currentAccount`, `USERS`, `escHtml()`.
- Produces: nothing consumed by other tasks — this is the last leaf.

- [ ] **Step 1: Add the settings section HTML**

In `js/settings.js`, find the `<!-- ── Connected accounts ── -->` section's closing `</div>` followed by the `Google Calendar overlay` section (search for `Google Calendar overlay`). Right after that section's closing `</div>` and before the `system status` section, insert:

```html
      <div class="settings-section">
        <div class="settings-section-title">phone notifications</div>
        <div class="settings-msg">get a phone notification when the other profile makes real changes to the calendar (not just for looking). Free via <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy.sh</a> — install its app on each phone, subscribe to a topic name only the two of you know, and paste that topic below for each profile. "generate" fills in an unguessable one.</div>
        <div class="field">
          <label for="s-notify-topic-0">${escHtml(USERS[0])}'s topic</label>
          <div class="field-row">
            <input id="s-notify-topic-0" value="${escHtml((currentAccount.notifyTopics && currentAccount.notifyTopics[USERS[0]]) || '')}" autocomplete="off" placeholder="e.g. a random unguessable phrase" />
            <button type="button" class="mbtn" id="s-notify-gen-0">generate</button>
          </div>
        </div>
        <div class="field">
          <label for="s-notify-topic-1">${escHtml(USERS[1])}'s topic</label>
          <div class="field-row">
            <input id="s-notify-topic-1" value="${escHtml((currentAccount.notifyTopics && currentAccount.notifyTopics[USERS[1]]) || '')}" autocomplete="off" placeholder="e.g. a random unguessable phrase" />
            <button type="button" class="mbtn" id="s-notify-gen-1">generate</button>
          </div>
        </div>
        <div class="settings-msg" id="s-notify-msg"></div>
        <button class="mbtn mbtn-save settings-save-btn" id="s-save-notify">save</button>
      </div>
```

- [ ] **Step 2: Add the JS handlers**

Find the existing `// ── Connect Google ──` handler block (search for `const connectGoogleBtn`). Add this new block right after it ends (after its closing `}` and the `if (connectGoogleBtn) { ... }` block's closing brace):

```js
  // ── Phone notification topics ─────────────────────────────────────────────
  document.getElementById('s-notify-gen-0').onclick = () => {
    document.getElementById('s-notify-topic-0').value = shareToken();
  };
  document.getElementById('s-notify-gen-1').onclick = () => {
    document.getElementById('s-notify-topic-1').value = shareToken();
  };
  document.getElementById('s-save-notify').onclick = async () => {
    const topic0 = document.getElementById('s-notify-topic-0').value.trim();
    const topic1 = document.getElementById('s-notify-topic-1').value.trim();
    setMsg('s-notify-msg', 'saving…', false);
    const notifyTopics = { [USERS[0]]: topic0, [USERS[1]]: topic1 };
    const updatedAccount = { ...currentAccount, notifyTopics };
    delete updatedAccount.username;
    try {
      await saveAccountRecord(currentAccount.username, updatedAccount);
      currentAccount = { ...currentAccount, notifyTopics };
      setMsg('s-notify-msg', 'saved!', false);
    } catch (err) {
      setMsg('s-notify-msg', 'save failed: ' + err.message);
    }
  };
```

- [ ] **Step 3: Bump the cache-bust tag**

In `index.html`, find the `js/settings.js` script tag and bump its version to match this session's tag:

```html
<script src="js/settings.js?v=20260824-phone-notify"></script>
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all 8 checks pass. (`tests/core-tests.js` loads `js/settings.js` in a DOM-less VM context — confirm the new template string doesn't reference anything undefined in that context. If a test fails here, it's almost always a typo in the template literal; re-read Step 1's HTML exactly as written above.)

- [ ] **Step 5: Manually verify in a browser**

```bash
python3 -m http.server 8842
```

Open `http://localhost:8842`, log in as `testing`/`testing`, open Settings, scroll to "phone notifications." Click "generate" on the first field — confirm it fills with a 22-character random string. Type a topic in the second field manually. Click "save" — confirm "saved!" appears. Reload the page, reopen Settings — confirm both topics persisted (this proves the round-trip through `saveAccountRecord`/Firestore, not just local state).

- [ ] **Step 6: Commit**

```bash
git add js/settings.js index.html
git commit -m "feat(notify): add phone-notification topic settings"
```

---

### Task 5: Documentation

**Files:**
- Modify: `privacy.html`
- Modify: `docs/KNOWN-LIMITATIONS.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:** None — pure documentation, no code.

- [ ] **Step 1: Update the privacy policy**

In `privacy.html`, find the `<h2>Service providers</h2>` section. This feature sends a message containing the editing profile's name to a new third party whenever it's configured and used — the policy must say so. Change the paragraph in that section from:

```html
      <p>Twosday uses Firebase and Google Cloud for authentication and calendar storage, and Vercel for website hosting. These providers process information on Twosday's behalf to provide their services. Their handling of data is governed by their own terms and privacy documentation.</p>
```

to:

```html
      <p>Twosday uses Firebase and Google Cloud for authentication and calendar storage, and Vercel for website hosting. If you turn on phone notifications, the profile name of whoever made a change and the fact that a change occurred are sent to ntfy.sh, a third-party notification service, addressed only to a topic name you choose — Twosday does not send calendar content, event details, or account identifiers to ntfy.sh. These providers process information on Twosday's behalf to provide their services. Their handling of data is governed by their own terms and privacy documentation.</p>
```

- [ ] **Step 2: Update known limitations**

In `docs/KNOWN-LIMITATIONS.md`, under `## Calendar Behavior`, find the line about optional browser reminders (`- Optional browser reminders work only while Twosday is open...`) and add a new line right after it:

```markdown
- Phone notifications (Settings → phone notifications) fire only from the editing profile's own browser at the moment a real edit finishes syncing — if that browser is closed or crashes before the notification's quiet window elapses or the tab-close backstop fires, the notification is lost with no retry. Delivery also depends entirely on ntfy.sh's uptime and each profile correctly subscribing to their own topic in the ntfy app; Twosday has no way to confirm a notification was actually received.
```

- [ ] **Step 3: Update architecture notes**

In `docs/ARCHITECTURE.md`, under `## Core Workflows`, add a new bullet at the end of that list:

```markdown
- Phone notifications: `calendar-store.js`'s existing skip-no-op-write signature check is the single source of truth for "a real edit happened." `onRealSave` (an optional callback on `createCalendarStore`) fires from that exact point, wired in `state.js` to `notifications.js`'s `scheduleEditNotification`, which debounces a burst of edits into one push via ntfy.sh, backstopped by a tab-close/backgrounding listener set up in `app.js`.
```

- [ ] **Step 4: Commit**

```bash
git add privacy.html docs/KNOWN-LIMITATIONS.md docs/ARCHITECTURE.md
git commit -m "docs(notify): document the phone-notification feature and its limits"
```

---

### Task 6: End-to-end manual verification

**Files:** None modified — this task only verifies Tasks 1–5 work together for real.

**Interfaces:** None.

- [ ] **Step 1: Set up a real ntfy topic**

In a browser, go to `https://ntfy.sh/app` (the web viewer — no install needed for this test) and subscribe to a throwaway topic, e.g. `twosday-test-<random string>`. Keep that tab open.

- [ ] **Step 2: Configure Twosday to notify that topic**

```bash
python3 -m http.server 8842
```

Open `http://localhost:8842`, log in as `testing`/`testing`. Open Settings → phone notifications. In the field for whichever profile is NOT currently active (check the active profile in the header — you want to notify the *other* one, since edits from the active profile should notify the other side), paste the throwaway topic from Step 1. Save.

- [ ] **Step 3: Make a real edit and confirm exactly one notification arrives**

As the active profile, create a new event (use the `+` button or `n` shortcut), give it any name, save it. Then immediately edit its time and save again — two real edits within a few seconds, simulating a burst.

Watch the `ntfy.sh/app` tab from Step 1. Expected: **exactly one** notification arrives, roughly 4 seconds after the second edit (the quiet window), reading `"<active profile> made changes to the calendar"` — not two notifications.

- [ ] **Step 4: Confirm the tab-close backstop**

Make another edit, then immediately close the browser tab (before 4 seconds pass) instead of waiting. Expected: the notification still arrives promptly in the `ntfy.sh/app` tab — the `pagehide` backstop fired it early rather than losing it.

- [ ] **Step 5: Confirm pure navigation does NOT notify**

Reopen Twosday, log in again. Without creating/editing/deleting anything, just navigate between day/week/month views and click around for 10+ seconds. Expected: **no notification arrives** — this is the "not just checking" requirement, and it's enforced by `calendar-store.js`'s pre-existing signature-skip check, which Task 2 hooked into rather than reimplementing.

- [ ] **Step 6: Confirm an unconfigured topic fails silently**

Open Settings, clear both topic fields, save. Make a real edit. Expected: no error toast, no console error, sync still shows "synced" normally — the feature does nothing when unconfigured, exactly as designed.

- [ ] **Step 7: Clean up test data**

Delete the test event(s) created in Step 3/4 from the `testing` account so it's left in its original state.

---

## Self-Review

**Spec coverage:** ntfy.sh delivery (Task 1), no-backend/no-Blaze constraint (Global Constraints + Architecture — no server code anywhere in this plan), "real edits only" gate (Task 2, reuses existing signature check rather than reinventing), debounce-coalesce (Task 1's `scheduleEditNotification`), tab-close backstop (Task 1 + Task 3), per-profile opt-in configuration (Task 4), privacy/docs disclosure (Task 5), end-to-end proof (Task 6). All covered.

**Placeholder scan:** No TBD/TODO markers; every code step has complete, copy-pasteable code; every test has real assertions.

**Type consistency:** `otherProfileName`, `notifyTopicFor`, `editNotificationMessage`, `scheduleEditNotification`, `stopEditNotification`, `setupEditNotificationBackstop` are named identically everywhere they're defined (Task 1) and consumed (Tasks 2–3). `onRealSave` matches between its `calendar-store.js` definition (Task 2) and its `state.js` call site (Task 2) and its test harness (Task 2).

**Scope check:** Single subsystem, no decomposition needed. `stopEditNotification` is defined in Task 1 for symmetry/future use (e.g. a future "log out" cleanup) but isn't wired to a call site in this plan — noted here rather than left as a silent dangling export: wiring it into `logout()`/`resetCalendarStore()` in `auth.js` would be a one-line, low-risk follow-up, deliberately left out to keep this plan's blast radius to the notification feature itself.
