# Twosday Architecture

Twosday is a no-build vanilla JavaScript app with one HTML shell, one stylesheet, and small feature modules loaded in dependency order. The code intentionally keeps app state in plain objects so calendar behavior is easy to inspect in the browser and simple to sync to Firestore.

## Data Model

Events are stored by date and profile:

```js
allData["2026-06-14"]["alex"] = [
  { id, text, start, end, done, shared, sharedId, color, recurrenceId, updatedAt, updatedBy }
]
```

Times are decimal hours, so `9.5` means 9:30 AM. Shared events are mirrored into both profiles and linked by `sharedId`.

## Sync

Each account maps to three Firestore documents:

- calendar data: events, themes, save timestamp, writer client id
- notes data: per-profile notes
- presence data: active browser sessions, current view, and heartbeat timestamp

The calendar listener ignores its own client echo, while applying remote saves from other sessions. Local storage is used as a fast cache and offline fallback.

## Core Workflows

- Event editing flows through `modal.js`, `events.js`, and `state.js`.
- Shared-event writes call `syncSharedEvent` so mirrored copies stay aligned.
- Free-window detection unions both profiles' busy intervals, de-dupes shared mirrors, and finds gaps.
- Analytics reads normalized events into derived metrics without mutating calendar state.
- ICS import parses VEVENT records, previews them, then imports selected events through the same normalized event path.
- Conflict center scans all relevant event pairs, de-dupes mirrored/shared overlaps, and links users back to edit or find-time flows.

## Testing

`tests/core-tests.js` runs pure logic checks in Node using the browser modules inside a VM context. It focuses on logic that is easy to regress:

- date keys and month grids
- shared-event mirroring (add/edit/toggle-done/delete) and undo/redo
- Firestore sync-signature dedup and password-hash guard
- account stats aggregation, ICS datetime formatting, profile rename
- demo-seed idempotency (safe to call `applyTestingDemoSeed()` repeatedly)
- busy interval merging and free-window search
- analytics aggregation
- ICS parsing
- conflict collection

Run:

```bash
node tests/core-tests.js
```
