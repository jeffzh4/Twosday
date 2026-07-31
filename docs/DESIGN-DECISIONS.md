# Design Decisions

Twosday's interface is designed as a working calendar, not a marketing surface. The visual system favors quick scanning, stable geometry, and small signals that explain state without interrupting it.

## Calendar First

The schedule owns the page. Navigation, view selection, profile switching, and tools sit around it because repeated calendar work depends on spatial memory. The interface avoids dashboard cards around the main schedule; framed elements are reserved for controls, dialogs, and repeated items that benefit from containment.

## Two Profiles, One Shared Context

Profiles are represented as adjacent calendar views rather than separate accounts or a team roster. This keeps the core comparison simple: personal commitments remain recognizable, while shared events appear in both views. The choice is intentionally narrow and matches the current collaboration model.

## Event Language

Event color communicates category and is not treated as decoration. Personal and shared events receive different edge treatments; external Google busy blocks use a dashed blue treatment and never expose third-party titles. These distinctions help someone scan ownership and availability before reading event text.

## Motion as Feedback

Motion is limited to state changes: view transitions, control feedback, and a one-time presence shimmer when another viewer appears. Event cards do not blur animated backgrounds because that caused rendering instability. All nonessential motion respects `prefers-reduced-motion`.

## Dark and Light Themes

Both themes preserve the same information hierarchy. Theme changes adjust contrast, borders, and event readability rather than simply inverting colors. The calendar remains legible under low-light use while light mode remains suitable for daytime planning and screenshots.

## Accessibility Is Part of the Interaction Model

Calendar dates, events, tabs, controls, and dialogs are keyboard-operable. Focus is visible, dialogs trap and restore focus, status text uses live regions, and shortcuts do not run while a user is typing. This is not a parallel “accessible mode”; it is the expected path through the interface.

## Responsive Behavior

The full calendar remains the product on smaller screens. Controls compress before calendar geometry changes, and mobile defaults to a day view when a week would become too narrow. Fixed event positioning and stable month rows prevent interface shifts that would make time placement harder to trust.

## Design Boundaries

Twosday deliberately avoids decorative infinite animation, oversized feature panels, and visual effects that change event layout or obscure text. A shared calendar benefits more from calm, reliable cues than from a constantly animated surface.
