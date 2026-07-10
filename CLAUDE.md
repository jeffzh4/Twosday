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
- **Auth:** Firebase Authentication verifies username-derived email/password credentials and optional linked Google sign-in. Firestore rules enforce per-account ownership through `request.auth.uid`.
- **Local persistence:** `localStorage` as a cache/fallback. App is usable offline after first load.
- **Hosting:** Vercel — auto-deploys on push to `main`.

## File Structure
```
index.html              # App shell, landing screen, auth overlay
favicon.svg
firestore.rules         # Owner-scoped account and schedule authorization
firebase.json           # Rules + local Firestore Emulator configuration
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
  firestore-rules-tests.js # Emulator-backed authorization tests
scripts/
  seed-demo.html        # One-shot browser script to populate the demo account (gitignored)
```

## Key Globals (set by auth.js after login)
| Variable | Description |
|---|---|
| `USERS` | `[profile1, profile2]` — the two profile names for the logged-in account |
| `activeUser` | Currently selected profile name |
| `currentAccount` | `{ username, ownerUid, password, profiles, profileEmojis, firestoreDoc, notesDoc, authUid, authEmail, googleLinked? }` |
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

// Account record — stored at accounts/{username}
account = {
  ownerUid: "abc123...",          // immutable Firebase Auth ownership boundary
  password: "<sha256-hex>",       // used to confirm sensitive settings changes
  profiles: ["alex", "jamie"],
  profileEmojis: ["☕", "🌙"],   // optional, empty string = no emoji
  firestoreDoc: "myusername",
  notesDoc: "myusername-notes",
  createdAt: 1716230400000,
  authClaimed: true,
  authUid: "abc123...",
  authEmail: "myusername@twosday.local",
}

// Calendar, notes, and presence documents repeat ownership metadata
scheduleDocument = { ownerUid: "abc123...", accountId: "myusername", /* data map */ }
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
| `activateAccount(username, account)` | auth.js | Sets all per-account globals after ownership is verified |
| `prepareAccount(username, account)` | auth.js | Verifies the Auth UID and claims/migrates the three data documents |
| `claimFirebaseAuth(username, password)` | auth.js | Creates the Firebase Auth user for a new or cached legacy account |
| `firebaseAuthSignIn(authEmail, password)` | auth.js | Signs in through Firebase Auth |
| `handleGoogleSignIn(formId)` | auth.js | Resolves a linked Google identity through an owner-filtered account query |
| `makeModalAccessible(bg, options)` | utils.js | Adds dialog semantics, focus trap, Escape close, and focus restoration |
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
- Account metadata lives at `accounts/{username}` and carries immutable `ownerUid`, `authUid`, and username-derived `authEmail` fields.
- Firebase Authentication is required before cloud data is loaded. New accounts fail closed if Auth cannot be created; there is no anonymous Firestore fallback.
- Calendar, notes, and presence documents carry `ownerUid` and `accountId`. Rules verify both the Auth UID and that each document path matches the account's configured data paths.
- Previously claimed accounts migrate after a successful Firebase Auth login. The old `schedules/accounts` registry is authenticated, permanently read-only, and used only as the migration source.
- A legacy account cached on the same browser can be verified locally, claimed into Firebase Auth, and migrated without exposing the old registry anonymously.
- Username and password changes reauthenticate first. Username changes update the synthetic Auth email; password changes update Firebase Auth and the confirmation hash together, with rollback attempts on failed persistence.
- Google remains an account-linking sign-in path. The current product model links one Google identity to the shared two-profile account; multi-identity and partner-level permissions are deferred product decisions.
- Session state remains in `localStorage`, but account restoration waits for Firebase Auth and verifies `account.ownerUid === currentUser.uid` before booting.

## Testing
- `tests/core-tests.js` loads the browser modules into a Node `vm` context (stubbed `document`, real `Date`) and exercises pure logic only — no DOM assertions.
- `tests/firestore-rules-tests.js` runs against the Firestore Emulator and verifies anonymous denial, account privacy, owner-only data access, immutable ownership, schema/path validation, and safe legacy claiming.
- Run both suites with `npm test` (Java is required for the emulator).
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
