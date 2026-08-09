# Product Requirements

## Product Thesis

Twosday is a shared calendar for two people. Its job is not to become a general-purpose workspace; it is to make ordinary coordination visible before it becomes a scheduling conversation.

Most calendars are designed around one person's agenda or a large group's meeting logistics. Twosday starts with a narrower question: what can two people see, decide, and protect together while still keeping personal plans legible? That constraint informs the product: two profiles, explicit shared events, mutual availability, and a quiet collaboration layer instead of channels, feeds, or project management.

## Problem

Two-person scheduling tends to fail in small, repeated ways: plans live in separate calendars, overlap is discovered late, and free time must be reconstructed from memory. A shared calendar should reduce that effort without requiring either person to turn every private commitment into communal data.

## Users and Jobs

The current product is built for a pair who already coordinate their lives and want a calendar they can use day to day.

- **Keep my own schedule understandable.** Personal events remain attached to a named profile.
- **Make shared plans reliable.** A shared event appears in both profiles and stays synchronized when edited.
- **Find a workable opening quickly.** Mutual free-time and conflict tools turn calendar state into a scheduling answer.
- **Understand what changed.** Presence, update metadata, and history provide lightweight context without recreating chat.

## Product Principles

1. **Coordination over administration.** Features should shorten the path from “when are we free?” to a concrete plan.
2. **Private by default, shared by intent.** An event is shared only when its creator marks it shared. External calendar data is represented as busy time, not copied into Twosday.
3. **State must stay trustworthy.** Shared edits, offline writes, and concurrent changes need predictable outcomes before new surface area is added.
4. **Information should earn its place.** The calendar is primary. Supporting controls stay secondary and avoid permanently competing with the schedule.
5. **Small product, complete workflows.** Import/export, recurrence, search, accessibility, and recovery matter because people depend on calendars for repeated use.

## Current Requirements

| Capability | Requirement | Why it matters |
| --- | --- | --- |
| Personal profiles | Support two named profiles in one calendar account. | Keeps personal schedules distinct while preserving a shared context. |
| Shared events | Mirror a shared event into both profiles and reconcile edits deterministically. | A shared plan cannot be reliable if each profile can drift independently. |
| Scheduling tools | Surface conflicts and mutual free windows from the same event data users already maintain. | Avoids asking users to manually compare calendars. |
| Calendar basics | Support timed events, recurring series, drag/resize, completion, undo/redo, search, and import/export. | Coordination only works when normal calendar maintenance is fast. |
| Collaboration context | Show presence, latest event update, and change history. | Gives enough context to trust a change without adding an activity feed. |
| External calendars | Offer selected Google calendars as read-only busy overlays. | Helps users account for existing commitments without importing private third-party event details. |
| Resilience | Work from local cache, reconcile remote state, and communicate sync status. | A calendar must remain useful through ordinary connection changes. |

## Non-Goals

Twosday does not currently aim to be a team calendar, task manager, chat application, or full Google Calendar replacement. It also does not yet support account-to-account invitations, granular event permissions, background push reminders, or travel-aware time-zone conversion. Those are deliberate future decisions, not hidden promises.

## How Product Quality Is Judged

This private project does not publish fabricated adoption or conversion metrics. Product quality is evaluated through observable behavior instead:

- Can a pair create, edit, and trust a shared event without duplicate or stale copies?
- Can they identify a conflict or mutual opening without manually comparing schedules?
- Does calendar state remain usable after refresh, reconnect, or concurrent edits?
- Can keyboard-only and reduced-motion users complete core workflows?
- Can an external busy block inform a decision without exposing external event details?

## Open Product Questions

- Should a calendar account be owned by one person, or should two independently authenticated accounts form a partnership?
- Which visibility levels are useful enough to justify their complexity: private, shared read-only, shared editable, or proposed?
- When users connect Google Calendar, should selection remain account-wide or become profile-specific after account linking exists?

These questions shape the next collaboration model. They should be resolved before adding permission-heavy features.
