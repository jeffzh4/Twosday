# Twosday

A real-time shared calendar built for two people. Each account has two named profiles with independent themes — all synced instantly across devices via Firebase Firestore.

**Live:** [twosday-five.vercel.app](https://twosday-five.vercel.app) &nbsp;·&nbsp; try it with `testing` / `testing`

---

## Features

### Calendar views
- **Day** — single-day time grid, full 24 hours
- **Week** — 7-column grid, Sun–Sat
- **Month** — traditional monthly overview with event pills
- **Year** — 12 mini-months at a glance

Switch with the header buttons or keyboard shortcuts `d / w / m / y`.

### Events
- **Create** — click any time slot or the `+ add event` button; double-click on the grid to create at that exact time
- **Drag & drop** — move events freely across times and days
- **Resize** — drag the top or bottom handle to adjust start/end
- **Done** — mark events complete with a strikethrough; undo at any time
- **Colors** — 7 named presets (ROYGBIV), up to 7 saved custom hex colors per account, or auto-color based on keywords in the event title (`class` → violet, `meal` → green, `work` → blue, etc.)
- **Shared events** — toggle "shared" to mirror an event to both profiles and keep edits in sync automatically
- **Repeat** — copy an event hourly, daily, weekly, or monthly with a live preview and checkbox selection before confirming
- **Conflict detection** — overlapping events on the same profile show a red inset shadow
- **Undo / Redo** — full history stack up to 80 snapshots (`Cmd+Z` / `Cmd+Y`)

### Two-profile system
Every account has exactly two named profiles (e.g. alex and jamie). Profiles have:
- Independent dark / light themes
- Independent event lists (with opt-in sharing)
- Optional emoji shown next to the profile tab
- Per-profile notes panels

### Notes
A slide-in panel (per profile) for quick freeform text. Double-click a note to edit it inline. Synced to Firestore alongside events.

### Search
Press `/` or click the search icon to search all events by text across all dates. Click a result to jump to that day.

### Account settings
Accessible via the ⚙ gear icon in the top-right user pill:

- **Stats** — total events, this month, shared, completed, busiest day, top color
- **Username** — change with password confirmation
- **Password** — change with current + new + confirm fields
- **Profile names & emojis** — rename either profile and pick an emoji from a 15-option picker
- **Export** — download either profile's events as `.ics` (Google / Apple Calendar) or `.csv` (spreadsheet)
- **Delete account** — permanently removes all Firestore data and clears local storage (type username to confirm)

### Real-time sync
Changes save to Firestore and propagate to all open sessions within ~1–2 seconds via `onSnapshot`. A thin sync bar appears during the initial load. Offline edits are preserved in `localStorage` and reconciled on reconnect.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, HTML5, CSS3 — no framework, no build step |
| Sync | Firebase Firestore (`onSnapshot` real-time listener) |
| Auth | Custom username/password; passwords hashed with SHA-256 (Web Crypto API) |
| Persistence | `localStorage` as cache and offline fallback |
| Hosting | Vercel — auto-deploys on push to `main` |
| Fonts | DM Sans + DM Mono (Google Fonts) |

---

## Project structure

```
Twosday/
├── index.html              # App shell, landing screen, auth overlay
├── favicon.svg
├── css/
│   └── style.css           # All styles: themes, grid, modals, mobile
└── js/
    ├── config.js           # Firebase init, shared constants
    ├── auth.js             # Login, signup, session management
    ├── state.js            # Global state, undo/redo stack, persistence
    ├── utils.js            # Date helpers, color logic, password hashing
    ├── events.js           # Create, edit, delete, drag-and-drop, conflict detection
    ├── modal.js            # Add/edit event modal (color picker, shared toggle)
    ├── repeat-modal.js     # Event repeat/duplication modal
    ├── search.js           # Cross-date event search
    ├── notes.js            # Notes panel (per-profile, Firestore-synced)
    ├── settings.js         # Account settings modal (stats, export, emoji picker, delete)
    ├── app.js              # Render loop, navigation, bootApp()
    └── views/
        ├── day-week.js     # Day and week time-grid + drag resize
        ├── month.js        # Month view
        └── year.js         # Year overview
```

---

## Running locally

No build step needed — just open `index.html` in a browser:

```bash
git clone https://github.com/jeffzh4/Twosday.git
cd Twosday
open index.html
```

The app connects to Firebase on load. An internet connection is required to log in and sync; cached data is available offline after first load.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `d` / `w` / `m` / `y` | Switch to day / week / month / year view |
| `←` / `→` | Navigate backward / forward |
| `/` | Open search |
| `Cmd+Z` | Undo |
| `Cmd+Y` or `Cmd+Shift+Z` | Redo |
| `Escape` | Close any open modal |

---

## Data model

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
    sharedId: null,      // links the two mirrored copies
    color: null,         // preset name, hex string "#rrggbb", or null (auto)
    recurrenceId: null,  // non-null when created via the repeat modal
  }
]

// Notes — per profile, stored in a separate Firestore document
userNotes["alex"] = [
  { text: "remember to...", time: 1716230400000 }
]

// Accounts — stored in Firestore at schedules/accounts
accounts["myusername"] = {
  password: "<sha256-hex>",
  profiles: ["alex", "jamie"],
  profileEmojis: ["☕", "🌙"],
  firestoreDoc: "myusername",
  notesDoc: "myusername-notes",
  createdAt: 1716230400000,
}
```

Each account writes to its own Firestore document, so accounts are fully isolated from one another.
