# Twosday — Weekly Schedule App

## What This Is
A single-file HTML/JS/CSS web app (`schedule.html`) for two people — **Jeff** and **Helen** — to manage a shared weekly schedule. No build step; open the file directly in a browser.

## Architecture
- **Single file**: all HTML, CSS, and JS live in `schedule.html`
- **Backend**: Firebase Firestore (`jhschedule4` project) for real-time sync between users
- **Local persistence**: `localStorage` as a cache/fallback (`schedule_app_state_v1` key)
- **No framework**: vanilla JS, no bundler, no dependencies beyond Firebase SDK and Google Fonts (both CDN)

## Key Constants (top of `<script>`)
| Constant | Value | Meaning |
|---|---|---|
| `DAYS` | mon–sun | Day keys used throughout |
| `USERS` | jeff, helen | The two users |
| `START_H / END_H` | 7 / 23 | Visible hour range |
| `PX_PER_HOUR` | 60 | Grid pixel density |
| `STORAGE_KEY` | `schedule_app_state_v1` | localStorage key for schedules |
| `NOTES_STORAGE_KEY` | `schedule_notes_v1` | localStorage key for notes |

## Data Model
```
allWeeks: {
  "2026-W20": {
    jeff: { mon: [Event, ...], tue: [...], ... },
    helen: { mon: [Event, ...], ... }
  }, ...
}
```
**Event shape:**
```js
{
  id, text, start, end,   // start/end in decimal hours (e.g. 9.5 = 9:30am)
  done, shared, sharedId, // shared events are mirrored across both users
  color,                   // preset name ("purple", "blue", etc.) or null = auto
  recurrenceId, recurrenceDays  // set when event repeats across multiple days
}
```
Notes are stored separately in `userNotes: { jeff: [], helen: [] }` and synced to `schedules/shared-notes` in Firestore.

## Core Functions
- `render()` — full re-render: week nav, user switcher, day tabs, grid, history buttons, auto-save
- `renderGrid()` — builds the time-grid DOM; calls `renderDayColumn()` per visible day
- `openModal()` — add/edit event modal; handles conflict detection, shared sync, recurrence
- `syncSharedForUser()` — mirrors add/edit/delete/toggle-done of shared events to the other user
- `pushHistory() / undoAction() / redoAction()` — undo/redo stack (up to 80 snapshots)
- `saveToLocalStorage() / saveToFirestore()` — persistence; Firestore save is debounced 400ms
- `applyParsedData()` — merges loaded data into state; handles old single-week format too
- `startFirestoreListener()` — real-time listener; skips updates that originated locally
- `getWeekKey(offset)` — ISO week string like `"2026-W20"` used as storage key

## Color System
9 named presets (`COLOR_PRESETS`), each with separate `dark`/`light` variants. Auto-categorization maps keywords in event text → color:
- `class` → purple, `meal` → green, `social` → orange, `work` → blue, `other` → gray
- Shared events always use `SHARED_COLOR` (purple-ish)

## UI Features
- **Day / Week view toggle** — shows 1 or 7 columns
- **Per-user themes** — each user has their own dark/light preference, stored in `userTheme`
- **Week navigation** — prev/next/today buttons; each week stored separately
- **Drag-and-drop** — move events across days/times; resize from top or bottom handle
- **Conflict detection** — highlights overlapping events with a red inset box-shadow
- **Notes sidebar** — slides in from the right; per-user, Firestore-synced
- **Keyboard shortcuts** — Cmd/Ctrl+Z undo, Cmd/Ctrl+Y or Shift+Z redo, Esc closes modal
- **"Now" line** — yellow line showing current time, updates every 30s

## Firebase Config
Credentials are hardcoded in the file (public web config — fine for Firebase's security model; rules should be set in Firebase console). Project: `jhschedule4`. Firestore docs: `schedules/shared-schedule` (events) and `schedules/shared-notes` (notes).
