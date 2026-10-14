# Design Decisions

Twosday's interface is designed as a working calendar, not a marketing surface. The visual system favors quick scanning, stable geometry, and small signals that explain state without interrupting it.

## Calendar First

The schedule owns the page. Navigation, view selection, profile switching, and tools sit around it because repeated calendar work depends on spatial memory. The interface avoids dashboard cards around the main schedule; framed elements are reserved for controls, dialogs, and repeated items that benefit from containment.

## Two Profiles, One Shared Context

Profiles are represented as adjacent calendar views rather than separate accounts or a team roster. This keeps the core comparison simple: personal commitments remain recognizable, while shared events appear in both views. The choice is intentionally narrow and matches the current collaboration model.

## Event Language

Event color communicates category and is not treated as decoration. Personal and shared events receive different edge treatments; external Google busy blocks use a dashed blue treatment and never expose third-party titles. These distinctions help someone scan ownership and availability before reading event text.

## Motion as Feedback

Motion includes the ambient corner color fields, pointer-responsive background treatment, control feedback, and a brief presence shimmer. It is decorative rather than a scheduling signal. Event cards do not blur animated backgrounds because that caused rendering instability. Reduced-motion styles provide a quieter alternative.

## Dark and Light Themes

Both themes preserve the same information hierarchy. Theme changes adjust contrast, borders, and event readability rather than simply inverting colors. The calendar remains legible under low-light use while light mode remains suitable for daytime planning and screenshots.

## Accessibility Is Part of the Interaction Model

Calendar dates, events, tabs, controls, and dialogs are keyboard-operable. Focus is visible, dialogs trap and restore focus, status text uses live regions, and shortcuts do not run while a user is typing. This is not a parallel “accessible mode”; it is the expected path through the interface.

## Responsive Behavior

At mobile widths, day and week agendas replace the narrow desktop time grid. Bottom navigation keeps calendar views and event creation nearby; a tools sheet retains secondary actions without filling the header. Month view remains available for date scanning. Quick rescheduling and full event dialogs use the existing mutation paths, so mobile and desktop share scheduling semantics and persistence.

This is a responsive web interface, not a native phone app. Safe-area spacing, scrollable dialogs, keyboard activation, and reduced-motion styles are implemented. Larger text, small secondary touch targets, and real-device screen-reader behavior still need dedicated verification.

## Design Boundaries

Ambient effects must stay behind the working calendar. They must not change event geometry, intercept input, or conceal sync failures. Oversized feature panels and new permanent chrome need a clear scheduling purpose before being added.
