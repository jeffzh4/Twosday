# Twosday

A real-time shared calendar built for two people. Each account has two named profiles with independent themes — all synced instantly across devices via Firebase Firestore.

**Live:** [twosday-five.vercel.app](https://twosday-five.vercel.app) &nbsp;·&nbsp; try it with `testing` / `testing`

The demo account is preloaded with a full-year sample calendar so the collaboration, search, free-window finder, and insights dashboard all have realistic data to explore.

---

## Features

### Calendar views
- **Day** — single-day time grid, full 24 hours
- **Week** — 7-column grid, Sun–Sat
- **Month** — traditional monthly overview with event pills
- **Year** — 12 mini-months at a glance

Switch with the header buttons or keyboard shortcuts `d / w / m / y`.

### Events
- **Create** — click any time slot; double-click on the grid to create at that exact time
- **Import / Export** — main-header calendar tools make it easy to import `.ics` files from existing calendar apps or export `.ics` / `.csv` backups
- **Drag & drop** — move events freely across times and days
- **Resize** — drag the top or bottom handle to adjust start/end
- **Done** — mark events complete with a strikethrough; undo at any time
- **Colors** — 7 named presets (ROYGBIV), up to 7 saved custom hex colors per account, or auto-color based on keywords in the event title (`class` → violet, `meal` → green, `work` → blue, etc.)
- **Shared events** — toggle "shared" to mirror an event to both profiles and keep edits in sync automatically
- **Live presence** — see when the other profile is actively viewing the calendar, including their current view and date range
- **Update metadata** — event edits record who last updated them and when, visible in event details and hover context
- **Insights dashboard** — analyze scheduled hours, completion rate, shared time, category mix, weekly load, daypart rhythm, and profile balance
- **Repeat** — copy an event hourly, daily, weekly, or monthly with a live preview and checkbox selection before confirming
- **Conflict detection** — overlapping events on the same profile show a red inset shadow
- **Conflict center** — review all upcoming overlaps, jump to the day, edit the event, or open the free-window finder
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
- **Insights** — open the calendar insights dashboard from the stats section
- **Username** — change with password confirmation
- **Password** — change with current + new + confirm fields
- **Connect Google** — link a Google account for one-click sign-in on future logins
- **Profile names & emojis** — rename either profile and pick an emoji from a 15-option picker
- **Delete account** — permanently removes all Firestore data and clears local storage (type username to confirm)

### Real-time sync
Changes save to Firestore and propagate to all open sessions within ~1–2 seconds via `onSnapshot`. A thin sync bar appears during the initial load. Offline edits are preserved in `localStorage` and reconciled on reconnect.

### Accessibility
- Keyboard-operable day, week, month, and year calendars, including events and search results
- Focus-trapped dialogs that close with `Escape` and restore focus to their trigger
- Semantic tabs, forms, navigation landmarks, status announcements, and descriptive icon labels
- High-contrast focus indicators, improved secondary-text contrast, a skip link, and reduced-motion support

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, HTML5, CSS3 — no framework, no build step |
| Sync | Firebase Firestore (`onSnapshot` real-time listener) |
| Auth | Firebase Authentication with username-derived email credentials and optional linked Google sign-in |
| Authorization | Owner-scoped Firestore rules verified through the Firebase Emulator Suite |
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
├── tests/
│   ├── core-tests.js       # Node-based regression tests for core logic
│   └── firestore-rules-tests.js # Emulator-backed authorization tests
├── firestore.rules         # Owner isolation and document-shape validation
├── firebase.json           # Rules and Firestore Emulator configuration
├── ARCHITECTURE.md         # Data model, sync, and workflow notes
├── package.json            # Test script
└── js/
    ├── config.js           # Firebase init, shared constants
    ├── auth.js             # Login, signup, session management
    ├── state.js            # Global state, undo/redo stack, persistence
    ├── utils.js            # Date helpers, color logic, password hashing
    ├── events.js           # Create, edit, delete, drag-and-drop, conflict detection
    ├── modal.js            # Add/edit event modal (color picker, shared toggle)
    ├── repeat-modal.js     # Event repeat/duplication modal
    ├── import.js           # ICS parsing + import preview
    ├── conflicts.js        # Conflict center and overlap workflows
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

No build step is needed for the app. Install the test tooling, then open `index.html`:

```bash
git clone https://github.com/jeffzh4/Twosday.git
cd Twosday
npm install
open index.html
```

The app connects to Firebase on load. An internet connection is required to log in and sync; cached data is available offline after first load.

## Testing

```bash
npm test
```

`npm test` runs both the core logic suite and the Firestore Emulator authorization suite. The latter requires Java and verifies anonymous denial, account isolation, owner-only writes, immutable ownership, schema validation, and safe legacy migration.

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
| `Enter` / `Space` | Activate a focused date, event, result, tab, or calendar control |

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

// Account metadata — stored at accounts/{username}
account = {
  ownerUid: "firebase-auth-uid",
  password: "<sha256-hex>",
  profiles: ["alex", "jamie"],
  profileEmojis: ["☕", "🌙"],
  firestoreDoc: "myusername",
  notesDoc: "myusername-notes",
  createdAt: 1716230400000,
}

// Every synchronized data document repeats the ownership boundary
scheduleDocument = {
  ownerUid: "firebase-auth-uid",
  accountId: "myusername",
  allData: { /* ... */ }, // or notes / sessions for the companion docs
}
```

Firestore rules require `request.auth.uid` to match `ownerUid` for account metadata and calendar, notes, and presence documents. The previous shared account registry is authenticated and read-only, and exists only to migrate previously claimed accounts into the owner-scoped model.
