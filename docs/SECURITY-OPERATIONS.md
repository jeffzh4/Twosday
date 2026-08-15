# Security Operations

## Release checks

Before each production release:

1. Run the full test suite, including Firestore Rules tests.
2. Confirm `vercel.json` retains the CSP, HSTS, frame, referrer, and permissions headers.
3. Test username/password sign-in, Google sign-in, calendar sync, share-link creation, expired share denial, and logout.
4. Verify production traffic uses `twosday.dev` or `www.twosday.dev`; preview deployments remain protected.

## Firebase App Check rollout

1. Keep App Check enforcement off while the registered production client starts issuing tokens.
2. In Firebase Console, review App Check metrics for Cloud Firestore and Firebase Authentication until valid requests consistently carry App Check tokens.
3. Test both sign-in methods, normal calendar reads/writes, notes, presence, and public event links in production.
4. Enable enforcement for Cloud Firestore first. Monitor errors and Firestore denied-request metrics.
5. Enable Firebase Authentication enforcement only after successful production sign-in testing.
6. If an enforcement change blocks legitimate users, disable only the affected product's enforcement, diagnose the missing token path, then re-enable after a verified fix.

## Browser session and request boundaries

Twosday signs out an inactive browser after 30 minutes. Activity refreshes the local session timestamp at a bounded cadence; returning to an expired background tab signs out before account data is restored.

Signup requests require a current Firebase App Check attestation on production hosts. This adds a browser-side gate, but the durable bot boundary remains Firebase App Check enforcement and Firebase Authentication quotas in the Firebase Console.

Twosday has no first-party server endpoints authenticated by browser cookies. Firebase Authentication and Firestore calls use Firebase-managed credentials, so a traditional CSRF token would not protect a state-changing cookie endpoint because none exists. The relevant controls are the Content Security Policy's `form-action 'self'`, `frame-ancestors 'none'`, Firebase token validation, and owner-scoped Firestore Rules. Revisit this posture before adding any cookie-authenticated API route.

## Diagnostics and browser logs

Operational diagnostics retain only a timestamp, fixed scope, release, path without a query string, and a content-free error category. Calendar contents, account identifiers, passwords, access tokens, provider error text, and stack traces are excluded. Console warnings use the same generic scope and never print a raw provider error object.

## Sharing lifecycle

Public event links are bearer links. The Firestore Rules layer denies reads after `expiresAt`, even if a recipient calls Firestore directly. A link may still be forwarded before it expires, so do not include sensitive personal, financial, medical, or location details unless the recipient is trusted.

## External configuration

The following controls are outside this repository and require periodic dashboard review:

- Firebase Authentication password policy, quotas, and abuse protections.
- Firebase API-key restrictions and App Check enforcement state.
- Firestore Rules deployment state.
- Vercel Deployment Protection for previews and non-production deployments.
- DNS, domain renewal, and domain-account access.

## Incident handling

1. Contain: disable the affected public share link, Firebase product, or deployment access path.
2. Preserve: retain relevant timestamps, request identifiers, and configuration state without copying private calendar content into tickets.
3. Eradicate: ship the smallest tested code or rule change that removes the cause.
4. Recover: verify the normal account flow and affected security boundary.
5. Review: document cause, impact, corrective action, and follow-up owner.
