# Twosday — Shared Two-Person Calendar

## Development Guidelines

**Think before coding.** State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. Push back when a simpler approach exists. Ask only when a wrong guess is expensive or hard to reverse (data loss, public API changes, large rewrites); otherwise state the assumption and proceed.

**Simplicity first.** Minimum code that solves the problem — nothing speculative. No features beyond what was asked, no abstractions for single-use code, no error handling for impossible scenarios. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Surgical changes.** Touch only what you must. Don't improve adjacent code, don't refactor things that aren't broken, match existing style. Remove imports/variables/functions that *your* changes made unused — don't remove pre-existing dead code unless asked. Every changed line should trace directly to the request.

**Don't invent.** Verify functions, methods, and APIs exist before using them. Don't silently swallow errors. Update or remove comments your changes made stale.

**Goal-driven execution.** Define success criteria before starting. For multi-step tasks, state a brief plan with a verifiable check at each step. If no test harness exists, define success as a concrete observable check — a command to run, output to inspect, or state to confirm.

## What This Is
A multi-file HTML/JS/CSS web app for two people to manage a shared calendar. No build step; open `index.html` directly in a browser or deploy as a static site (currently on Vercel).

**Live:** https://twosday-five.vercel.app  
**Repo:** https://github.com/jeffzh4/Twosday

## Architecture
- **Multi-file vanilla JS** — no framework, no bundler. Scripts loaded in dependency order in `index.html`.
- **Backend:** Firebase Firestore for real-time sync. Each account writes to its own Firestore document.
- **Auth:** Custom username/password. Passwords are hashed client-side with SHA-256 (Web Crypto API) before storage. Legacy plaintext passwords auto-migrate to a hash on next successful login.
- **Local persistence:** `localStorage` as a cache/fallback. App is usable offline after first load.
- **Hosting:** Vercel — auto-deploys on push to `main`.

## File Structure
```
index.html              # App shell, landing screen, auth overlay
favicon.svg
firestore.rules         # Firestore security rules (defense-in-depth; see Auth System)
firebase.json           # Points the Firebase CLI at firestore.rules
css/
  style.css             # All styles: themes, grid, modals, mobile responsive
js/
  config.js             # Firebase init, shared constants (DAYS, COLOR_PRESETS, etc.)
  auth.js               # Login, signup, session management; sets per-account globals
  state.js              # Global state, undo/redo stack, localStorage + Firestore persistence
  utils.js              # Date helpers, uid(), color logic, password hashing, showToast()
  events.js             # Create/edit/delete events, drag-and-drop, conflict detection
  modal.js              # Add/edit event modal (color picker, shared toggle)
  repeat-modal.js       # Repeat-event modal (hourly/daily/weekly/monthly copies)
  find-time.js          # Mutual free-window detector (busy-interval merge across profiles)
  analytics.js          # Insights dashboard: KPIs, heatmap, category mix, weekly trend
  import.js             # ICS parsing, import preview, calendar tools modal
  conflicts.js          # Conflict center: collects/labels overlapping events across profiles
  demo-data.js          # Deterministic, idempotent seed data for the `testing` demo account
  presence.js           # Realtime "who's viewing" heartbeat (per-session, TTL-based)
  search.js             # Cross-date event search
  notes.js              # Notes panel (per-profile, Firestore-synced)
  settings.js           # Account settings modal (stats, export, emoji picker, delete)
  app.js                # Render loop, navigation, bootApp()
  views/
    day-week.js         # Day and week time-grid view + drag resize
    month.js            # Month calendar view
    year.js             # Year overview (12 mini-months)
tests/
  core-tests.js         # Node/VM regression tests for pure logic (no DOM)
scripts/
  seed-demo.html        # One-shot browser script to populate the demo account (gitignored)
```

## Key Globals (set by auth.js after login)
| Variable | Description |
|---|---|
| `USERS` | `[profile1, profile2]` — the two profile names for the logged-in account |
| `activeUser` | Currently selected profile name |
| `currentAccount` | `{ username, password, profiles, profileEmojis, firestoreDoc, notesDoc, authClaimed?, authUid?, authEmail?, googleLinked? }` |
| `FIRESTORE_DOC` | Firestore ref for the account's events doc |
| `NOTES_DOC` | Firestore ref for the account's notes doc |
| `PRESENCE_DOC` | Firestore ref for the account's presence doc (`{firestoreDoc}-presence`) |
| `STORAGE_KEY` | localStorage key for events (`twosday_v2_<username>`) |
| `NOTES_KEY` | localStorage key for notes (`twosday_notes_v2_<username>`) |
| `PRESENCE_KEY` | localStorage key for the local presence cache (`twosday_presence_v1_<username>`) |
| `CUSTOM_COLORS_KEY` | localStorage key for saved custom palette colors (`twosday_colors_v1_<username>`) |
| `CLIENT_ID` | Random per-tab id (state.js); tags every save so the Firestore listener can skip its own echo |

