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

## Authentication and Authorization

Firebase Authentication is the credential source of truth. Account metadata lives at `accounts/{username}` with an immutable `ownerUid`; calendar, notes, and presence documents repeat that UID plus an `accountId`. Firestore rules permit access only when `request.auth.uid` matches the owner and the data document path matches the account metadata.

Previously claimed accounts are migrated after a successful Firebase Auth login. The old `schedules/accounts` registry is available only to authenticated users and is permanently read-only. `tests/firestore-rules-tests.js` verifies account privacy, data isolation, schema checks, owner immutability, and the migration path against the local Firestore Emulator.

## Accessibility

`makeModalAccessible()` supplies dialog semantics, focus trapping, `Escape` handling, and trigger-focus restoration across all modal workflows. Calendar dates, events, search results, profile tabs, and view tabs expose keyboard activation and accessible names. CSS provides consistent `:focus-visible` treatment, stronger text contrast, a skip link, and `prefers-reduced-motion` fallbacks.

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

Run both core and Firestore rules tests:

```bash
npm test
```
