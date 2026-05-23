# Twosday — Shared Two-Person Calendar

## What This Is
A multi-file HTML/JS/CSS web app for two people to manage a shared calendar. No build step; open `index.html` directly in a browser or deploy as a static site (currently on Vercel).

**Live:** https://twosday-five.vercel.app  
**Repo:** https://github.com/jeffzh4/Twosday

## Architecture
- **Multi-file vanilla JS** — no framework, no bundler. Scripts loaded in dependency order in `index.html`.
- **Backend:** Firebase Firestore for real-time sync. Each account writes to its own Firestore document.
- **Auth:** Custom username/password stored in `schedules/accounts` in Firestore (plaintext — intentional for a small trusted-circle app).
- **Local persistence:** `localStorage` as a cache/fallback. App is usable offline after first load.
- **Hosting:** Vercel — auto-deploys on push to `main`.

## File Structure
```
index.html              # App shell + auth overlay
favicon.svg / favicon.png
css/
  style.css             # All styles: themes, grid, modals, mobile responsive
js/
  config.js             # Firebase init, shared constants (DAYS, COLOR_PRESETS, etc.)
  auth.js               # Login, signup, session management; sets per-account globals
  state.js              # Global state, undo/redo stack, localStorage + Firestore persistence
  utils.js              # Date helpers, uid(), color logic, showToast()
  events.js             # Create/edit/delete events, drag-and-drop, conflict detection
  modal.js              # Add/edit event modal (color picker, repeat, shared toggle)
  repeat-modal.js       # Repeat-event modal (hourly/daily/weekly/monthly copies)
  search.js             # Cross-date event search
  notes.js              # Notes panel (per-profile, Firestore-synced)
  app.js                # Render loop, navigation, bootApp()
  views/
    day-week.js         # Day and week time-grid view + drag resize
    month.js            # Month calendar view
    year.js             # Year overview (12 mini-months)
```

## Key Globals (set by auth.js after login)
| Variable | Description |
|---|---|
| `USERS` | Array of two profile names for the logged-in account |
| `activeUser` | Currently selected profile name |
| `FIRESTORE_DOC` | Firestore ref for the account's events doc |
| `NOTES_DOC` | Firestore ref for the account's notes doc |
| `STORAGE_KEY` | localStorage key for events (`twosday_v2_<username>`) |
| `NOTES_KEY` | localStorage key for notes |
| `CUSTOM_COLORS_KEY` | localStorage key for saved custom palette colors |

## Constants (config.js)
| Constant | Value | Meaning |
|---|---|---|
| `DAYS` | sun–sat | Day keys, week starts Sunday |
| `START_H / END_H` | 0 / 24 | Full 24-hour grid |
| `PX_PER_HOUR` | 60 | Grid pixel density |
| `STEP_H` | 0.5 | Snap resolution (30 min) |
| `COLOR_PRESETS` | 7 ROYGBIV + hidden gray | Named event colors |

## Data Model
```js
// Events — keyed by ISO date string, then profile name
allData["2026-05-20"]["jeff"] = [
  {
    id: "ev_...",
    text: "Team standup",
    start: 9.5,          // decimal hours: 9.5 = 9:30 am
    end: 10.0,
    done: false,
    shared: false,       // if true, mirrored to the other profile
    sharedId: null,      // links the two mirrored copies; null if not shared
    color: null,         // preset name ("red","blue"…), hex string ("#ff6b6b"), or null (auto)
    recurrenceId: null,  // set when event was created via repeat
  }
]

// Notes — per profile, stored separately in Firestore
userNotes["jeff"] = [
  { text: "remember to...", time: 1716230400000 }
]
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
| `showToast(msg, type)` | utils.js | Non-intrusive bottom notification for errors/success |
| `activateAccount()` | auth.js | Sets all per-account globals after login |

## Color System
- **ROYGBIV presets** — 7 named colors (red, orange, yellow, green, blue, indigo, violet) shown in the event modal
- **Custom colors** — up to 7 hex colors saved per account in `localStorage` (`CUSTOM_COLORS_KEY`)
- **Auto** — no explicit color; maps keywords in event text to a preset via `categorize()`
- **Shared events** — use a fixed shared-indicator color when no explicit color is set
- `palette(ev)` resolves the final color: explicit `ev.color` always wins, then shared indicator, then auto-category

## Auth System
- Accounts stored in Firestore `schedules/accounts` as `{ accounts: { [username]: {...} } }`
- Built-in accounts (JHadmin, testing) stored in Firestore too — no credentials in source code
- Each account has two profiles, its own Firestore doc, and scoped localStorage keys
- Session persisted in `localStorage` (`twosday_session_v1`) for instant reload

## UI Features
- **Four views** — day, week (time grid), month, year. Keyboard: `d/w/m/y`
- **Week starts Sunday** — all grids and month calendars are Sun–Sat
- **Drag-and-drop** — move events, resize from top/bottom handle
- **Conflict detection** — red inset shadow on overlapping events; excludes shared-event mirror from check
- **Undo/redo** — `Cmd+Z` / `Cmd+Y`; up to 80 snapshots
- **Search** — `/` key; searches all dates for the active profile
- **Notes sidebar** — per-profile, slides in from right, Firestore-synced
- **Now line** — yellow line at current time, updates every 30s
- **Mobile responsive** — day view default on small screens, touch-friendly events, horizontal scroll for week grid
- **Toast errors** — non-intrusive notification when Firestore sync fails
