# Changelog

Twosday follows a milestone log rather than semantic version releases. Dates record repository milestones, not public-service availability.

## 2026-10-08

### Fresh-device Sync and Recurring Drag Edits

- Blocked remote calendar writes until a confirmed server snapshot arrives, protecting existing cloud data on a fresh device.
- Reported listener failures as sync errors and cleared prior account state during account activation.
- Routed recurring drag and resize changes through the recurrence scope chooser, including cancellation and shared-event handling.
- Added delayed-cloud mobile and recurrence browser regressions and refreshed the offline shell cache.

## 2026-10-01

### Recurring Event Editing

- Completed scope handling for linked occurrences, including a single remaining instance and future-series splits.
- Expanded shared-series and edit-field regression coverage.

## 2026-09-30

### Calendar Payload Size

- Compacted calendar synchronization payloads to reduce Firestore document-size pressure.

## 2026-09-07

### Session Behavior

- Disabled inactivity sign-out; sessions remain signed in until explicit logout or Firebase invalidates authentication.

## 2026-08-23

### Mobile Calendar

- Corrected week-agenda clipping and aligned mobile surfaces with the desktop theme.
- Mobile navigation and agendas retain existing calendar tools and event-editing behavior.

## 2026-07-30

### Google Calendar and Quality

- Added selected-calendar, read-only Google busy overlays with session-only OAuth access.
- Added Google event normalization tests and browser smoke coverage using mocked Firebase data.
- Added CI browser runtime setup so workflow checks match local coverage.
- Refined calendar event language and presence feedback without changing scheduling behavior.

## 2026-07-28

### Security Hardening

- Enabled production App Check client activation for registered domains.
- Added public-share expiration enforcement, browser security headers, and security operating documentation.
- Restricted alternate deployment behavior to the canonical Twosday domain.

## Earlier 2026 Milestones

- Added real-time shared-event mirroring, conflict detection, mutual free-window search, analytics, import/export, recurrence, presence, audit history, and offline reconciliation.
- Established Firebase Authentication ownership, Firestore Rules coverage, property-based merge tests, and a recorded-demo-ready seeded account.

For detailed history, use the repository [commit log](../../commits/main).
