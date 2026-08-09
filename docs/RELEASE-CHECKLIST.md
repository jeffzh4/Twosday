# Release Checklist

Twosday is a private shared calendar. This checklist protects ordinary use and keeps portfolio claims tied to repeatable evidence rather than one-off manual checks.

## Before publishing

1. Run `npm test`. The suite covers calendar behavior, property invariants, persistence, UI regressions, Google busy-time isolation, browser workflows, Firestore Rules, and static production-quality guards.
2. Open a clean browser session at `https://twosday.dev`. Confirm username/password sign-in, Google sign-in if configured, event create/edit/delete, shared-event mirroring, import/export, and sign-out.
3. Confirm empty-day creation, offline status, reconnect status, and a failed or expired share link. These paths must remain understandable without exposing account data.
4. Check desktop and mobile views with keyboard navigation. Confirm visible focus, modal focus restoration, readable contrast, and reduced-motion behavior.
5. Open `/privacy.html`, `/share.html`, and an unknown URL. Privacy and invalid-share pages must render without sign-in; unknown URLs must return the custom 404 page.

## Metadata and performance

1. Confirm the browser tab icon and install metadata load on `twosday.dev`.
2. Test the shared preview after a metadata or image change using the platform-specific cache debugger or a fresh message thread. Verify title, description, and preview image match the current product.
3. Run Lighthouse against a production page after substantial UI or asset changes. Record any regression in Performance, Accessibility, Best Practices, or SEO before release.
4. Keep the app shell below the repository quality guard's uncompressed budget. Do not load the demonstration GIF in the authenticated calendar shell.

## Dashboard controls

These controls cannot be verified from repository code. Review them in their providers before changes that affect authentication, deployment, or public sharing:

1. Vercel: production domain remains `twosday.dev`; preview deployments require Vercel Authentication.
2. Firebase: deployed Firestore Rules match `firestore.rules`; Auth provider configuration and quota settings are intentional.
3. Firebase App Check: verify current token coverage before changing enforcement. Follow [Security Operations](SECURITY-OPERATIONS.md#firebase-app-check-rollout).
4. Google Cloud: OAuth authorized JavaScript origins and redirect settings match the deployed Google Calendar overlay configuration.

## Evidence

Use a short release note for meaningful changes: date, commit, checks run, dashboard controls reviewed, and any known limitation. Never include calendar contents, credentials, full tokens, or personal screenshots in that record.
