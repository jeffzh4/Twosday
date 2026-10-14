# Test Strategy

Twosday uses small, layered tests because calendar regressions often appear at boundaries: a shared event mirrored twice, an offline write arriving after a remote edit, a modal returning focus incorrectly, or a view redraw interrupting a simple action.

## Automated Layers

| Layer | Command | Protects |
| --- | --- | --- |
| Core behavior | `npm run test:core` | Event lifecycle, sharing, recurrence, imports, conflict detection, analytics, audit data, and seeded demo behavior. |
| Generated invariants | `npm run test:property` | Event duration, merge idempotence/order independence, unique IDs, and recurrence bounds. |
| Persistence interface | `npm run test:store` | Cache writes, duplicate-write suppression, confirmed-server readiness, listener failure, and reconvergence timing. |
| UI regressions | `npm run test:ui` | Stable density geometry, non-flickering event surfaces, picker behavior, external-overlay isolation, and offline shell assets. |
| Google overlay | `npm run test:google` | Busy-time normalization, deduplication, and no external data persistence. |
| Browser smoke | `npm run test:browser` | Desktop/mobile workflows, keyboard controls, modal recovery, empty/offline states, public routes, and runtime errors. |
| Firestore Rules | `npm run test:rules` | Owner privacy, cross-account denial, shape validation, legacy-registry denial, and share-link constraints. |
| Production quality | `npm run test:quality` | Public metadata, manifest/icons, security headers/config guards, credential patterns, and app-shell budget. |

## Live Checks

`npm run audit:production` verifies public `twosday.dev` responses and headers without signing in or reading calendar data. It should run after a deployment settles. Browser-authentication, Firebase dashboard, App Check, OAuth, social-preview cache, Lighthouse, and assistive-technology checks remain deliberate manual steps in [Release Checklist](RELEASE-CHECKLIST.md).

## Test Data

Automated browser and rules tests use mocked Firebase or isolated emulator projects. They never authenticate with, read from, or write to a personal production calendar. The seeded `testing` account remains separate from test fixtures.

The browser suite also checks recurring drag cancellation and scope selection, title edits across a series, and delayed cloud loading in a fresh mobile session with no calendar cache. A simulated listener failure verifies that the interface reports an error and blocks remote saves. These are specific regression checks, not a claim that every browser, touch gesture, or network failure is covered.

## Local Prerequisites

Install development dependencies with `npm install`. Browser checks require Playwright Chromium (`npx playwright install chromium`); Firestore Rules checks require Java. The browser test starts and closes its own loopback server. Run `npm test` for all eight suites, or a command from the table for a focused check.

Opening `index.html` manually is different: it uses the Firebase project in `js/config.js`. Do not assume that a local hostname isolates production data.

## Change Discipline

Run `npm test` before merging calendar behavior. Add a focused regression when fixing a user-visible failure. Keep tests close to the invariant or workflow they protect; do not rely on a broad end-to-end test to explain a narrow calendar rule.