## Constants (config.js)
| Constant | Value | Meaning |
|---|---|---|
| `DAYS` | `['sun'…'sat']` | Day keys, week starts Sunday |
| `START_H / END_H` | `0 / 24` | Full 24-hour grid |
| `PX_PER_HOUR` | `60` | Grid pixel density |
| `STEP_H` | `0.25` | Snap resolution (15 min) |
| `COLOR_PRESETS` | 7 ROYGBIV + hidden gray | Named event colors |
| `SHARED_COLOR` | purple tint | Applied to shared events with no explicit color |

## Data Model
```js
// Events — keyed by ISO date string, then profile name
allData["2026-05-20"]["alex"] = [
  {
    id: "ev_...",
    text: "Team standup",
    start: 9.5,          // decimal hours: 9.5 = 9:30 am
    end: 10.0,
    done: false,
    shared: false,       // if true, mirrored to the other profile
    sharedId: null,      // links the two mirrored copies; null if not shared
    color: null,         // preset name ("red","blue"…), hex string ("#ff6b6b"), or null (auto)
    recurrenceId: null,  // set when event was created via repeat modal
  }
]

// Notes — per profile, stored in a separate Firestore document
userNotes["alex"] = [
  { text: "remember to...", time: 1716230400000 }
]

// Account record — stored in Firestore at schedules/accounts
accounts["myusername"] = {
  password: "<sha256-hex>",       // always kept in sync; the fallback of record
  profiles: ["alex", "jamie"],
  profileEmojis: ["☕", "🌙"],   // optional, empty string = no emoji
  firestoreDoc: "myusername",
  notesDoc: "myusername-notes",
  createdAt: 1716230400000,
  authClaimed: true,              // false/absent until Firebase Auth claims this account
  authUid: "abc123...",           // Firebase Auth user id, once claimed
  authEmail: "myusername@twosday.local",  // frozen at claim time — see Auth System
}
```

## Core Functions
| Function | Where | What it does |
|---|---|---|
| `bootApp()` | app.js | Wires all event listeners, loads data, starts Firestore listeners |
| `render()` | app.js | Full re-render: nav label, view switch, user tabs, current view |
| `renderGrid()` | views/day-week.js | Builds time-grid DOM for day/week view |
| `renderMonthView()` | views/month.js | Builds month calendar grid |
| `renderYearView()` | views/year.js | Builds 12 mini-month year overview |
| `openModal()` | modal.js | Add/edit event modal with color picker, repeat, conflict detection |
| `syncSharedEvent()` | events.js | Mirrors add/edit/delete of shared events to the other profile |
| `pushHistory() / undoAction() / redoAction()` | state.js | Undo/redo (up to 80 snapshots) |
| `saveToLocalStorage() / saveToFirestore()` | state.js | Persistence; Firestore save debounced 400ms |
| `applyParsedData()` | state.js | Merges loaded data into state; handles legacy week-keyed format |
| `showToast(msg, type)` | utils.js | Non-intrusive bottom notification (error / success / info) |
| `hashPassword(pwd)` | utils.js | SHA-256 hash via Web Crypto API; returns hex string (async) |
| `verifyPassword(input, stored)` | utils.js | Compares input against stored hash or legacy plaintext (async) |
| `activateAccount(username, account)` | auth.js | Sets all per-account globals after login |
| `claimFirebaseAuth(username, password)` | auth.js | Creates the Firebase Auth user for this account; throws on failure (non-fatal for callers) |
| `firebaseAuthSignIn(authEmail, password)` | auth.js | Signs in via Firebase Auth for already-claimed accounts |
| `handleGoogleSignIn(formId)` | auth.js | Login/signup "continue with Google" button; only logs in if a claimed account's `authUid` matches |
| `openSettingsModal()` | settings.js | Renders the account settings modal (stats, export, emoji, delete) |
| `computeStats()` | settings.js | Aggregates event counts / busiest day / top color across both profiles |
| `exportICS(user)` | settings.js | Downloads a profile's events as an RFC 5545 `.ics` file |
| `exportCSV(user)` | settings.js | Downloads a profile's events as a `.csv` file |
| `renameProfile(old, new)` | settings.js | Renames a profile across allData, userNotes, userTheme, USERS, activeUser |
| `findMutualFreeWindows(...)` | find-time.js | Finds shared open slots by merging both profiles' busy intervals |
| `getAnalyticsEvents(range, scope)` | analytics.js | Normalizes events for the insights dashboard, de-duping shared mirrors |
| `parseICSEvents(text)` | import.js | Parses raw `.ics` text into normalized event objects for the import preview |
| `collectConflicts({ range, userScope })` | conflicts.js | Scans all relevant event pairs, de-dupes shared/mirrored overlaps |
| `applyTestingDemoSeed()` | demo-data.js | Idempotently seeds the `testing` account; returns `false` if already seeded |
| `startPresence()` / `publishPresence()` | presence.js | Heartbeats this session's view/date into `PRESENCE_DOC` every 15s |

