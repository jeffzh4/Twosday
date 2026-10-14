# Twosday

**A calm coordination calendar for two people, built with vanilla JavaScript and Firebase.**

Twosday helps two people coordinate individual plans, shared events, conflicts, and open time without turning a personal calendar into a cluttered group workspace.

[Live project](https://twosday.dev) · [Privacy policy](https://www.twosday.dev/privacy.html) · [Architecture notes](ARCHITECTURE.md) · [Run the test suite](#testing)

## Product Overview

Twosday keeps two profile schedules in one account. Personal events stay on their profile; shared plans appear in both. Conflict detection and mutual free-window search help turn those schedules into a workable plan. Profile separation is organizational, not a permission boundary: anyone signed into the account can access both profiles.

Desktop uses a time grid for precise placement and drag editing. Mobile uses day and week agendas, month navigation, and a bottom tools menu. Both interfaces edit the same calendar data through the same event workflows.

## Documentation

| Document | Purpose |
| --- | --- |
| [Product requirements](docs/PRODUCT-REQUIREMENTS.md) | Product thesis, user jobs, principles, scope, and open decisions. |
| [Design decisions](docs/DESIGN-DECISIONS.md) | Interface rationale for calendar hierarchy, event language, motion, themes, and accessibility. |
| [Architecture](ARCHITECTURE.md) | Data model, sync and reconciliation, authorization, and test strategy. |
| [Roadmap](docs/ROADMAP.md) | Prioritized next work, decision criteria, and explicit non-plans. |
| [Known limitations](docs/KNOWN-LIMITATIONS.md) | Current product, operational, and public-readiness limits. |
| [Security policy](SECURITY.md) | Security boundaries and vulnerability reporting. |
| [Release checklist](docs/RELEASE-CHECKLIST.md) | Repeatable browser, accessibility, metadata, performance, and dashboard checks. |
| [Test strategy](docs/TEST-STRATEGY.md) | Layered regression coverage and production-safe verification. |
| [Quality baseline](docs/QUALITY-BASELINE.md) | Reproducible local Lighthouse baseline and next audit steps. |
| [Threat model](docs/THREAT-MODEL.md) | Assets, trust boundaries, controls, and present limits. |
| [Changelog](CHANGELOG.md) | Repository milestones and release context. |

## Engineering Decisions

| Collaboration | Scheduling intelligence | Engineering depth |
| --- | --- | --- |
| Two independent profiles with mirrored shared events, live presence, an append-only change history, and per-event update metadata. | Conflict Center and mutual free-window search make coordination visible and actionable. | Deterministic CRDT conflict reconciliation, property-based tests, Firebase Auth ownership, Firestore authorization tests, and real-time listeners. |

## Core Workflow

The main coordination flow is:

1. Navigate a populated week with two profile calendars and real-time presence.
2. Create or reschedule a shared event and show its synchronized mirror.
3. Resolve an overlap through Conflict Center, then find a mutual opening.
4. Open calendar insights to compare workload, shared time, and scheduling patterns.
5. Preview calendar import/export and keyboard-accessible event editing.

The seeded `testing` account provides fictional demonstration data. Automated tests use separate mocked or emulator data, not that account or personal calendars.

## Features

### Calendar and collaboration

- Day, week, month, and year views across a full 24-hour schedule
- Mobile day/week agendas, month navigation, quick rescheduling, and a tools menu for search, import/export, conflicts, activity, settings, and undo/redo
- Two named profiles with independent themes, notes, and optional emoji identifiers
- Shared events mirrored automatically between profiles
- True recurring events with this / this-and-following / all-occurrences edit and delete
- Drag, resize, duplicate, repeat, complete, undo, and redo event workflows
- Source time-zone provenance on new events, plus optional browser-open reminders
- Command palette (`⌘K`) over every action, with type-to-jump dates
- Append-only change history recording who changed what and when, shared across both profiles
- Live presence showing who is viewing and their current calendar context
- Event update metadata showing the latest editor and timestamp

### Scheduling tools

- Mutual free-window finder that merges both profiles' availability
- Conflict Center for same-profile and shared-event overlaps
- Cross-date event search
- Calendar insights for scheduled hours, completion, shared time, category mix, weekly load, and profile balance
- `.ics` import preview plus `.ics` and `.csv` export
- Optional Google Calendar busy-time overlay with selected calendars, session-only OAuth access, and no external event data persisted in Twosday

### Quality and resilience

- Firebase Authentication with owner-scoped account metadata
- Firestore rules that protect account, calendar, notes, and presence documents
- Deterministic conflict reconciliation: concurrent edits merge via a last-write-wins CRDT with delete tombstones, instead of one profile clobbering the other
- Property-based invariant tests alongside example-based and Firestore-rules tests
- Authentication retry backoff and owner-scoped data access
- Real-time Firestore synchronization with self-echo suppression
- A tested calendar-store interface coordinating `localStorage` caching, Firestore writes, duplicate-write suppression, and bounded reconciliation retries
- Fresh-device writes wait for a confirmed server snapshot; cached absence cannot overwrite an existing cloud calendar, and listener failures surface as sync errors
- Keyboard-operable calendar controls, focus-managed dialogs, visible focus states, and reduced-motion support
- Privacy-safe browser diagnostics, release indicator, and a production response audit that never reads calendar data

## Technical Design

Twosday is intentionally framework-free: one HTML shell, a focused CSS layer, and small feature modules loaded in dependency order. Calendar data remains plain JavaScript objects, making state transitions easy to inspect while still supporting real-time persistence. `calendar-store.js` gives cache and Firestore work a dedicated interface, keeping sync details out of the calendar views.

Each account owns three Firestore documents:

- **Calendar:** events, themes, save metadata, and writer client ID
- **Notes:** profile-scoped freeform notes
- **Presence:** short-lived sessions, current view, and heartbeat metadata

Firebase Auth establishes the account owner. Firestore rules require that owner UID for all protected reads and writes. The former shared legacy account registry is retired and denied to all clients because Firestore rules cannot safely reveal selected fields from one shared document. More detail is available in [ARCHITECTURE.md](ARCHITECTURE.md).

## Security Operations

- Firebase web configuration is intentionally committed: its API key identifies the Firebase project; it does not authorize calendar access. Firebase Auth, Firestore Rules, and App Check provide the access boundary.
- Passwords are handled only by Firebase Authentication. Twosday does not write password hashes to Firestore or browser storage.
- Browser sign-in and sign-up flows apply an escalating retry delay after repeated failed requests. Production signup also requires a current App Check attestation; Firebase App Check enforcement and Authentication quotas remain the server-side boundary.
- Browser diagnostics and console warnings use content-free categories rather than provider-supplied error text.
- The production web app is registered with Firebase App Check using reCAPTCHA Enterprise. The client activates it only on `twosday.dev` and `www.twosday.dev`; monitor App Check metrics before enforcing it for Cloud Firestore or Firebase Authentication. Also review the Firebase API key's API restrictions and tighten the `identitytoolkit.googleapis.com` quota to expected traffic.
- The default Vercel domain redirects to the canonical domain before app code loads. `config.js` permits the two production domains, localhost, loopback, and local files; other hosts redirect without initializing Firebase. Local access is not a separate staging database. In Vercel, enable **Settings → Deployment Protection → Vercel Authentication** for preview deployments as the stronger dashboard-level control.
- Create or forward `privacy@twosday.dev` before publishing the privacy policy link publicly.
- See [Security Policy](SECURITY.md), [Content Security Policy](docs/CONTENT-SECURITY-POLICY.md), and [Security Operations](docs/SECURITY-OPERATIONS.md) for reporting, browser policy, and release controls.

## Testing

```bash
npm test
```

After a deployment settles, run `npm run audit:production` to verify public status codes, headers, metadata, privacy page, and custom 404 behavior without signing in.

The suite combines Node-based core logic tests, calendar-store adapter tests, property-based invariant tests, UI regression guards, Firebase Emulator authorization tests, and static production-quality guards for public documents, sharing metadata, security headers, credential patterns, and asset budgets.

It also includes a Playwright browser smoke test that runs against mocked Firebase data, covering app startup, view navigation, keyboard interaction, event editing, empty schedules, offline/reconnect status, public pages, and the 404 page without touching a real account. See [Google Calendar overlay setup](docs/GOOGLE-CALENDAR-OVERLAY.md) for the optional OAuth configuration, and use the [release checklist](docs/RELEASE-CHECKLIST.md) for dashboard and real-client checks.

- Core coverage: date helpers, shared-event mirroring, undo/redo, sync deduplication, analytics, import parsing, conflicts, profile rename, seeded demo data, recurrence expansion and series edits, and CRDT merge reconciliation
- Property coverage (`fast-check`): event-duration invariants, and merge order-independence, idempotence, and no-duplicate-id guarantees across thousands of generated inputs
- Store coverage: cache persistence, remote-write de-duplication, loading guards, and bounded reconvergence timing
- Rules coverage: anonymous denial, account privacy, cross-account isolation, retired-registry denial, owner immutability, share-token validation, and schema validation

## Run Locally

```bash
git clone https://github.com/jeffzh4/Twosday.git
cd Twosday
npm install
open index.html
```

Java is required to run the Firestore Emulator tests. The browser app itself has no build step.

**Data safety:** opening the app locally loads the configured production Firebase project. Localhost does not automatically switch to an emulator, and provider restrictions may prevent local authentication. Do not use a personal account for experiments. For isolated verification, run `npm test`: browser tests replace Firebase with mocks, and authorization tests use the local emulator. The optional Google overlay remains unavailable until its OAuth client is configured; see the [setup guide](docs/GOOGLE-CALENDAR-OVERLAY.md).

## Project Structure

```text
Twosday/
├── index.html                 # Application shell and authentication UI
├── privacy.html               # Public-facing privacy policy
├── css/style.css              # Themes, responsive layout, and accessibility styles
├── firestore.rules            # Owner-scoped Firestore authorization
├── firebase.json              # Firebase and Emulator configuration
├── js/
│   ├── auth.js                # Authentication, retry backoff, and session restore
│   ├── state.js               # Calendar state, persistence, and undo/redo
│   ├── calendar-store.js      # Cache/Firestore persistence coordinator and adapters
│   ├── events.js              # Event creation, editing, drag, resize, and mirroring
│   ├── analytics.js           # Derived scheduling analytics
│   ├── find-time.js           # Mutual availability search
│   ├── conflicts.js           # Conflict collection and resolution workflow
│   ├── import.js              # ICS import preview and calendar tools
│   └── views/                 # Day/week, month, and year renderers
└── tests/
    ├── core-tests.js          # Core behavior regression tests
    ├── calendar-store-tests.js # Store adapter and synchronization checks
    └── firestore-rules-tests.js # Firebase Emulator authorization tests
```

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `d` / `w` / `m` / `y` | Switch day, week, month, or year view |
| `Left` / `Right` | Move backward or forward through the current view |
| `/` | Open search |
| `n` | Create an event for the current date |
| `Cmd+Z` / `Cmd+Y` | Undo / redo |
| `Enter` / `Space` | Activate a focused calendar control |
| `Escape` | Close an open dialog |
