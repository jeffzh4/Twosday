# Twosday — Shared Two-Person Calendar

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
  search.js             # Cross-date event search
  notes.js              # Notes panel (per-profile, Firestore-synced)
  settings.js           # Account settings modal (stats, export, emoji picker, delete)
  app.js                # Render loop, navigation, bootApp()
  views/
    day-week.js         # Day and week time-grid view + drag resize
    month.js            # Month calendar view
    year.js             # Year overview (12 mini-months)
scripts/
  seed-demo.html        # One-shot browser script to populate the demo account (gitignored)
```

## Key Globals (set by auth.js after login)
| Variable | Description |
|---|---|
| `USERS` | `[profile1, profile2]` — the two profile names for the logged-in account |
| `activeUser` | Currently selected profile name |
| `currentAccount` | `{ username, password, profiles, profileEmojis, firestoreDoc, notesDoc }` |
| `FIRESTORE_DOC` | Firestore ref for the account's events doc |
| `NOTES_DOC` | Firestore ref for the account's notes doc |
| `STORAGE_KEY` | localStorage key for events (`twosday_v2_<username>`) |
| `NOTES_KEY` | localStorage key for notes (`twosday_notes_v2_<username>`) |
| `CUSTOM_COLORS_KEY` | localStorage key for saved custom palette colors (`twosday_colors_v1_<username>`) |

## Constants (config.js)
| Constant | Value | Meaning |
|---|---|---|
| `DAYS` | `['sun'…'sat']` | Day keys, week starts Sunday |
| `START_H / END_H` | `0 / 24` | Full 24-hour grid |
| `PX_PER_HOUR` | `60` | Grid pixel density |
| `STEP_H` | `0.5` | Snap resolution (30 min) |
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
  password: "<sha256-hex>",
  profiles: ["alex", "jamie"],
  profileEmojis: ["☕", "🌙"],   // optional, empty string = no emoji
  firestoreDoc: "myusername",
  notesDoc: "myusername-notes",
  createdAt: 1716230400000,
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
| `openSettingsModal()` | settings.js | Renders the account settings modal (stats, export, emoji, delete) |
| `computeStats()` | settings.js | Aggregates event counts / busiest day / top color across both profiles |
| `exportICS(user)` | settings.js | Downloads a profile's events as an RFC 5545 `.ics` file |
| `exportCSV(user)` | settings.js | Downloads a profile's events as a `.csv` file |
| `renameProfile(old, new)` | settings.js | Renames a profile across allData, userNotes, userTheme, USERS, activeUser |

## Color System
- **ROYGBIV presets** — 7 named colors shown in the event modal picker
- **Custom colors** — up to 7 hex colors saved per account in `localStorage` (`CUSTOM_COLORS_KEY`); shown as a second row in the picker with × delete and + add buttons
- **Auto** — no explicit color; maps keywords in event text to a preset via `categorize()`
- **Shared indicator** — purple tint applied when `ev.shared && !ev.color`
- `palette(ev)` resolution order: explicit `ev.color` → shared indicator → auto-category

## Auth System
- Accounts stored in Firestore `schedules/accounts` as `{ accounts: { [username]: {...} }, savedAt }`
- Passwords hashed with SHA-256 (Web Crypto API) before storage. `isHashed(str)` checks for a 64-char hex string. `verifyPassword` supports both hashed and legacy plaintext for seamless migration.
- On successful login with a plaintext password, the hash is silently written back to Firestore.
- Each account has two profiles, optional profile emojis, its own Firestore events doc, a separate notes doc, and scoped localStorage keys.
- Session persisted in `localStorage` (`twosday_session_v1`) for instant reload without re-fetching Firestore.
- `ACCOUNTS_DOC` is a function `() => db.collection('schedules').doc('accounts')` — called fresh each time to avoid stale refs.

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
- **Account settings modal** (⚙ gear in user pill):
  - Stats cards (total, this month, shared, completed) + busiest day + top color badges
  - Username change (requires current password)
  - Password change (requires current + new + confirm)
  - Profile rename + emoji picker (15 presets, `position:fixed` popover to avoid scroll clipping)
  - Data export — `.ics` (RFC 5545, importable into Google/Apple Calendar) or `.csv`
  - Danger zone — permanent account deletion with username confirmation
- **Demo account** — `testing / testing` with pre-seeded realistic events across both profiles

## Script Load Order (index.html)
config → utils → state → events → modal → repeat-modal → search → views/* → notes → settings → app → auth

`auth.js` must be last: its `DOMContentLoaded` handler calls `bootApp()` after login.
