# Twosday Architecture

Twosday is a no-build vanilla JavaScript app with one HTML shell, one stylesheet, and small feature modules loaded in dependency order. The code intentionally keeps app state in plain objects so calendar behavior is easy to inspect in the browser and simple to sync to Firestore.

## Data Model

Events are stored by date and profile:

```js
allData["2026-06-14"]["alex"] = [
  { id, text, start, end, done, shared, sharedId, color, recurrenceId, recurrence, updatedAt, updatedBy }
]
```

Times are decimal hours, so `9.5` means 9:30 AM. Shared events are mirrored into both profiles and linked by `sharedId`. Recurring events are materialized instances that share a `recurrenceId` and each carry the `recurrence` rule, so edit/delete can act on a single occurrence, this-and-following, or the whole series (see `recurrence.js`).

Two more append-only structures travel with the calendar:

- `tombstones` — `{ eventId: deletedAt }`, so a concurrent merge cannot resurrect a deleted event.
- `auditLog` — a capped, newest-first list of every mutation (`reconcile.js`/`audit.js`).

## Sync and Conflict Reconciliation

Each account maps to three Firestore documents:

- calendar data: events, themes, tombstones, audit log, save timestamp, writer client id
- notes data: per-profile notes
- presence data: active browser sessions, current view, and heartbeat timestamp

`calendar-store.js` is the persistence seam. Its `CalendarStore` interface coordinates a local-storage cache adapter and a Firestore adapter, owns debounced writes and duplicate-write suppression, and bounds reconvergence attempts. `state.js` supplies the calendar-shaped payload plus the pure reconciliation callback; view modules never talk to either adapter directly.

The Firestore adapter ignores its own client echo. Remote snapshots are **merged**, not applied wholesale, so two profiles editing at once no longer clobber each other. `mergeCalendars` (in `reconcile.js`) is a last-write-wins element-set CRDT keyed by event id: for an id on both sides the higher `updatedAt` wins, ties break deterministically on serialized form (so both clients converge regardless of arrival order), and tombstones suppress ids the other side deleted. The merge is a pure, idempotent, order-independent function — after merging, a client whose result differs from the remote document writes the merged state back so both sides settle on the same state. A fallback applies the remote snapshot if reconciliation itself throws. Audit logs merge by union of entry ids.

## Authentication and Authorization

Firebase Authentication is the credential source of truth. Account metadata lives at `accounts/{username}` with an immutable `ownerUid`; calendar, notes, and presence documents repeat that UID plus an `accountId`. Firestore rules permit access only when `request.auth.uid` matches the owner and the data document path matches the account metadata.

The former `schedules/accounts` registry stored multiple users' account metadata in one document. Firestore Rules cannot return only selected fields of a document, so the registry is retired and denied to every client. Current account records are owner-scoped at `accounts/{username}` and do not contain password hashes. `tests/firestore-rules-tests.js` verifies account privacy, data isolation, schema checks, owner immutability, token validation, and registry denial against the local Firestore Emulator.

## Security Boundaries

- Firebase Authentication owns password verification and account credentials. Calendar metadata and browser storage do not retain password hashes.
- `auth.js` uses an escalating local retry delay after five failed authentication requests. This protects ordinary browser usage against rapid retries; it is not a server-side bot control.
- Firestore Rules enforce owner UID equality for every account, calendar, note, and presence document. Public access is limited to direct reads of unguessable, time-limited event-share tokens; collection queries remain denied.
- `config.js` initializes Firebase only on `twosday.dev`, `www.twosday.dev`, or local development hosts. Alternate Vercel hostnames redirect to the canonical domain before a Firebase client is initialized.
- `vercel.json` applies baseline browser security headers. Preview access must also be protected in Vercel's Deployment Protection settings.
- Firebase App Check is a required launch operation, not a client-side fallback: configure reCAPTCHA Enterprise, then enforce App Check for Firestore and Firebase Authentication before enabling public registration.

## Accessibility

`makeModalAccessible()` supplies dialog semantics, focus trapping, `Escape` handling, and trigger-focus restoration across all modal workflows. Calendar dates, events, search results, profile tabs, and view tabs expose keyboard activation and accessible names. CSS provides consistent `:focus-visible` treatment, stronger text contrast, a skip link, and `prefers-reduced-motion` fallbacks.

## Core Workflows

- Event editing flows through `modal.js`, `events.js`, `state.js`, and the `CalendarStore` persistence seam.
- Shared-event writes call `syncSharedEvent` so mirrored copies stay aligned.
- Free-window detection unions both profiles' busy intervals, de-dupes shared mirrors, and finds gaps.
- Analytics reads normalized events into derived metrics without mutating calendar state.
- ICS import parses VEVENT records, previews them, then imports selected events through the same normalized event path.
- Conflict center scans all relevant event pairs, de-dupes mirrored/shared overlaps, and links users back to edit or find-time flows.
- Every mutation appends an immutable entry to the audit log (`logAudit`) — an event-sourced history reviewable from the command palette's "change history".

## Testing

Three suites run under `npm test`:

- **`tests/core-tests.js`** — example-based pure-logic checks in a Node VM context: date/month helpers, shared-event mirroring and undo/redo, sync-signature dedup, authentication retry backoff, stats/ICS/rename, demo-seed idempotency, free-window search, analytics, ICS parsing, conflict collection, recurrence expansion and series edit/delete, and the reconciliation merge (LWW, tombstones, idempotence, audit-log union).
- **`tests/property-tests.js`** — invariants checked across thousands of generated inputs with `fast-check`: `normalizeEvent` always yields a positive-duration event in `[0,24]`; `mergeCalendars` is order-independent, idempotent, and never keeps duplicate ids; `expandRecurrence` is bounded, monotonic, and emits valid date keys. This is the correctness-under-arbitrary-input discipline used for financial reconciliation logic.
- **`tests/calendar-store-tests.js`** — adapter and coordinator checks for cache restore/save, duplicate-write suppression, loading guards, and reconvergence timing.
- **`tests/firestore-rules-tests.js`** — owner isolation, schema checks, immutability, share-token validation, and retired-registry denial against the local Firestore Emulator.

Run everything:

```bash
npm test
```
