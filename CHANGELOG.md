# Changelog

Twosday follows a milestone log rather than semantic version releases. Dates record repository milestones, not public-service availability.

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
