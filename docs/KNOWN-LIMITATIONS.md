# Known Limitations

Twosday is an actively used private shared calendar and a portfolio project. This document records present limits plainly so contributors and reviewers can distinguish current capability from future intent.

## Collaboration

- One Firebase account currently owns both profiles. Two independently authenticated people cannot yet invite or link one another.
- Event permissions are binary: personal or shared. There is no viewer role, proposal state, or per-event edit policy.
- Shared events mirror between profiles, but partner ownership semantics are not yet modeled.

## Calendar Behavior

- Events use local date keys and decimal local hours. New events record their source IANA time zone, but travel-aware conversion and daylight-saving rescheduling are not implemented yet.
- Google Calendar overlay is read-only busy time. It requires manual OAuth setup, does not write to Google, and intentionally hides external titles and details.
- ICS import flags likely duplicates (same day, same normalized title as an existing event on the target profile) and leaves them unchecked in the preview, but the match is title-based only — a re-import under a reworded title, or of a different event that happens to share a title, won't be caught or will be flagged incorrectly, respectively. Past 150 parsed rows, individual rows stop being reviewable in the preview UI; only bulk select all/none remain available.
- Optional browser reminders work only while Twosday is open. Background or push delivery is not implemented.
- The product is scoped to two profiles; it is not designed for teams or group scheduling.

## Reliability and Operations

- Offline persistence and reconciliation exist, but there is no dedicated user-facing queue inspector or conflict-recovery workspace.
- App Check is registered for production, but enforcement should remain a monitored dashboard decision until valid-token coverage is confirmed.
- Preview deployment protection, Firebase quotas, API-key restrictions, and OAuth consent configuration require periodic dashboard review outside this repository.

## Public Readiness

- The live app is not presented as a public multi-tenant service.
- Password reset works only for accounts with Google linked — a fresh Google sign-in proves ownership in place of an emailed reset link, since username-based Firebase accounts use non-deliverable internal addresses. Accounts without Google linked still have no recovery path. Email verification, account invitations, formal terms, and a dedicated security reporting mailbox also need completion before open registration.
- The privacy policy describes current handling; public collection, retention, and support practices need review when product scope changes.

## Reporting

For security concerns, follow [SECURITY.md](../SECURITY.md). For product gaps, open an issue only when the report contains no private calendar content.
