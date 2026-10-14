# Roadmap

## Direction

Twosday's next stage is depth, not scale. The product already supports real shared-calendar use; future work should make that use more trustworthy and more useful before adding broad integrations or public-growth features.

Priorities are judged by four questions: does this improve everyday coordination, protect user data, clarify the two-person collaboration model, or reduce a known reliability risk?

## Now: Everyday Reliability

1. **Mobile accessibility**
   - Improve small secondary touch targets and large-text layouts.
   - Validate core flows with real-device screen readers, not only browser automation.

2. **Synchronization regression coverage**
   - Retain fresh-device loading, offline/cache, and failed-listener checks.
   - Add focused tests when real-device reports expose a new failure mode.

3. **Recurrence consistency**
   - Keep dialog edits, drag, and resize aligned on the same scope rules.
   - Explain standalone occurrences without guessing missing series relationships.

## Deferred: Collaboration Model

Account migration is on hold. The following are design options, not authorized implementation work; any migration needs a verified data backup and an explicit rollout decision.

1. **Independent account linking and invitations**
   - Let two authenticated people form one shared calendar relationship.
   - Establish a clear owner/editor/viewer model before adding more sharing features.

2. **Event visibility and edit permissions**
   - Define private, shared, and proposed event behavior.
   - Make it clear when a partner can view, edit, or create an event for the other person.

3. **Find Time v2**
   - Rank viable windows by duration and preference.
   - Explain which commitments block a candidate window, then create a shared event directly from a result.

## Next: Calendar Dependability

1. **Time-zone-aware events**
   - Preserve local-time intent when either person travels.
   - Avoid treating a same-day calendar as a universal assumption.

2. **Offline recovery surface**
   - Make pending writes, last successful sync, and recovery actions visible when they matter.
   - Keep normal use quiet when sync is healthy.

3. **Background reminder delivery**
   - Existing browser-open reminders do not provide phone push delivery.
   - Decide notification consent and account ownership before introducing a delivery service.

## Later: Interoperability

1. **Google Calendar overlay maturity**
   - Configure the existing OAuth integration and validate token renewal on real clients.
   - Selected-calendar management is implemented; profile-level ownership policy remains an open decision.

2. **Private subscribe-only ICS feed**
   - Let Twosday events travel to Apple Calendar, Outlook, or Google Calendar without making those products a second source of truth.

3. **Notion or task-source overlays**
   - Consider read-only deadlines or planning blocks with deep links back to their source.

## Public-Launch Work

Public availability is not current roadmap scope. Before opening registration, complete account invitations, email verification and recovery, server-side abuse controls, deployment protection review, App Check enforcement validation, data-retention decisions, terms, and a privacy review appropriate to the launch jurisdiction.

## Not Planned

Twosday will not pursue team-management features, a broad social layer, or automatic AI scheduling as default product direction. They would dilute the central two-person coordination problem unless future usage shows a stronger need.
