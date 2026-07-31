# Known Limitations

Twosday is an actively used private shared calendar and a portfolio project. This document records present limits plainly so contributors and reviewers can distinguish current capability from future intent.

## Collaboration

- One Firebase account currently owns both profiles. Two independently authenticated people cannot yet invite or link one another.
- Event permissions are binary: personal or shared. There is no viewer role, proposal state, or per-event edit policy.
- Shared events mirror between profiles, but partner ownership semantics are not yet modeled.

## Calendar Behavior

- Events use local date keys and decimal local hours. Time zones and travel-aware event semantics are not implemented.
- Google Calendar overlay is read-only busy time. It requires manual OAuth setup, does not write to Google, and intentionally hides external titles and details.
- Reminders and push notifications are not implemented.
- The product is scoped to two profiles; it is not designed for teams or group scheduling.

## Reliability and Operations

- Offline persistence and reconciliation exist, but there is no dedicated user-facing queue inspector or conflict-recovery workspace.
- App Check is registered for production, but enforcement should remain a monitored dashboard decision until valid-token coverage is confirmed.
- Preview deployment protection, Firebase quotas, API-key restrictions, and OAuth consent configuration require periodic dashboard review outside this repository.

## Public Readiness

- The live app is not presented as a public multi-tenant service.
- Password reset, email verification, account invitations, formal terms, and a dedicated security reporting mailbox need completion before open registration.
- The privacy policy describes current handling; public collection, retention, and support practices need review when product scope changes.

## Reporting

For security concerns, follow [SECURITY.md](../SECURITY.md). For product gaps, open an issue only when the report contains no private calendar content.