## Color System
- **ROYGBIV presets** — 7 named colors shown in the event modal picker
- **Custom colors** — up to 7 hex colors saved per account in `localStorage` (`CUSTOM_COLORS_KEY`); shown as a second row in the picker with × delete and + add buttons
- **Auto** — no explicit color; maps keywords in event text to a preset via `categorize()`
- **Shared indicator** — purple tint applied when `ev.shared && !ev.color`
- `palette(ev)` resolution order: explicit `ev.color` → shared indicator → auto-category

## Auth System
- Accounts stored in Firestore `schedules/accounts` as `{ accounts: { [username]: {...} }, savedAt }`
- Passwords hashed with SHA-256 (Web Crypto API) before storage. `isHashed(str)` checks for a 64-char hex string. `verifyPassword` supports both hashed and legacy plaintext for seamless migration.
- Each account has two profiles, optional profile emojis, its own Firestore events doc, a separate notes doc, presence doc, and scoped localStorage keys.
- Session persisted in `localStorage` (`twosday_session_v1`) for instant reload without re-fetching Firestore.
- `ACCOUNTS_DOC` is a function `() => db.collection('schedules').doc('accounts')` — called fresh each time to avoid stale refs.

### Firebase Auth claim layer
- Firebase Authentication (email/password provider) sits on top of the account record as the credential verifier, added without touching any calendar/notes/presence document — those still live at the same `schedules/{firestoreDoc}` paths, keyed by username, regardless of auth path.
- **Synthetic email:** Firebase Auth requires an email; `syntheticEmail(username)` produces `{username}@twosday.local` (never emailed anywhere). This is fixed at claim time and stored as `account.authEmail`, so a later username rename (`renameProfile`) can't orphan the Firebase Auth login — sign-in always uses the frozen `authEmail`, never re-derived from the current username.
- **Claim on login (existing accounts):** on a successful legacy hash check, `claimFirebaseAuth(username, password)` creates a Firebase Auth user and the account record is patched with `authClaimed: true, authUid, authEmail` in the same Firestore write as any pending plaintext→hash migration. Claiming is **non-fatal** — if it fails (most commonly because the Email/Password provider isn't yet enabled in the Firebase Console), the account simply stays on the legacy path and claiming retries on the next login. The app is fully functional with zero accounts claimed.
- **Claim on signup (new accounts):** `claimFirebaseAuth` runs immediately after building the new account record, before the single Firestore write — new accounts go straight to Firebase Auth and never touch the legacy hash-check path (unless claiming fails, same non-fatal fallback).
- **Subsequent logins:** if `account.authClaimed`, sign-in goes through `firebaseAuthSignIn(account.authEmail, password)` exclusively — the legacy hash is not re-checked, though it stays in sync (see below) as the fallback of record.
- **Password change / delete account** (`settings.js`): the legacy hash is always the field settings.js itself verifies and updates. For claimed accounts, `firebase.auth().currentUser.updatePassword()` / `.delete()` are called as best-effort side effects to keep the Auth user in sync — failures there don't block the primary Firestore write.
- **One manual step required, not automatable from code:** the Email/Password sign-in provider must be enabled once in the Firebase Console (Authentication → Sign-in method) for project `jhschedule4`. Until then, every claim/sign-in call rejects with `auth/operation-not-allowed` and the app gracefully continues on the legacy path — no user-visible breakage either way.
- **Password minimum is 6 characters** (signup and settings password-change), matching Firebase Auth's hard, non-configurable floor. An account whose legacy password is shorter than 6 characters will fail to claim (`auth/weak-password`, caught non-fatally) on every login until the password is changed to 6+ characters via Settings — the *next* login after that change completes the claim.
- **Google sign-in is account-linking only, not a signup path — by design, exactly one Google account per (two-profile) login.** Because Twosday's accounts are shared units, not 1:1 with a person, a fresh Google identity has no way to know which existing account it belongs to, and Firebase Auth's `linkWithPopup` only has room for one linked Google identity per Firebase Auth user anyway. So: `handleGoogleSignIn(formId)` — present as a "continue with Google" button on **both** the login and signup tabs (`formId` routes status text to the right tab's error slot) — looks up `accounts[*].authUid === <signed-in Google uid>` and logs in only if a match exists; a brand-new Google identity gets "no account linked yet" on either tab, never a new account. Linking itself happens from Settings → "connect Google" (`currentAccount.authClaimed` required), via `firebase.auth().currentUser.linkWithPopup(GoogleAuthProvider)`, which attaches Google to the same Firebase Auth user created at claim time — same `authUid`, so the login/signup lookup works either way. Both partners keep normal username/password login regardless of whether Google is connected.
- **Security posture:** `firestore.rules` confines access to the `schedules` collection, validates document shape, and blocks deletion of the shared `accounts` registry — defense-in-depth against corruption/abuse. Firestore rules still don't enforce per-account ownership (`request.auth.uid`), since document paths are keyed by username, not Firebase Auth UID, and rewriting that path scheme is a separate, deliberately out-of-scope follow-up once accounts are broadly claimed.

## Testing
- `tests/core-tests.js` loads the browser modules into a Node `vm` context (stubbed `document`, real `Date`) and exercises pure logic only — no DOM assertions.
- Run with `npm test`. Covers: date helpers, shared-event mirroring, undo/redo, sync-signature dedup, password-hash guard, stats aggregation, ICS formatting, profile rename, demo-seed idempotency, free-window detection, analytics aggregation, ICS parsing, and conflict collection.
- Values returned from `exec()` (vm-context objects) live in a separate JS realm from the test file — compare arrays/objects with the `plain()` helper (`JSON.parse(JSON.stringify(...))`) before `assert.deepStrictEqual`, not directly, or the comparison spuriously fails on prototype identity.

## UI Features
- **Landing screen** — wordmark + tagline with fade-in animation before the login card
- **Four views** — day, week (time grid), month, year. Keyboard: `d/w/m/y`
- **Week starts Sunday** — all grids and month calendars are Sun–Sat
- **Drag-and-drop** — move events, resize from top/bottom handle
- **Conflict detection** — red inset shadow on overlapping events for the same profile; shared-event mirror copy excluded from its own conflict check
- **Undo/redo** — `Cmd+Z` / `Cmd+Y`; up to 80 snapshots
- **Search** — `/` key; full-text search across all dates for the active profile
- **Notes sidebar** — per-profile, slides in from right, Firestore-synced, inline edit on double-click
- **Now line** — accent-colored line at current time, repositions every 30s
- **Sync bar** — thin animated bar at the top during initial Firestore fetch
- **Toast notifications** — bottom-center pop-up for sync errors and success messages
- **Mobile responsive** — day view default on ≤640px, touch-friendly action buttons, horizontal-scroll week grid
- **Find time** — mutual free-window finder across both profiles, filterable by duration/date range
- **Conflict center** — lists all overlapping events (same-profile and shared), links back to edit or find-time
- **ICS import/export** — import events from an external `.ics`, or export a profile's calendar as `.ics`/`.csv`
- **Insights dashboard** — scheduled hours, completion rate, category mix, weekly load, daypart heatmap, profile balance
- **Live presence** — shows when the other profile is actively viewing, their current view/date range
- **Account settings modal** (⚙ gear in user pill):
  - Stats cards (total, this month, shared, completed) + busiest day + top color badges
  - Username change (requires current password)
  - Password change (requires current + new + confirm)
  - Profile rename + emoji picker (15 presets, `position:fixed` popover to avoid scroll clipping)
  - Data export — `.ics` (RFC 5545, importable into Google/Apple Calendar) or `.csv`
  - Danger zone — permanent account deletion with username confirmation
- **Demo account** — `testing / testing` with pre-seeded realistic events across both profiles

## Script Load Order (index.html)
config → utils → state → presence → demo-data → events → modal → repeat-modal → find-time → analytics → import → conflicts → search → views/* → notes → settings → app → auth

`auth.js` must be last: its `DOMContentLoaded` handler calls `bootApp()` after login.
