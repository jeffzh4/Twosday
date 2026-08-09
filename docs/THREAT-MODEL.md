# Threat Model

Twosday is a private, two-profile calendar. This document records the security boundaries that matter for its current scope, plus the limits those boundaries do not solve.

## Assets

- Calendar events, notes, profile names, and presence state.
- Firebase-authenticated account ownership.
- Public event-share tokens and selected event fields.
- Browser-local offline cache and short-lived diagnostics.

## Trust Boundaries

1. **Browser to Firebase:** Firebase Authentication identifies an account owner. Firestore Rules require that owner UID for account, calendar, note, and presence reads and writes.
2. **Browser to public share page:** A share token is a bearer credential. Rules permit only a direct read for a valid, unexpired token; collection listing remains denied.
3. **Browser storage:** Offline cache, retry state, and diagnostics remain in the browser. Diagnostics intentionally omit calendar content, account identifiers, query strings, and stack traces.
4. **Third-party services:** Firebase/Google provide authentication and storage; Vercel serves the app and headers. Optional Google Calendar overlay tokens and event details remain memory-only.

## Threats and Controls

| Threat | Current control | Residual limit |
| --- | --- | --- |
| Another account reads private calendar data | Owner-scoped Firestore Rules and emulator tests | Rules deployment must be reviewed in Firebase Console. |
| Anonymous or malformed writes | Auth-required Rules, shape/size validation, App Check rollout | Browser retry delay is not server-side bot protection. |
| Preview deployment exposes production access | Canonical-host redirect and production-host Firebase initialization guard | Vercel Deployment Protection remains a dashboard control. |
| Shared link is guessed or listed | Long token, direct-read-only rule, expiry enforcement, no list access | A recipient can forward a valid link before expiry. |
| Script injection or framing | CSP, HSTS, frame denial, referrer and permissions policies | Policy changes require authentication and PWA regression testing. |
| Browser failure loses recent work | Local cache, Firestore reconciliation, undo/redo, audit history | No cross-device restore workspace exists yet. |

## Out of Scope Today

- Independent collaborator accounts, invitations, and role-based permissions.
- Server-side abuse detection or a formal incident-response service.
- Background notification delivery after the browser closes.
- Travel-aware conversion between event time zones.

## Review Triggers

Review this model before changing authentication, Firestore schema/rules, public sharing, diagnostics collection, external integrations, or deployment providers. Follow [Security Operations](SECURITY-OPERATIONS.md) for dashboard checks and incident handling.
