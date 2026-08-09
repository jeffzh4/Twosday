# Quality Baseline

This record makes the project's quality work inspectable without presenting a local audit as production telemetry.

## Local unauthenticated shell, 2026-08-09

| Category | Score |
| --- | ---: |
| Performance | 66 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |

The baseline was captured with Lighthouse 12.8.2 against the local, unauthenticated application shell in Chrome. It is a comparative engineering baseline, not a field-performance claim. Authentication, Firestore data, browser extensions, network location, and production caching can all change the result.

An initial run reported an invalid ARIA role on the sign-in form. That issue was corrected, then this clean result was captured again. The next audit should be run against a deployed, cache-warmed desktop and mobile session, with the largest-contentful-paint resource identified before performance work is prioritized.

## Repeatable checks

Run the complete local suite with:

```bash
npm test
```

After deployment, check the public shell, security headers, social metadata, privacy page, and custom 404 page with:

```bash
npm run audit:production
```

See [Test Strategy](TEST-STRATEGY.md) for coverage boundaries and [Release Checklist](RELEASE-CHECKLIST.md) for provider-side verification that cannot be established from repository code.
